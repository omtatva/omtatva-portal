"use client";
import { useEffect, useState } from "react";
import { auth, db } from "../../lib/firebase";
import {
  collection,
  addDoc,
  Timestamp,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { logActivity } from "@/lib/activityLog";
import { useMyLeave } from "@/lib/payroll/useMyLeave";
import { findOverlap, workingDaysInRange } from "@/lib/payroll/leaveView";

export default function LeavePage() {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [leaveType, setLeaveType] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");
  const [myLeaves, setMyLeaves] = useState([]);

  // WFH is tracked completely separately from leave (own collection,
  // own quota-free flow) since working from home isn't "leave" — the
  // employee still works, just remotely.
  const [wfhDate, setWfhDate] = useState("");
  const [wfhReason, setWfhReason] = useState("");
  const [myWfhRequests, setMyWfhRequests] = useState([]);

  useEffect(() => {
    let unsubscribeLeaves = () => {};
    let unsubscribeWfh = () => {};

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      // Clean up any previous listeners before (re)subscribing, so
      // logging out/in (or auth state flapping) never stacks up
      // duplicate onSnapshot listeners.
      unsubscribeLeaves();
      unsubscribeWfh();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      setCheckingAuth(false);
      unsubscribeLeaves = loadMyLeaves() || (() => {});
      unsubscribeWfh = loadMyWfhRequests() || (() => {});
    });

    return () => {
      unsubscribeAuth();
      unsubscribeLeaves();
      unsubscribeWfh();
    };
  }, []);

  // Balance, policy, weekly offs and company holidays come from the server —
  // the same numbers payroll uses for salary.
  const leaveSignature = myLeaves.map((l) => `${l.id}:${l.status}:${l.leaveType}`).join("|");
  const { data: lv, error: lvError } = useMyLeave(leaveSignature);

  const isOffDay = (d) => {
    if (!lv) return false;
    const [y, m, day] = d.split("-").map(Number);
    return lv.offWeekdays.includes(new Date(Date.UTC(y, m - 1, day)).getUTCDay()) || lv.holidays.includes(d);
  };
  const countedDays = fromDate && toDate && lv ? workingDaysInRange(fromDate, toDate, isOffDay) : [];

  const totalDays = countedDays.length;

  const isUnpaidType = !!lv && lv.policy.unpaidLeaveTypes.map((t) => t.toLowerCase()).includes((leaveType || "").toLowerCase());
  // Estimate only: the real split is fixed when the request is approved.
  const freeBalance = lv ? Math.max(lv.summary.available - lv.pendingWorkingDays, 0) : 0;
  const estPaid = isUnpaidType ? 0 : Math.min(totalDays, Math.floor(freeBalance));
  const estUnpaid = totalDays - estPaid;

  const submitLeave = async () => {
    const user = auth.currentUser;

    if (!user) {
      alert("Please Login");
      return;
    }

    if (!leaveType || !fromDate || !toDate || !reason.trim()) {
      alert("Please fill all required fields");
      return;
    }

    if (fromDate > toDate) {
      alert("The To date cannot be before the From date");
      return;
    }

    if (totalDays <= 0) {
      alert("That range has no working days (only weekly offs / company holidays) — nothing to apply for.");
      return;
    }

    const clash = findOverlap(fromDate, toDate, myLeaves);
    if (clash) {
      alert(`You already have a ${clash.status.toLowerCase()} leave request covering ${clash.fromDate} → ${clash.toDate}. The same day cannot be applied for twice.`);
      return;
    }

    try {
      await addDoc(collection(db, "leaveRequests"), {
        uid: user.uid,
        employeeName: user.displayName || user.email,
        email: user.email,
        leaveType,
        fromDate,
        toDate,
        totalDays, // working days only (weekly offs and company holidays are not leave)
        calendarDays: Math.round((new Date(toDate) - new Date(fromDate)) / 86400000) + 1,
        reason,
        status: "Pending",
        appliedOn: Timestamp.now(),
      });

      await logActivity({
        uid: user.uid,
        employeeName: user.displayName || user.email,
        employeeEmail: user.email,
        activity: "Applied for Leave",
        module: "Leave",
        description: `${leaveType} (${fromDate} - ${toDate})`,
      });

      alert("Leave Request Submitted");

      setLeaveType("");
      setFromDate("");
      setToDate("");
      setReason("");
    } catch (error) {
      console.error(error);
      alert("Failed to submit");
    }
  };

  const submitWFH = async () => {
    const user = auth.currentUser;

    if (!user) {
      alert("Please Login");
      return;
    }

    if (!wfhDate || !wfhReason.trim()) {
      alert("Please fill all required fields");
      return;
    }

    try {
      await addDoc(collection(db, "wfhRequests"), {
        uid: user.uid,
        employeeName: user.displayName || user.email,
        email: user.email,
        date: wfhDate,
        reason: wfhReason,
        status: "Pending",
        appliedOn: Timestamp.now(),
      });

      await logActivity({
        uid: user.uid,
        employeeName: user.displayName || user.email,
        employeeEmail: user.email,
        activity: "Applied for WFH",
        module: "WFH",
        description: `Work From Home (${wfhDate})`,
      });

      alert("WFH Request Submitted");

      setWfhDate("");
      setWfhReason("");
    } catch (error) {
      console.error(error);
      alert("Failed to submit");
    }
  };

  // Returns the onSnapshot unsubscribe function so the caller can clean
  // it up (see the auth-state effect above).
  const loadMyLeaves = () => {
    const user = auth.currentUser;
    if (!user) return;

    const q = query(collection(db, "leaveRequests"), where("uid", "==", user.uid));

    return onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setMyLeaves(list);
    });
  };

  const loadMyWfhRequests = () => {
    const user = auth.currentUser;
    if (!user) return;

    const q = query(collection(db, "wfhRequests"), where("uid", "==", user.uid));

    return onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setMyWfhRequests(list);
    });
  };

  const pendingLeave = myLeaves.filter((l) => l.status === "Pending").length;

  const impactOf = (leave) => lv?.requests.find((r) => r.id === leave.id)?.impact || null;
  const daysOf = (leave) => impactOf(leave)?.workingDays ?? leave.totalDays;
  const salaryNote = (leave) => {
    const i = impactOf(leave);
    if (!i || leave.status === "Rejected") return "—";
    const text = i.unpaidDays === 0 ? "Paid leave — no salary deduction" : i.paidDays === 0 ? `${i.unpaidDays} day(s) unpaid (loss of pay)` : `${i.paidDays} paid, ${i.unpaidDays} unpaid (loss of pay)`;
    return leave.status === "Pending" ? `If approved: ${text}` : text;
  };

  const statusBg = (status) =>
    status === "Approved" ? "#dcfce7" : status === "Rejected" ? "#fee2e2" : "#fef3c7";

  if (checkingAuth) {
    return null;
  }

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "100%",
        padding: "20px",
        background: "var(--bg-color)",
        minHeight: "100vh",
        boxSizing: "border-box",
      }}
    >
      <style jsx global>{`
        @media (max-width: 700px) {
          .leave-header {
            padding: 20px !important;
          }
          .leave-header h1 {
            font-size: 24px !important;
          }
          .leave-card-grid {
            grid-template-columns: 1fr 1fr !important;
            gap: 12px !important;
          }
          .leave-card-grid > div {
            padding: 16px !important;
          }
          .leave-card-grid h1 {
            font-size: 26px !important;
          }
          .leave-card-grid h3 {
            font-size: 14px !important;
          }
          .leave-form-card,
          .leave-history-card {
            padding: 18px !important;
          }
          .leave-form-card h2,
          .leave-history-card h2 {
            font-size: 20px !important;
          }
          .leave-desktop-table {
            display: none !important;
          }
          .leave-mobile-cards {
            display: flex !important;
          }
          .leave-submit-btn {
            width: 100% !important;
          }
        }
        .leave-mobile-cards {
          display: none;
          flex-direction: column;
          gap: 12px;
        }
      `}</style>

      {/* Header */}
      <div
        className="leave-header"
        style={{
          background: "var(--card-bg)",
          padding: "30px",
          borderRadius: "24px",
          marginBottom: "25px",
          boxShadow: "0 10px 30px rgba(0,0,0,.06)",
        }}
      >
        <h1 style={{ fontSize: "clamp(26px,4vw,36px)", fontWeight: 800, color: "#1e3a8a", margin: 0 }}>
          🏖 Leave Management
        </h1>

        <p style={{ marginTop: "10px", color: "var(--text-muted)", fontSize: "15px" }}>
          Apply leave, track approval status and manage your leave balance.
        </p>
      </div>

      {/* Leave Cards */}
      <div
        className="leave-card-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: "20px",
          marginBottom: "25px",
        }}
      >
        <LeaveCard title="Leave Balance (days)" value={lv ? lv.summary.available : "…"} color="#16a34a" />
        <LeaveCard title={lv ? `Accrued this year (${lv.policy.accrualPerMonth}/month, max ${lv.policy.annualEntitlement})` : "Accrued this year"} value={lv ? lv.summary.accruedToDate : "…"} color="#2563eb" />
        <LeaveCard title="Used this year" value={lv ? lv.summary.usedYearToDate : "…"} color="#9333ea" />
        {lv && lv.summary.opening > 0 && <LeaveCard title="Carried forward" value={lv.summary.opening} color="#0ea5e9" />}
        <LeaveCard title="Pending (working days)" value={lv ? lv.pendingWorkingDays : pendingLeave} color="#f59e0b" />
      </div>

      <p style={{ margin: "-10px 4px 20px", color: "var(--text-muted)", fontSize: 13.5 }}>
        {lvError ? `Could not load your balance: ${lvError}` : lv ? `Balance = days earned so far this year minus approved leave. Weekly offs and company holidays are never counted as leave. Leave beyond your balance, and "${lv.policy.unpaidLeaveTypes[0] || "LOP"}", is unpaid and reduces your salary for those days.${lv.policyConfirmed ? "" : " (Leave rules are still awaiting HR confirmation.)"}` : "Loading your balance…"}
      </p>
      {/* Apply Leave Form */}
      <div
        className="leave-form-card"
        style={{
          background: "var(--card-bg)",
          padding: "30px",
          borderRadius: "24px",
          boxShadow: "0 10px 30px rgba(0,0,0,.06)",
          marginBottom: "30px",
        }}
      >
        <h2 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "22px", color: "var(--text-color)" }}>
          📝 Apply New Leave
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
            gap: "18px",
          }}
        >
          <div>
            <label style={{ color: "var(--text-color)" }}>Leave Type</label>
            <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)} style={inputStyle}>
              <option value="">Select Leave</option>
              {(lv ? [...lv.policy.paidLeaveTypes, ...lv.policy.unpaidLeaveTypes.slice(0, 1)] : ["Casual Leave", "Sick Leave", "Paid Leave", "Emergency Leave", "LOP"]).map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ color: "var(--text-color)" }}>From Date</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={inputStyle} />
          </div>

          <div>
            <label style={{ color: "var(--text-color)" }}>To Date</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={inputStyle} />
          </div>

          <div>
            <label style={{ color: "var(--text-color)" }}>Working days counted</label>
            <input value={totalDays} disabled style={inputStyle} />
          </div>
        </div>

        {totalDays > 0 && leaveType && (
          <p style={{ marginTop: 14, fontSize: 14, color: estUnpaid > 0 ? "#b45309" : "#15803d", fontWeight: 600 }}>
            {estUnpaid === 0
              ? `${totalDays} day(s) will use your leave balance — no salary deduction.`
              : estPaid === 0
                ? `${totalDays} day(s) will be unpaid (loss of pay) and reduce your salary.`
                : `About ${estPaid} day(s) from your balance and ${estUnpaid} unpaid (loss of pay). The final split is decided when the request is approved.`}
          </p>
        )}
        <div style={{ marginTop: "18px" }}>
          <label style={{ color: "var(--text-color)" }}>Reason</label>
          <textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} style={{ ...inputStyle, resize: "none" }} />
        </div>

        <button onClick={submitLeave} className="leave-submit-btn" style={submitBtn}>
          📨 Submit Request
        </button>
      </div>

      {/* Leave History */}
      <div
        className="leave-history-card"
        style={{
          background: "var(--card-bg)",
          padding: "30px",
          borderRadius: "24px",
          boxShadow: "0 10px 30px rgba(0,0,0,.06)",
          marginBottom: "30px",
        }}
      >
        <h2 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "18px", color: "var(--text-color)" }}>📋 Leave History</h2>

        {/* MOBILE cards */}
        <div className="leave-mobile-cards">
          {myLeaves.length === 0 ? (
            <p style={{ color: "var(--text-muted)", padding: "12px 0" }}>No leave requests yet</p>
          ) : (
            myLeaves.map((leave) => (
              <div
                key={leave.id}
                style={{
                  border: "1px solid var(--border-color)",
                  borderRadius: 14,
                  padding: 14,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text-color)" }}>{leave.leaveType}</span>
                  <span
                    style={{
                      padding: "4px 12px",
                      borderRadius: "20px",
                      fontSize: 12.5,
                      fontWeight: 600,
                      background: statusBg(leave.status),
                    }}
                  >
                    {leave.status}
                  </span>
                </div>
                <p style={{ margin: "2px 0", fontSize: 13.5, color: "var(--text-muted)" }}>
                  {leave.fromDate} → {leave.toDate} ({daysOf(leave)} working day{daysOf(leave) !== 1 ? "s" : ""})
                </p>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-muted)" }}>{leave.reason}</p>
                <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "var(--text-muted)" }}>Salary: {salaryNote(leave)}</p>
              </div>
            ))
          )}
        </div>

        {/* DESKTOP table */}
        <div className="leave-desktop-table" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "900px", color: "var(--text-color)" }}>
            <thead>
              <tr>
                <th style={th}>Type</th>
                <th style={th}>From</th>
                <th style={th}>To</th>
                <th style={th}>Working days</th>
                <th style={th}>Reason</th>
                <th style={th}>Status</th>
                <th style={th}>Effect on salary</th>
              </tr>
            </thead>

            <tbody>
              {myLeaves.map((leave) => (
                <tr key={leave.id}>
                  <td style={td}>{leave.leaveType}</td>
                  <td style={td}>{leave.fromDate}</td>
                  <td style={td}>{leave.toDate}</td>
                  <td style={td}>{daysOf(leave)}</td>
                  <td style={td}>{leave.reason}</td>
                  <td style={td}>
                    <span
                      style={{
                        padding: "6px 15px",
                        borderRadius: "20px",
                        background: statusBg(leave.status),
                      }}
                    >
                      {leave.status}
                    </span>
                  </td>
                  <td style={td}>{salaryNote(leave)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===================== WORK FROM HOME (separate flow) ===================== */}

      <div
        className="leave-form-card"
        style={{
          background: "var(--card-bg)",
          padding: "30px",
          borderRadius: "24px",
          boxShadow: "0 10px 30px rgba(0,0,0,.06)",
          marginBottom: "30px",
          borderTop: "4px solid #0ea5e9",
        }}
      >
        <h2 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "8px", color: "var(--text-color)" }}>💻 Work From Home</h2>

        <p style={{ color: "var(--text-muted)", fontSize: "13.5px", marginBottom: "18px" }}>
          WFH doesn't count against your leave balance — it's tracked separately.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
            gap: "18px",
          }}
        >
          <div>
            <label style={{ color: "var(--text-color)" }}>Date</label>
            <input type="date" value={wfhDate} onChange={(e) => setWfhDate(e.target.value)} style={inputStyle} />
          </div>

          <div>
            <label style={{ color: "var(--text-color)" }}>Reason</label>
            <input
              value={wfhReason}
              onChange={(e) => setWfhReason(e.target.value)}
              placeholder="e.g. Internet installation at home"
              style={inputStyle}
            />
          </div>
        </div>

        <button onClick={submitWFH} className="leave-submit-btn" style={{ ...submitBtn, background: "#0ea5e9" }}>
          📨 Submit WFH Request
        </button>
      </div>

      {/* WFH History */}
      <div
        className="leave-history-card"
        style={{
          background: "var(--card-bg)",
          padding: "30px",
          borderRadius: "24px",
          boxShadow: "0 10px 30px rgba(0,0,0,.06)",
        }}
      >
        <h2 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "18px", color: "var(--text-color)" }}>📋 WFH History</h2>

        {/* MOBILE cards */}
        <div className="leave-mobile-cards">
          {myWfhRequests.length === 0 ? (
            <p style={{ color: "var(--text-muted)", padding: "12px 0" }}>No WFH requests yet</p>
          ) : (
            myWfhRequests.map((wfh) => (
              <div
                key={wfh.id}
                style={{
                  border: "1px solid var(--border-color)",
                  borderRadius: 14,
                  padding: 14,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text-color)" }}>{wfh.date}</span>
                  <span
                    style={{
                      padding: "4px 12px",
                      borderRadius: "20px",
                      fontSize: 12.5,
                      fontWeight: 600,
                      background: statusBg(wfh.status),
                    }}
                  >
                    {wfh.status}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>{wfh.reason}</p>
              </div>
            ))
          )}
        </div>

        {/* DESKTOP table */}
        <div className="leave-desktop-table" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "600px", color: "var(--text-color)" }}>
            <thead>
              <tr>
                <th style={th}>Date</th>
                <th style={th}>Reason</th>
                <th style={th}>Status</th>
              </tr>
            </thead>

            <tbody>
              {myWfhRequests.length === 0 ? (
                <tr>
                  <td style={td} colSpan={3}>
                    No WFH requests yet
                  </td>
                </tr>
              ) : (
                myWfhRequests.map((wfh) => (
                  <tr key={wfh.id}>
                    <td style={td}>{wfh.date}</td>
                    <td style={td}>{wfh.reason}</td>
                    <td style={td}>
                      <span
                        style={{
                          padding: "6px 15px",
                          borderRadius: "20px",
                          background: statusBg(wfh.status),
                        }}
                      >
                        {wfh.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function LeaveCard({ title, value, color }) {
  return (
    <div
      style={{
        background: "var(--card-bg)",
        padding: "25px",
        borderRadius: "20px",
        borderLeft: `6px solid ${color}`,
        boxShadow: "0 8px 25px rgba(0,0,0,.06)",
      }}
    >
      <h3 style={{ color: "var(--text-muted)", fontSize: "16px", marginBottom: "10px" }}>{title}</h3>
      <h1 style={{ fontSize: "34px", fontWeight: 800, color: color, margin: 0 }}>{value}</h1>
      <p style={{ color: "var(--text-muted)", marginTop: "8px", fontSize: 13.5 }}>Remaining</p>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "13px 14px",
  marginTop: "8px",
  fontSize: "15px",
  borderRadius: "12px",
  border: "1px solid var(--border-color)",
  outline: "none",
  background: "var(--card-bg)",
  color: "var(--text-color)",
  transition: "0.3s",
  boxSizing: "border-box",
};

const submitBtn = {
  marginTop: "22px",
  padding: "14px 35px",
  background: "#2563eb",
  color: "#fff",
  border: "none",
  borderRadius: "12px",
  fontSize: "16px",
  fontWeight: 700,
  cursor: "pointer",
};

const th = {
  padding: "16px",
  background: "#2563eb",
  color: "#fff",
  fontWeight: "700",
  fontSize: "15px",
  textAlign: "left",
};

const td = {
  padding: "16px",
  fontSize: "15px",
  borderBottom: "1px solid var(--border-color)",
};