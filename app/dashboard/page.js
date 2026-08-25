"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import AvatarIllustration, { HeroAvatar } from "../../components/AvatarIllustration";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = {
  background: "var(--card-bg)",
  text: "var(--text-color)",
  secondary: "var(--text-muted)",

  primary: "#3d6fa8",
  accent: "#66a8e0",
  soft: "var(--border-color)",

  success: "#16a34a",
  warning: "#ea580c",
  danger: "#dc2626",

  border: "var(--border-color)",
  shadow: "rgba(61,111,168,0.15)",
};

// Default annual leave allocation, used if the user doc has no explicit value
const DEFAULT_LEAVE_ALLOCATION = 24;

// Colors used for the confetti pieces on the birthday popup
const CONFETTI_COLORS = ["#3d6fa8", "#66a8e0", "#f59e0b", "#16a34a", "#dc2626", "#a855f7", "#ec4899"];

export default function DashboardPage() {
  const [myTimesheets, setMyTimesheets] = useState([]);
  const [myAttendance, setMyAttendance] = useState([]);
  const [myLeaves, setMyLeaves] = useState([]);
  const [userName, setUserName] = useState("");
  const [userData, setUserData] = useState(null);
  const [upcomingHolidays, setUpcomingHolidays] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [todayBirthdays, setTodayBirthdays] = useState([]);
  const [showBirthdayPopup, setShowBirthdayPopup] = useState(false);
  const [wishText, setWishText] = useState("");
  const [showWishModal, setShowWishModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  // Real-time list of every birthday wish sent today (across all
  // employees) — this is the single source of truth for both the
  // "who wished whom" table and each button's already-wished state,
  // so it stays correct across reloads and different devices instead
  // of relying on local-only state.
  const [todayWishes, setTodayWishes] = useState([]);

  // Used to scope birthday wishes to "today" in Firestore, and to key
  // the real-time wishes listener below.
  const todayDateKey = new Date().toISOString().slice(0, 10);

  // Widget visibility from Settings -> Dashboard Layout, live so a
  // toggle there shows/hides the matching section here immediately.
  const [widgets, setWidgets] = useState({
    showAttendance: true,
    showLeave: true,
    showHoliday: true,
    showEmployee: true,
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, "settings", "dashboardLayout"),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setWidgets({
            showAttendance: data.showAttendance ?? true,
            showLeave: data.showLeave ?? true,
            showHoliday: data.showHoliday ?? true,
            showEmployee: data.showEmployee ?? true,
          });
        }
      },
      (error) => console.error("DASHBOARD LAYOUT SNAPSHOT ERROR:", error)
    );
    return () => unsubscribe();
  }, []);

  // ================= REAL-TIME USER / EMPLOYEE PROFILE =================
  // Uses onSnapshot instead of a one-time getDoc so that any change HR makes
  // (e.g. updating the Performance rating from the admin employee page)
  // shows up here immediately, without the employee needing to reload.
  useEffect(() => {
    let unsubUserDoc = () => {};
    let unsubEmployeeDoc = () => {};
    let unsubAttendance = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      // Clean up previous listeners
      unsubUserDoc();
      unsubEmployeeDoc();
      unsubAttendance();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      console.log("Auth UID:", user.uid);

      let latestUserData = {};
      let latestEmployeeData = {};

      const mergeAndSet = () => {
        const finalData = {
          ...latestUserData,
          ...latestEmployeeData,
        };

        console.log("FINAL DATA:", finalData);
        console.log("Performance:", finalData.performance);

        setUserData(finalData);

        setUserName(
          `${finalData.firstName || ""} ${finalData.lastName || ""}`.trim()
        );
      };

      const userRef = doc(db, "users", user.uid);
      const employeeRef = doc(db, "employeeProfiles", user.uid);

      unsubUserDoc = onSnapshot(
        userRef,
        (snap) => {
          console.log("Users exists:", snap.exists());

          if (snap.exists()) {
            console.log("Users Data:", snap.data());
          }

          latestUserData = snap.exists() ? snap.data() : {};
          mergeAndSet();
        },
        (error) => console.error("USER SNAPSHOT ERROR:", error)
      );

      unsubEmployeeDoc = onSnapshot(
        employeeRef,
        (snap) => {
          console.log("Employee Profile exists:", snap.exists());

          if (snap.exists()) {
            console.log("Employee Profile Data:", snap.data());
          }

          latestEmployeeData = snap.exists() ? snap.data() : {};
          mergeAndSet();
        },
        (error) => console.error("EMPLOYEE SNAPSHOT ERROR:", error)
      );

      // Real-time attendance — uses onSnapshot instead of a one-time
      // getDocs so that punching in/out (from this dashboard's own
      // Check In button, the /attendance page, or any other tab) is
      // reflected here immediately without needing a manual reload.
      const attendanceQuery = query(
        collection(db, "attendance"),
        where("userId", "==", user.uid)
      );

      unsubAttendance = onSnapshot(
        attendanceQuery,
        (snapshot) => {
          setMyAttendance(
            snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
          );
        },
        (error) => console.error("ATTENDANCE SNAPSHOT ERROR:", error)
      );

      loadMyData(user);
    });

    return () => {
      unsubscribeAuth();
      unsubUserDoc();
      unsubEmployeeDoc();
      unsubAttendance();
    };
  }, []);

  useEffect(() => {
    loadUpcomingHolidays();
  }, []);

  useEffect(() => {
    loadAnnouncements();
  }, []);
  useEffect(() => {
    loadTodayBirthdays();
  }, []);

  // Real-time "who wished whom today" — every wish document carries a
  // `date` field (set at write time in sendWish) so this can be scoped
  // to today without needing to know every birthday person's ID ahead
  // of time.
  useEffect(() => {
    const q = query(
      collection(db, "birthdayWishes"),
      where("date", "==", todayDateKey)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setTodayWishes(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (error) => console.error("BIRTHDAY WISHES SNAPSHOT ERROR:", error)
    );

    return () => unsubscribe();
  }, [todayDateKey]);

  const loadMyData = async (user) => {
    try {
      const timesheetQuery = query(
        collection(db, "timesheets"),
        where("email", "==", user.email)
      );
      const timesheetSnapshot = await getDocs(timesheetQuery);
      const timesheetData = timesheetSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMyTimesheets(timesheetData);

      // Assumes a "leaves" collection with fields: userId, status, days (or startDate/endDate)
      const leaveQuery = query(
        collection(db, "leaves"),
        where("userId", "==", user.uid)
      );
      const leaveSnapshot = await getDocs(leaveQuery);
      const leaveData = leaveSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMyLeaves(leaveData);
    } catch (error) {
      console.error(error);
    }
  };

  const loadAnnouncements = async () => {
    try {
      const q = query(
        collection(db, "announcements"),
        orderBy("createdAt", "desc"),
        limit(5)
      );
      const snap = await getDocs(q);
      setAnnouncements(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error("LOAD ANNOUNCEMENTS ERROR:", error);
    }
  };

  const loadTodayBirthdays = async () => {
    const snapshot = await getDocs(collection(db, "employeeProfiles"));

    const today = new Date();

    const list = snapshot.docs
      .map((d) => ({
        id: d.id,
        ...d.data(),
      }))
      .filter((emp) => {
        if (!emp.dob) return false;

        const dob = new Date(emp.dob);

        return (
          dob.getDate() === today.getDate() &&
          dob.getMonth() === today.getMonth()
        );
      });

    setTodayBirthdays(list);

    const current = auth.currentUser;

    if (current) {
      const mine = list.find((x) => x.id === current.uid);

      if (mine) {
        setShowBirthdayPopup(true);
      }
    }
  };

  // employee = the full birthday person object (not just the ID) so we
  // can also store a readable name on the wish doc for the "who wished
  // whom" table below, without needing to re-look it up later.
  const sendWish = async (employee) => {
    if (!wishText.trim()) return;

    const current = auth.currentUser;
    if (!current || !employee) return;

    await addDoc(collection(db, "birthdayWishes"), {
      from: current.uid,
      fromName: userName || current.email || "Someone",
      to: employee.id,
      toName:
        `${employee.firstName || ""} ${employee.lastName || ""}`.trim() ||
        employee.email ||
        "",
      message: wishText,
      date: todayDateKey,
      createdAt: serverTimestamp(),
    });

    setWishText("");
  };

  const loadUpcomingHolidays = async () => {
    const snapshot = await getDocs(collection(db, "holidays"));
    const today = new Date();

    const holidays = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((item) => new Date(item.date) >= today)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 5);

    setUpcomingHolidays(holidays);
  };

  const totalHours = myTimesheets.reduce(
    (sum, item) => sum + Number(item.hours || 0),
    0
  );

  const avgHours =
    myAttendance.length > 0 ? (totalHours / myAttendance.length).toFixed(1) : 0;

  const totalAttendance = myAttendance.length;
  const totalTimesheets = myTimesheets.length;

  // Use `||` (not `??`) so an accidental empty string from an in-progress
  // HR edit falls back to "Pending" instead of rendering a blank badge.
  const performance =
    userData?.performance || userData?.performanceRating || "Pending";
  console.log("userData:", userData);
  console.log("performance:", userData?.performance);

  const performanceColor =
    performance === "Outstanding"
      ? "#16a34a"
      : performance === "Excellent"
      ? "#22c55e"
      : performance === "Very Good"
      ? "#3b82f6"
      : performance === "Good"
      ? "#f59e0b"
      : performance === "Average"
      ? "#f97316"
      : performance === "Needs Improvement"
      ? "#dc2626"
      : "#64748b";

  // ---------- LEAVE BALANCE ----------
  const leaveAllocation =
    userData?.leaveAllocation || DEFAULT_LEAVE_ALLOCATION;

  const approvedLeaveDays = myLeaves
    .filter((l) => (l.status || "").toLowerCase() === "approved")
    .reduce((sum, l) => sum + Number(l.days || 1), 0);

  const pendingLeaveDays = myLeaves
    .filter((l) => (l.status || "").toLowerCase() === "pending")
    .reduce((sum, l) => sum + Number(l.days || 1), 0);

  const leaveRemaining = Math.max(leaveAllocation - approvedLeaveDays, 0);

  const leavePieData = [
    { name: "Used", value: approvedLeaveDays },
    { name: "Remaining", value: leaveRemaining },
  ];
  const LEAVE_PIE_COLORS = [COLORS.warning, COLORS.success];

  // ---------- CHART DATA: last 14 days attendance + hours trend ----------
  const chartData = buildTrendData(myAttendance, myTimesheets);

  // ---------- TODAY'S CHECK-IN STATUS ----------
  // Attendance records are written with "PunchIn"/"PunchOut" fields (see
  // app/attendance/page.js's punchIn()/punchOut()) — this used to read
  // "checkIn"/"checkOut", which never existed on the record, so this
  // card always showed "not checked in" even right after punching in.
  const todayKey = new Date().toISOString().split("T")[0];
  const todayRecord = myAttendance.find((a) => normalizeDate(a.date) === todayKey);
  const checkInTime = formatTime(todayRecord?.PunchIn);
  const checkOutTime = formatTime(todayRecord?.PunchOut);

  // ---------- PAYSLIP (already available under My Documents) ----------
  const latestPayslipUrl = userData?.documents?.salarySlip || null;

  const currentUid = auth.currentUser?.uid;

  // Wishes the CURRENT user has already sent today, keyed by recipient
  // ID — sourced from Firestore (todayWishes) rather than local state,
  // so "already wished" is correct even after a reload or on another
  // device/tab.
  const myWishesSentTo = new Set(
    todayWishes.filter((w) => w.from === currentUid).map((w) => w.to)
  );

  // Gates the "Wishes You've Received Today" table — only the birthday
  // person themself should see who wished them, and only their own
  // wishes (not other colleagues' if more than one birthday falls on
  // the same day).
  const isMyBirthdayToday = todayBirthdays.some((emp) => emp.id === currentUid);
  const myWishesReceived = todayWishes.filter((w) => w.to === currentUid);

  const cardStyle = {
    background: COLORS.background,
    borderRadius: 20,
    padding: "30px",
    textAlign: "center",
    border: `1px solid ${COLORS.soft}`,
    boxShadow: "0 10px 30px rgba(0,0,0,.06)",
    transition: ".3s",
  };

  return (
    <div
      className="dash-wrapper"
      style={{
        width: "100%",
        padding: "8px",
        background: "var(--bg-color)",
        minHeight: "100%",
        boxSizing: "border-box",
        overflowX: "hidden",
      }}
    >
      {/* Responsive rules: inline style objects can't hold media queries,
          so layout breakpoints for grids / spacing / font sizes live here. */}
      <style jsx>{`
        .dash-hero {
          padding: clamp(24px, 4vw, 36px) clamp(22px, 5vw, 40px);
        }
        .dash-hero-title {
          font-size: clamp(20px, 4vw, 28px);
        }

        /* Avatar nudged down so its bottom half naturally peeks past
           the card's rounded edge (the hero container has
           overflow:visible to allow this) — like a floating character
           resting against the banner. */
        .dash-hero-avatar-wrap {
          top: 26px;
        }

        /* Small floating music notes near the avatar's headphones,
           each drifting up/down on its own gentle cycle. */
        .dash-hero-note {
          position: absolute;
          font-size: 20px;
          opacity: 0.85;
          animation: dash-note-float 3s ease-in-out infinite;
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.15));
        }
        .dash-hero-note-1 {
          top: 10px;
          left: -6px;
          animation-delay: 0s;
        }
        .dash-hero-note-2 {
          top: 44px;
          left: -22px;
          font-size: 15px;
          animation-delay: 1.1s;
        }
        @keyframes dash-note-float {
          0%,
          100% {
            transform: translateY(0) rotate(-4deg);
          }
          50% {
            transform: translateY(-10px) rotate(4deg);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .dash-hero-note {
            animation: none;
          }
        }

        @media (max-width: 900px) {
          .dash-hero-avatar-wrap :global(svg) {
            width: 130px !important;
            height: 154px !important;
          }
          .dash-hero-avatar-wrap {
            top: 18px;
          }
        }
        @media (max-width: 640px) {
          .dash-hero-row {
            flex-direction: column;
            align-items: center !important;
            text-align: center;
          }
          .dash-hero-avatar-wrap {
            top: 0;
            margin-bottom: 4px;
          }
          .dash-hero-text {
            padding-bottom: 0 !important;
          }
          .dash-hero-text > div {
            justify-content: center;
          }
          .dash-hero-plant {
            display: none;
          }
          .dash-hero-date {
            position: static !important;
            display: inline-flex !important;
            margin-bottom: 14px;
          }
        }
        .dash-charts-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 25px;
          margin-bottom: 35px;
        }
        .dash-summary-grid {
          display: grid;
          grid-template-columns: 350px 350px 1fr;
          gap: 25px;
          margin-bottom: 35px;
        }
        .dash-today-status {
          padding: 24px 30px;
        }
        @media (max-width: 900px) {
          .dash-summary-grid {
            grid-template-columns: 1fr 1fr;
          }
          .dash-summary-grid > div:last-child {
            grid-column: 1 / -1;
          }
        }
        @media (max-width: 768px) {
          .dash-charts-grid {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 600px) {
          .dash-wrapper {
            padding: 4px;
          }
          .dash-today-status {
            padding: 18px 20px !important;
            flex-direction: column;
            align-items: flex-start !important;
          }
          .dash-today-status button {
            width: 100%;
          }
          .dash-summary-grid {
            grid-template-columns: 1fr;
          }
          .dash-summary-grid > div:last-child {
            grid-column: auto;
          }
          h2 {
            font-size: 19px !important;
          }
        }

        /* ============ Birthday card + wishes table (mobile) ============ */
        .birthday-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid #eee;
          gap: 12px;
          flex-wrap: wrap;
        }
        .wishes-table-wrap {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        @media (max-width: 480px) {
          .birthday-row {
            flex-direction: column;
            align-items: flex-start;
          }
          .birthday-row button,
          .birthday-row .birthday-self-tag {
            width: 100%;
            text-align: center;
            box-sizing: border-box;
          }
        }

        /* ============ Birthday popup + confetti burst ============ */
        .birthday-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.55);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 9999;
          overflow: hidden;
        }
        .confetti-piece {
          position: absolute;
          top: -20px;
          width: 9px;
          height: 14px;
          opacity: 0.9;
          animation-name: confetti-fall;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        @keyframes confetti-fall {
          0% {
            transform: translateY(-10vh) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(110vh) rotate(540deg);
            opacity: 0.9;
          }
        }
        .birthday-modal {
          position: relative;
          background: #fff;
          border-radius: 24px;
          padding: 40px 45px;
          text-align: center;
          max-width: 380px;
          width: 90%;
          box-shadow: 0 25px 60px rgba(0, 0, 0, 0.3);
          animation: birthday-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        @keyframes birthday-pop {
          0% {
            transform: scale(0.4);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        .birthday-emoji-row {
          font-size: 44px;
          margin-bottom: 8px;
          animation: birthday-bounce 1.4s ease-in-out infinite;
        }
        @keyframes birthday-bounce {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-8px);
          }
        }
      `}</style>

      {/* ================= WELCOME HERO ================= */}
      <div
        className="dash-hero"
        style={{
          background: `linear-gradient(135deg, ${COLORS.primary}, #2c517f)`,
          color: "#fff",
          borderRadius: 26,
          padding: "36px 40px",
          marginBottom: 35,
          boxShadow: "0 16px 40px rgba(61,111,168,.28)",
          position: "relative",
          overflow: "visible",
        }}
      >
        {/* Date pill — top right */}
        <div
          className="dash-hero-date"
          style={{
            position: "absolute",
            top: 28,
            right: 34,
            background: "rgba(255,255,255,.18)",
            padding: "8px 16px",
            borderRadius: 999,
            fontWeight: 600,
            color: "#fff",
            fontSize: 13.5,
            display: "flex",
            alignItems: "center",
            gap: 6,
            whiteSpace: "nowrap",
          }}
        >
          📅 {new Date().toDateString()}
        </div>

        {/* Plant decoration — bottom right, small + subtle */}
        <div className="dash-hero-plant" style={{ position: "absolute", right: 30, bottom: 16 }}>
          <PlantDecoration size={52} />
        </div>

        <div className="dash-hero-row" style={{ display: "flex", alignItems: "flex-end", gap: 26, flexWrap: "wrap" }}>
          {/* Avatar — always the illustrated mascot (never the real
              uploaded photo, which shows in the top bar / profile card
              instead). Positioned to peek slightly below the card edge,
              like a floating character. */}
          <div className="dash-hero-avatar-wrap" style={{ position: "relative", flexShrink: 0 }}>
            <HeroAvatar gender={userData?.gender} size={170} />
            <span className="dash-hero-note dash-hero-note-1" aria-hidden>🎵</span>
            <span className="dash-hero-note dash-hero-note-2" aria-hidden>🎵</span>
          </div>

          {/* Greeting + chips */}
          <div className="dash-hero-text" style={{ paddingBottom: 8, minWidth: 0 }}>
            <h1 className="dash-hero-title" style={{ margin: 0, fontWeight: 700 }}>
              👋 Welcome Back, {(userData?.firstName || userName || "").split(" ")[0] || "there"}!
            </h1>
            <p style={{ marginTop: 8, opacity: 0.9, fontSize: 14.5 }}>
              Track attendance, productivity and timesheets.
            </p>

            <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
              <span
                style={{
                  background: "rgba(255,255,255,.18)",
                  padding: "6px 14px",
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                🪪 ID: {userData?.employeeId || "Not Assigned"}
              </span>
              <span
                style={{
                  background: "rgba(255,255,255,.18)",
                  padding: "6px 14px",
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                ✉️ Official email: {userData?.officialEmail || "Not Set"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ================= PROFILE SUMMARY CARD ================= */}
      <div
        style={{
          background: "var(--card-bg)",
          borderRadius: 20,
          padding: "22px 28px",
          marginBottom: 35,
          border: `1px solid ${COLORS.soft}`,
          boxShadow: "0 8px 24px rgba(0,0,0,.05)",
          display: "flex",
          alignItems: "center",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        {userData?.profilePhoto ? (
          <img
            src={userData.profilePhoto}
            alt={userName || "Profile"}
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              objectFit: "cover",
              flexShrink: 0,
              border: `2px solid ${COLORS.primary}`,
            }}
          />
        ) : userData?.gender ? (
          <div style={{ width: 64, height: 64, borderRadius: "50%", flexShrink: 0, overflow: "hidden" }}>
            <AvatarIllustration gender={userData.gender} size={64} />
          </div>
        ) : (
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              flexShrink: 0,
              background: `linear-gradient(135deg,${COLORS.primary},${COLORS.accent})`,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              fontWeight: 700,
            }}
          >
            {(userData?.firstName?.[0] || auth.currentUser?.email?.[0] || "U").toUpperCase()}
          </div>
        )}

        <div style={{ flex: 1, minWidth: 180 }}>
          <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: COLORS.text }}>
            {userName || "Complete your profile"}
          </h2>
          <p style={{ margin: "4px 0 0", color: COLORS.secondary, fontSize: 14 }}>
            {[userData?.designation, userData?.department].filter(Boolean).join(" • ") ||
              "Designation and department not set yet"}
          </p>
        </div>

        <button
          onClick={() => (window.location.href = "/profile")}
          style={{
            background: "var(--bg-color)",
            color: COLORS.primary,
            border: `2px solid ${COLORS.primary}`,
            padding: "10px 20px",
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 13.5,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          View / Edit Profile
        </button>
      </div>

      {/* ================= OWN BIRTHDAY POPUP (confetti burst) ================= */}
      {showBirthdayPopup && (
        <div className="birthday-overlay">
          {Array.from({ length: 60 }).map((_, i) => (
            <span
              key={i}
              className="confetti-piece"
              style={{
                left: `${Math.random() * 100}%`,
                background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                animationDuration: `${2 + Math.random() * 2.5}s`,
                animationDelay: `${Math.random() * 2}s`,
                borderRadius: i % 3 === 0 ? "50%" : "2px",
              }}
            />
          ))}

          <div className="birthday-modal">
            <div className="birthday-emoji-row">🎂🎉🎈</div>
            <h1 style={{ margin: "0 0 6px", color: "#0f172a", fontSize: 26 }}>
              Happy Birthday!
            </h1>
            <h2 style={{ margin: "0 0 14px", color: COLORS.primary, fontSize: 22 }}>
              {userName}
            </h2>
            <p style={{ color: "#475569", fontSize: 15, marginBottom: 26 }}>
              Wishing you happiness, success and lots of joy, today and always. 🎉
            </p>
            <button
              onClick={() => setShowBirthdayPopup(false)}
              style={{
                background: COLORS.primary,
                color: "#fff",
                border: "none",
                padding: "12px 34px",
                borderRadius: 10,
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Thank you 🎉
            </button>
          </div>
        </div>
      )}

      {/* ================= TODAY'S STATUS ================= */}
      {widgets.showAttendance && (
      <div
        className="dash-today-status"
        style={{
          background: "var(--card-bg)",
          borderRadius: 18,
          padding: "24px 30px",
          marginBottom: 35,
          border: `1px solid ${COLORS.soft}`,
          boxShadow: "0 8px 24px rgba(0,0,0,.05)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: "50%",
              background: checkInTime ? "#dcfce7" : COLORS.soft,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
            }}
          >
            {checkInTime ? "✅" : "🕒"}
          </div>
          <div>
            <h3 style={{ margin: 0, color: "#0f172a", fontSize: 17 }}>
              {checkInTime ? "You're checked in today" : "You haven't checked in today"}
            </h3>
            <p style={{ margin: "4px 0 0", color: COLORS.secondary, fontSize: 14 }}>
              {checkInTime
                ? `In: ${checkInTime}${checkOutTime ? `  •  Out: ${checkOutTime}` : "  •  Still working"}`
                : "Mark your attendance to start tracking today's hours."}
            </p>
          </div>
        </div>

        <button
          onClick={() => (window.location.href = "/attendance")}
          style={{
            background: checkInTime ? "var(--card-bg)" : COLORS.primary,
            color: checkInTime ? COLORS.primary : "#fff",
            border: `2px solid ${COLORS.primary}`,
            padding: "12px 24px",
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          {checkInTime ? "View Attendance" : "Check In"}
        </button>
      </div>
      )}

      {/* ================= QUICK ACTIONS ================= */}
      <h2 style={{ marginBottom: "20px", color: "#0f172a", fontWeight: 700 }}>
        🚀 Quick Actions
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: "20px",
          marginBottom: "35px",
        }}
      >
        <div style={actionCard} onClick={() => (window.location.href = "/attendance")}>
          <h3>🕒 Attendance</h3>
          <p>View attendance history</p>
        </div>

        <div style={actionCard} onClick={() => (window.location.href = "/timesheet")}>
          <h3>📋 Timesheets</h3>
          <p>Submit & View Timesheets</p>
        </div>

        <div style={actionCard} onClick={() => (window.location.href = "/leave")}>
          <h3>🏖 Leave</h3>
          <p>Apply & Track Leave</p>
        </div>

        <div style={actionCard} onClick={() => (window.location.href = "/documents")}>
          <h3>📄 My Documents</h3>
          <p>Payslips & HR Documents</p>
        </div>

        <div style={actionCard} onClick={() => (window.location.href = "/workspace")}>
          <h3>🤖 AI Workspace</h3>
          <p>Open AI Tools</p>
        </div>
      </div>

      {/* ================= DASHBOARD STATS ================= */}
      <h2 style={{ marginBottom: "20px", color: "#0f172a", fontWeight: 700 }}>
        📊 Dashboard Overview
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
          gap: "20px",
          marginBottom: "35px",
        }}
      >
        <div style={cardStyle}>
          <div style={{ fontSize: 42, marginBottom: 15 }}>📅</div>
          <h1 style={{ color: COLORS.primary, marginBottom: 10 }}>{totalAttendance}</h1>
          <h3 style={{ color: COLORS.text }}>Attendance</h3>
          <p style={{ color: COLORS.secondary }}>Days Present</p>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: 42 }}>⏰</div>
          <h1 style={{ color: COLORS.primary }}>{totalHours}</h1>
          <h3>Total Hours</h3>
          <p style={{ color: COLORS.secondary }}>Working Hours</p>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: 42 }}>📝</div>
          <h1 style={{ color: COLORS.primary }}>{totalTimesheets}</h1>
          <h3>Timesheets</h3>
          <p style={{ color: COLORS.secondary }}>Submitted</p>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: 42 }}>📈</div>
          <h1 style={{ color: COLORS.primary }}>{avgHours}</h1>
          <h3>Average Hours</h3>
          <p style={{ color: COLORS.secondary }}>Per Attendance</p>
        </div>

        <div
          style={{ ...cardStyle, cursor: "pointer" }}
          onClick={() => (window.location.href = "/documents")}
        >
          <div style={{ fontSize: 42 }}>💰</div>
          <h1 style={{ color: latestPayslipUrl ? COLORS.success : COLORS.secondary, fontSize: 22 }}>
            {latestPayslipUrl ? "Available" : "Not Uploaded"}
          </h1>
          <h3>Latest Payslip</h3>
          <p style={{ color: COLORS.secondary }}>
            {latestPayslipUrl ? "View in My Documents" : "Check back after payroll"}
          </p>
        </div>
      </div>

      {/* ================= CHARTS ================= */}
      <h2 style={{ marginBottom: "20px", color: "#0f172a", fontWeight: 700 }}>
        📉 Trends
      </h2>

      <div className="dash-charts-grid">
        <div
          style={{
            background: "var(--card-bg)",
            borderRadius: 22,
            padding: 30,
            border: `1px solid ${COLORS.soft}`,
            boxShadow: "0 10px 30px rgba(0,0,0,.06)",
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: 20, color: COLORS.text }}>
            Hours Logged (Last 14 Days)
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.soft} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="hours"
                stroke={COLORS.primary}
                strokeWidth={3}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div
          style={{
            background: "var(--card-bg)",
            borderRadius: 22,
            padding: 30,
            border: `1px solid ${COLORS.soft}`,
            boxShadow: "0 10px 30px rgba(0,0,0,.06)",
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: 20, color: COLORS.text }}>
            Attendance (Last 14 Days)
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.soft} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="present" fill={COLORS.accent} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ================= PERFORMANCE + LEAVE BALANCE ================= */}
      <div className="dash-summary-grid">
        {/* Performance */}
        <div
          style={{
            background: "var(--card-bg)",
            padding: "clamp(20px, 5vw, 35px)",
            borderRadius: 22,
            border: `1px solid ${COLORS.soft}`,
            boxShadow: "0 10px 30px rgba(0,0,0,.08)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 85,
              height: 85,
              margin: "auto",
              borderRadius: "50%",
              background: COLORS.primary,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              fontSize: 38,
              color: "#fff",
            }}
          >
            🏆
          </div>

          <h2 style={{ marginTop: 20, color: COLORS.text }}>Performance</h2>

          <div
            style={{
              display: "inline-block",
              marginTop: 20,
              padding: "14px 38px",
              background: `${performanceColor}15`,
              color: performanceColor,
              border: `2px solid ${performanceColor}`,
              borderRadius: "40px",
              fontSize: "24px",
              fontWeight: "700",
            }}
          >
            {performance}
          </div>

          <p
            style={{
              marginTop: 18,
              fontSize: "17px",
              fontWeight: "500",
              color: COLORS.secondary,
            }}
          >
            {performance === "Pending" ? "Awaiting HR Review" : "Rated by HR Department"}
          </p>

          <hr style={{ margin: "30px 0", borderColor: COLORS.soft }} />

          <small style={{ display: "block", marginTop: "15px", color: COLORS.secondary, fontSize: "15px" }}>
            <b>Last Updated</b>
            <br />
            {userData?.updatedAt?.seconds
              ? new Date(userData.updatedAt.seconds * 1000).toLocaleDateString("en-IN")
              : "--"}
          </small>
        </div>

        {/* Leave Balance */}
        {widgets.showLeave && (
        <div
          style={{
            background: "var(--card-bg)",
            padding: "clamp(20px, 5vw, 35px)",
            borderRadius: 22,
            border: `1px solid ${COLORS.soft}`,
            boxShadow: "0 10px 30px rgba(0,0,0,.08)",
            textAlign: "center",
          }}
        >
          <h2 style={{ marginTop: 0, color: COLORS.text }}>🏖 Leave Balance</h2>

          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={leavePieData}
                dataKey="value"
                innerRadius={45}
                outerRadius={70}
                paddingAngle={3}
              >
                {leavePieData.map((entry, index) => (
                  <Cell key={index} fill={LEAVE_PIE_COLORS[index]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>

          <h1 style={{ color: COLORS.success, margin: "10px 0 0" }}>{leaveRemaining}</h1>
          <p style={{ color: COLORS.secondary, margin: "0 0 20px" }}>Days Remaining</p>

          <div style={{ display: "flex", justifyContent: "space-around", fontSize: 14 }}>
            <div>
              <b style={{ color: COLORS.warning }}>{approvedLeaveDays}</b>
              <p style={{ color: COLORS.secondary, margin: 0 }}>Used</p>
            </div>
            <div>
              <b style={{ color: COLORS.accent }}>{pendingLeaveDays}</b>
              <p style={{ color: COLORS.secondary, margin: 0 }}>Pending</p>
            </div>
            <div>
              <b style={{ color: COLORS.text }}>{leaveAllocation}</b>
              <p style={{ color: COLORS.secondary, margin: 0 }}>Allocated</p>
            </div>
          </div>
        </div>
        )}

        <div
          style={{
            background: "var(--card-bg)",
            borderRadius: "22px",
            padding: "30px",
            boxShadow: "0 12px 35px rgba(0,0,0,.08)",
          }}
        >
          {/* 🎂 Today's Birthdays — everyone with a birthday today shows
              up here, INCLUDING the current user (who also gets the
              confetti popup separately). The current user just sees an
              "It's your day!" tag instead of a wish button. */}
          {widgets.showEmployee && (
          <div
            style={{
              background: "#FFF8E8",
              border: "1px solid #FFD36B",
              borderRadius: 16,
              padding: 20,
              marginBottom: 25,
            }}
          >
            <h2 style={{ marginTop: 0 }}>🎂 Today's Birthdays</h2>

            {todayBirthdays.length === 0 ? (
              <p style={{ color: "#666" }}>No birthdays today</p>
            ) : (
              todayBirthdays.map((emp) => {
                const isMe = emp.id === currentUid;
                const alreadySent = myWishesSentTo.has(emp.id);

                return (
                  <div key={emp.id} className="birthday-row">
                    <div>
                      <h3 style={{ margin: 0 }}>
                        {emp.firstName} {emp.lastName}
                        {isMe ? " (You)" : ""}
                      </h3>
                      <small>🎉 Have a wonderful birthday!</small>
                    </div>

                    {isMe ? (
                      <span
                        className="birthday-self-tag"
                        style={{
                          fontWeight: 700,
                          color: COLORS.primary,
                          padding: "10px 18px",
                        }}
                      >
                        🎉 It's your day!
                      </span>
                    ) : (
                      <button
                        disabled={alreadySent}
                        onClick={() => {
                          setSelectedEmployee(emp);
                          setShowWishModal(true);
                        }}
                        style={{
                          background: alreadySent
                            ? COLORS.soft
                            : "linear-gradient(135deg,#3d6fa8,#5b8fd9)",
                          color: alreadySent ? COLORS.secondary : "#fff",
                          border: "none",
                          borderRadius: 12,
                          padding: "12px 22px",
                          cursor: alreadySent ? "default" : "pointer",
                          fontWeight: "700",
                          boxShadow: alreadySent ? "none" : "0 4px 12px rgba(61,111,168,.3)",
                        }}
                      >
                        {alreadySent ? "✅ Wished" : "🎁 Wish Now"}
                      </button>
                    )}
                  </div>
                );
              })
            )}

            {/* 💌 Wishes received today — ONLY visible to the person
                whose birthday it actually is today, and only shows
                wishes sent TO them (not to other colleagues who might
                also have a birthday the same day). */}
            {isMyBirthdayToday && myWishesReceived.length > 0 && (
              <div style={{ marginTop: 22 }}>
                <h3 style={{ margin: "0 0 12px", fontSize: 16, color: "#0f172a" }}>
                  💌 Wishes You've Received Today
                </h3>

                <div className="wishes-table-wrap">
                  <table
                    style={{
                      width: "100%",
                      minWidth: 320,
                      borderCollapse: "collapse",
                      background: "#fff",
                      borderRadius: 10,
                      overflow: "hidden",
                    }}
                  >
                    <thead>
                      <tr>
                        <th style={wishTh}>From</th>
                        <th style={wishTh}>Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myWishesReceived.map((w) => (
                        <tr key={w.id}>
                          <td style={wishTd}>{w.fromName || "Someone"}</td>
                          <td style={wishTd}>{w.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          )}

          {/* 🎉 Upcoming Holidays */}
          {widgets.showHoliday && (
          <div className="holiday-section">
            <div className="holiday-header">
              <h2>🎉 Upcoming Holidays</h2>
              <p>Plan your upcoming days off</p>
            </div>

            <div className="holiday-marquee">
              <div className="holiday-track">
                {upcomingHolidays.map((item) => (
                  <span key={item.id}>
                    🎉 {item.name || item.holidayName}
                    &nbsp; 📅 {item.date}
                    &nbsp;&nbsp; | &nbsp;&nbsp;
                  </span>
                ))}
              </div>
            </div>

            <div className="holiday-list">
              {upcomingHolidays.length === 0 ? (
                <p>No upcoming holidays</p>
              ) : (
                upcomingHolidays.map((item) => (
                  <div className="holiday-card" key={item.id}>
                    <div className="holiday-icon">🎊</div>

                    <div className="holiday-info">
                      <h3>{item.name || item.holidayName}</h3>
                      <p>📅 {item.date}</p>
                    </div>

                    <span className="holiday-category">
                      {item.category || item.type}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
          )}
        </div>
      </div>

      {showWishModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
            padding: 16,
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              background: "#fff",
              width: 450,
              maxWidth: "100%",
              borderRadius: 20,
              padding: 25,
              boxSizing: "border-box",
            }}
          >
            <h2>🎂 Send Birthday Wish</h2>

            <p>
              To: <b>{selectedEmployee?.firstName} {selectedEmployee?.lastName}</b>
            </p>

            <textarea
              rows={5}
              value={wishText}
              onChange={(e) => setWishText(e.target.value)}
              placeholder="Write your birthday wishes..."
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 10,
                border: "1px solid #ccc",
                boxSizing: "border-box",
              }}
            />

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                marginTop: 20,
                flexWrap: "wrap",
              }}
            >
              <button onClick={() => setShowWishModal(false)}>
                Cancel
              </button>

              <button
                onClick={() => {
                  sendWish(selectedEmployee);
                  setShowWishModal(false);
                }}
                style={{
                  background: "#3d6fa8",
                  color: "#fff",
                  border: "none",
                  padding: "10px 18px",
                  borderRadius: 8,
                }}
              >
                🎉 Send Wish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Builds a 14-day trend array combining attendance presence and timesheet hours,
 * grouped by date. Expects attendance docs to have a "date" field and
 * timesheet docs to have "date" and "hours" fields (adjust field names below
 * if your schema differs).
 */
function buildTrendData(attendance, timesheets) {
  const days = [];
  const today = new Date();

  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().split("T")[0];
    days.push({
      key,
      label: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      hours: 0,
      present: 0,
    });
  }

  const dayMap = Object.fromEntries(days.map((d) => [d.key, d]));

  attendance.forEach((a) => {
    const dateKey = normalizeDate(a.date);
    if (dateKey && dayMap[dateKey]) {
      dayMap[dateKey].present = 1;
    }
  });

  timesheets.forEach((t) => {
    const dateKey = normalizeDate(t.date);
    if (dateKey && dayMap[dateKey]) {
      dayMap[dateKey].hours += Number(t.hours || 0);
    }
  });

  return days;
}

function formatTime(value) {
  if (!value) return null;
  const d = value.seconds ? new Date(value.seconds * 1000) : new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function normalizeDate(value) {
  if (!value) return null;
  if (value.seconds) return new Date(value.seconds * 1000).toISOString().split("T")[0];
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[0];
}

// Small decorative plant pot for the welcome hero's bottom-right corner
// — purely visual, matches the reference design's "cozy desk" touch.
function PlantDecoration({ size = 52 }) {
  return (
    <svg viewBox="0 0 60 64" width={size} height={size} role="img" aria-hidden="true">
      <ellipse cx="30" cy="60" rx="14" ry="3" fill="#000" opacity="0.12" />
      <path d="M14 40h32l-4 20a4 4 0 0 1-4 3.4H22a4 4 0 0 1-4-3.4z" fill="#8fb8e0" />
      <path d="M14 40h32l-1.5 7h-29z" fill="#a9cdf0" />
      <path
        d="M30 40c-2-10-12-12-16-9 2 6 8 9 16 9z"
        fill="#4d9b6a"
      />
      <path
        d="M30 40c2-14 14-17 19-13-2 8-10 13-19 13z"
        fill="#5fb87e"
      />
      <path
        d="M30 40c-1-8-8-19-2-25 5 5 6 17 2 25z"
        fill="#79cf95"
      />
    </svg>
  );
}

const actionCard = {
  background: "var(--card-bg)",
  border: `1px solid ${COLORS.soft}`,
  borderRadius: 18,
  padding: "22px",
  cursor: "pointer",
  transition: ".3s",
  boxShadow: "0 6px 18px rgba(0,0,0,.05)",
};

const wishTh = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: 13,
  fontWeight: 700,
  color: "#475569",
  background: "#f1f5f9",
  borderBottom: "1px solid #e2e8f0",
};

const wishTd = {
  padding: "10px 12px",
  fontSize: 13.5,
  color: "#0f172a",
  borderBottom: "1px solid #f1f5f9",
};

// "use client";

// import { useEffect, useState } from "react";
// import {
//   collection,
//   getDocs,
//   doc,
//   getDoc,
//   query,
//   where,
//    orderBy, limit
// } from "firebase/firestore";
// import { auth, db } from "../../lib/firebase";
// import { onAuthStateChanged } from "firebase/auth";
// import {
//   ResponsiveContainer,
//   LineChart,
//   Line,
//   BarChart,
//   Bar,
//   XAxis,
//   YAxis,
//   Tooltip,
//   CartesianGrid,
//   PieChart,
//   Pie,
//   Cell,
// } from "recharts";

// const COLORS = {
//   background: "#ffffff",
//   text: "#111111",
//   secondary: "#444444",

//   primary: "#3d6fa8", // Main Brand Blue
//   accent: "#66a8e0", // Accent Blue
//   soft: "#eaf3ff", // Light Background

//   success: "#16a34a",
//   warning: "#ea580c",
//   danger: "#dc2626",

//   border: "#d9e8f8",
//   shadow: "rgba(61,111,168,0.15)",
// };

// // Default annual leave allocation, used if the user doc has no explicit value
// const DEFAULT_LEAVE_ALLOCATION = 24;

// export default function DashboardPage() {
//   const [myTimesheets, setMyTimesheets] = useState([]);
//   const [myAttendance, setMyAttendance] = useState([]);
//   const [myLeaves, setMyLeaves] = useState([]);
//   const [userName, setUserName] = useState("");
//   const [userData, setUserData] = useState(null);
//   const [upcomingHolidays, setUpcomingHolidays] = useState([]);

//   useEffect(() => {
//     const unsubscribe = onAuthStateChanged(auth, async (user) => {
//       if (!user) {
//         window.location.href = "/login";
//         return;
//       }

// const userRef = doc(db, "users", user.uid);
// const employeeRef = doc(db, "employees", user.uid);

// const [userSnap, employeeSnap] = await Promise.all([
//   getDoc(userRef),
//   getDoc(employeeRef),
// ]);

// const userDataFromDb = userSnap.exists() ? userSnap.data() : {};
// const employeeData = employeeSnap.exists() ? employeeSnap.data() : {};

// const finalData = {
//   ...userDataFromDb,
//   ...employeeData,
// };

// setUserData(finalData);

// setUserName(
//   `${finalData.firstName || ""} ${finalData.lastName || ""}`.trim()
// );

// console.log("FINAL DATA", finalData);

//       await loadMyData(user);
//     });

//     return () => unsubscribe();
//   }, []);

//   useEffect(() => {
//     loadUpcomingHolidays();
//   }, []);

//   const loadMyData = async (user) => {
//     try {
//       const attendanceQuery = query(
//         collection(db, "attendance"),
//         where("userId", "==", user.uid)
//       );
//       const attendanceSnapshot = await getDocs(attendanceQuery);
//       const attendanceData = attendanceSnapshot.docs.map((doc) => ({
//         id: doc.id,
//         ...doc.data(),
//       }));
//       setMyAttendance(attendanceData);

//       const timesheetQuery = query(
//         collection(db, "timesheets"),
//         where("email", "==", user.email)
//       );
//       const timesheetSnapshot = await getDocs(timesheetQuery);
//       const timesheetData = timesheetSnapshot.docs.map((doc) => ({
//         id: doc.id,
//         ...doc.data(),
//       }));
//       setMyTimesheets(timesheetData);

//       // Assumes a "leaves" collection with fields: userId, status, days (or startDate/endDate)
//       const leaveQuery = query(
//         collection(db, "leaves"),
//         where("userId", "==", user.uid)
//       );
//       const leaveSnapshot = await getDocs(leaveQuery);
//       const leaveData = leaveSnapshot.docs.map((doc) => ({
//         id: doc.id,
//         ...doc.data(),
//       }));
//       setMyLeaves(leaveData);
//     } catch (error) {
//       console.error(error);
//     }
//   };
// const [announcements, setAnnouncements] = useState([]);

// useEffect(() => {
//   loadAnnouncements();
// }, []);

// const loadAnnouncements = async () => {
//   try {
//     const q = query(
//       collection(db, "announcements"),
//       orderBy("createdAt", "desc"),
//       limit(5)
//     );
//     const snap = await getDocs(q);
//     setAnnouncements(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
//   } catch (error) {
//     console.error("LOAD ANNOUNCEMENTS ERROR:", error);
//   }
// };
//   const loadUpcomingHolidays = async () => {
//     const snapshot = await getDocs(collection(db, "holidays"));
//     const today = new Date();

//     const holidays = snapshot.docs
//       .map((doc) => ({ id: doc.id, ...doc.data() }))
//       .filter((item) => new Date(item.date) >= today)
//       .sort((a, b) => new Date(a.date) - new Date(b.date))
//       .slice(0, 5);

//     setUpcomingHolidays(holidays);
//   };

//   const totalHours = myTimesheets.reduce(
//     (sum, item) => sum + Number(item.hours || 0),
//     0
//   );

//   const avgHours =
//     myAttendance.length > 0 ? (totalHours / myAttendance.length).toFixed(1) : 0;

//   const totalAttendance = myAttendance.length;
//   const totalTimesheets = myTimesheets.length;

//   const performance =
//   userData?.performance ??
//   userData?.performanceRating ??
//   "Pending";

//   const performanceColor =
//     performance === "Outstanding"
//       ? "#16a34a"
//       : performance === "Excellent"
//       ? "#22c55e"
//       : performance === "Very Good"
//       ? "#3b82f6"
//       : performance === "Good"
//       ? "#f59e0b"
//       : performance === "Average"
//       ? "#f97316"
//       : performance === "Needs Improvement"
//       ? "#dc2626"
//       : "#64748b";

//   // ---------- LEAVE BALANCE ----------
//   const leaveAllocation =
//     userData?.leaveAllocation || DEFAULT_LEAVE_ALLOCATION;

//   const approvedLeaveDays = myLeaves
//     .filter((l) => (l.status || "").toLowerCase() === "approved")
//     .reduce((sum, l) => sum + Number(l.days || 1), 0);

//   const pendingLeaveDays = myLeaves
//     .filter((l) => (l.status || "").toLowerCase() === "pending")
//     .reduce((sum, l) => sum + Number(l.days || 1), 0);

//   const leaveRemaining = Math.max(leaveAllocation - approvedLeaveDays, 0);

//   const leavePieData = [
//     { name: "Used", value: approvedLeaveDays },
//     { name: "Remaining", value: leaveRemaining },
//   ];
//   const LEAVE_PIE_COLORS = [COLORS.warning, COLORS.success];

//   // ---------- CHART DATA: last 14 days attendance + hours trend ----------
//   const chartData = buildTrendData(myAttendance, myTimesheets);

//   // ---------- TODAY'S CHECK-IN STATUS ----------
//   // Assumes attendance docs have "date", "checkIn", "checkOut" fields —
//   // adjust field names below if your schema differs.
//   const todayKey = new Date().toISOString().split("T")[0];
//   const todayRecord = myAttendance.find((a) => normalizeDate(a.date) === todayKey);
//   const checkInTime = formatTime(todayRecord?.checkIn);
//   const checkOutTime = formatTime(todayRecord?.checkOut);

//   // ---------- PAYSLIP (already available under My Documents) ----------
//   const latestPayslipUrl = userData?.documents?.salarySlip || null;

//   const cardStyle = {
//     background: COLORS.background,
//     borderRadius: 20,
//     padding: "30px",
//     textAlign: "center",
//     border: `1px solid ${COLORS.soft}`,
//     boxShadow: "0 10px 30px rgba(0,0,0,.06)",
//     transition: ".3s",
//   };

//   return (
//     <div
//       style={{
//         width: "100%",
//         padding: "8px",
//         background: "#F5F7FB",
//         minHeight: "100%",
//       }}
//     >
//       {/* Header */}
//       <div
//         style={{
//           background: COLORS.primary,
//           color: "#fff",
//           borderRadius: 22,
//           padding: "35px",
//           display: "flex",
//           justifyContent: "space-between",
//           alignItems: "center",
//           marginBottom: 35,
//           boxShadow: "0 12px 30px rgba(61,111,168,.25)",
//           flexWrap: "wrap",
//           gap: 20,
//         }}
//       >
//         <div>
//           <h1 style={{ margin: 0, fontSize: 34, fontWeight: 700 }}>
//             👋 Welcome Back{userName ? `, ${userName}` : ""}
//           </h1>
//           <p style={{ marginTop: 10, opacity: 0.9, fontSize: 16 }}>
//             Track attendance, productivity and timesheets.
//           </p>
//         </div>

//         <div
//           style={{
//             background: COLORS.accent,
//             padding: "15px 25px",
//             borderRadius: 15,
//             fontWeight: 600,
//             color: "#fff",
//           }}
//         >
//           {new Date().toDateString()}
//         </div>
//       </div>

//       {/* ================= TODAY'S STATUS ================= */}
//       <div
//         style={{
//           background: "#fff",
//           borderRadius: 18,
//           padding: "24px 30px",
//           marginBottom: 35,
//           border: `1px solid ${COLORS.soft}`,
//           boxShadow: "0 8px 24px rgba(0,0,0,.05)",
//           display: "flex",
//           justifyContent: "space-between",
//           alignItems: "center",
//           flexWrap: "wrap",
//           gap: 20,
//         }}
//       >
//         <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
//           <div
//             style={{
//               width: 54,
//               height: 54,
//               borderRadius: "50%",
//               background: checkInTime ? "#dcfce7" : COLORS.soft,
//               display: "flex",
//               alignItems: "center",
//               justifyContent: "center",
//               fontSize: 26,
//             }}
//           >
//             {checkInTime ? "✅" : "🕒"}
//           </div>
//           <div>
//             <h3 style={{ margin: 0, color: "#0f172a", fontSize: 17 }}>
//               {checkInTime ? "You're checked in today" : "You haven't checked in today"}
//             </h3>
//             <p style={{ margin: "4px 0 0", color: COLORS.secondary, fontSize: 14 }}>
//               {checkInTime
//                 ? `In: ${checkInTime}${checkOutTime ? `  •  Out: ${checkOutTime}` : "  •  Still working"}`
//                 : "Mark your attendance to start tracking today's hours."}
//             </p>
//           </div>
//         </div>

//         <button
//           onClick={() => (window.location.href = "/attendance")}
//           style={{
//             background: checkInTime ? "#fff" : COLORS.primary,
//             color: checkInTime ? COLORS.primary : "#fff",
//             border: `2px solid ${COLORS.primary}`,
//             padding: "12px 24px",
//             borderRadius: 10,
//             fontWeight: 700,
//             fontSize: 14,
//             cursor: "pointer",
//           }}
//         >
//           {checkInTime ? "View Attendance" : "Check In"}
//         </button>
//       </div>

//       {/* ================= QUICK ACTIONS ================= */}
//       <h2 style={{ marginBottom: "20px", color: "#0f172a", fontWeight: 700 }}>
//         🚀 Quick Actions
//       </h2>

//       <div
//         style={{
//           display: "grid",
//           gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
//           gap: "20px",
//           marginBottom: "35px",
//         }}
//       >
//         <div style={actionCard} onClick={() => (window.location.href = "/attendance")}>
//           <h3>🕒 Attendance</h3>
//           <p>View attendance history</p>
//         </div>

//         <div style={actionCard} onClick={() => (window.location.href = "/timesheet")}>
//           <h3>📋 Timesheets</h3>
//           <p>Submit & View Timesheets</p>
//         </div>

//         <div style={actionCard} onClick={() => (window.location.href = "/leave")}>
//           <h3>🏖 Leave</h3>
//           <p>Apply & Track Leave</p>
//         </div>

//         <div style={actionCard} onClick={() => (window.location.href = "/documents")}>
//           <h3>📄 My Documents</h3>
//           <p>Payslips & HR Documents</p>
//         </div>

//         <div style={actionCard} onClick={() => (window.location.href = "/workspace")}>
//           <h3>🤖 AI Workspace</h3>
//           <p>Open AI Tools</p>
//         </div>
//       </div>

//       {/* ================= DASHBOARD STATS ================= */}
//       <h2 style={{ marginBottom: "20px", color: "#0f172a", fontWeight: 700 }}>
//         📊 Dashboard Overview
//       </h2>

//       <div
//         style={{
//           display: "grid",
//           gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
//           gap: "20px",
//           marginBottom: "35px",
//         }}
//       >
//         <div style={cardStyle}>
//           <div style={{ fontSize: 42, marginBottom: 15 }}>📅</div>
//           <h1 style={{ color: COLORS.primary, marginBottom: 10 }}>{totalAttendance}</h1>
//           <h3 style={{ color: COLORS.text }}>Attendance</h3>
//           <p style={{ color: COLORS.secondary }}>Days Present</p>
//         </div>

//         <div style={cardStyle}>
//           <div style={{ fontSize: 42 }}>⏰</div>
//           <h1 style={{ color: COLORS.primary }}>{totalHours}</h1>
//           <h3>Total Hours</h3>
//           <p style={{ color: COLORS.secondary }}>Working Hours</p>
//         </div>

//         <div style={cardStyle}>
//           <div style={{ fontSize: 42 }}>📝</div>
//           <h1 style={{ color: COLORS.primary }}>{totalTimesheets}</h1>
//           <h3>Timesheets</h3>
//           <p style={{ color: COLORS.secondary }}>Submitted</p>
//         </div>

//         <div style={cardStyle}>
//           <div style={{ fontSize: 42 }}>📈</div>
//           <h1 style={{ color: COLORS.primary }}>{avgHours}</h1>
//           <h3>Average Hours</h3>
//           <p style={{ color: COLORS.secondary }}>Per Attendance</p>
//         </div>

//         <div
//           style={{ ...cardStyle, cursor: "pointer" }}
//           onClick={() => (window.location.href = "/documents")}
//         >
//           <div style={{ fontSize: 42 }}>💰</div>
//           <h1 style={{ color: latestPayslipUrl ? COLORS.success : COLORS.secondary, fontSize: 22 }}>
//             {latestPayslipUrl ? "Available" : "Not Uploaded"}
//           </h1>
//           <h3>Latest Payslip</h3>
//           <p style={{ color: COLORS.secondary }}>
//             {latestPayslipUrl ? "View in My Documents" : "Check back after payroll"}
//           </p>
//         </div>
//       </div>

//       {/* ================= CHARTS ================= */}
//       <h2 style={{ marginBottom: "20px", color: "#0f172a", fontWeight: 700 }}>
//         📉 Trends
//       </h2>

//       <div
//         style={{
//           display: "grid",
//           gridTemplateColumns: "1fr 1fr",
//           gap: "25px",
//           marginBottom: "35px",
//         }}
//       >
//         <div
//           style={{
//             background: "#fff",
//             borderRadius: 22,
//             padding: 30,
//             border: `1px solid ${COLORS.soft}`,
//             boxShadow: "0 10px 30px rgba(0,0,0,.06)",
//           }}
//         >
//           <h3 style={{ marginTop: 0, marginBottom: 20, color: COLORS.text }}>
//             Hours Logged (Last 14 Days)
//           </h3>
//           <ResponsiveContainer width="100%" height={260}>
//             <LineChart data={chartData}>
//               <CartesianGrid strokeDasharray="3 3" stroke={COLORS.soft} />
//               <XAxis dataKey="label" tick={{ fontSize: 12 }} />
//               <YAxis tick={{ fontSize: 12 }} />
//               <Tooltip />
//               <Line
//                 type="monotone"
//                 dataKey="hours"
//                 stroke={COLORS.primary}
//                 strokeWidth={3}
//                 dot={{ r: 3 }}
//               />
//             </LineChart>
//           </ResponsiveContainer>
//         </div>

//         <div
//           style={{
//             background: "#fff",
//             borderRadius: 22,
//             padding: 30,
//             border: `1px solid ${COLORS.soft}`,
//             boxShadow: "0 10px 30px rgba(0,0,0,.06)",
//           }}
//         >
//           <h3 style={{ marginTop: 0, marginBottom: 20, color: COLORS.text }}>
//             Attendance (Last 14 Days)
//           </h3>
//           <ResponsiveContainer width="100%" height={260}>
//             <BarChart data={chartData}>
//               <CartesianGrid strokeDasharray="3 3" stroke={COLORS.soft} />
//               <XAxis dataKey="label" tick={{ fontSize: 12 }} />
//               <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
//               <Tooltip />
//               <Bar dataKey="present" fill={COLORS.accent} radius={[6, 6, 0, 0]} />
//             </BarChart>
//           </ResponsiveContainer>
//         </div>
//       </div>

//       {/* ================= PERFORMANCE + LEAVE BALANCE ================= */}
//       <div
//         style={{
//           display: "grid",
//           gridTemplateColumns: "350px 350px 1fr",
//           gap: "25px",
//           marginBottom: "35px",
//         }}
//       >
//         {/* Performance */}
//         <div
//           style={{
//             background: "#fff",
//             padding: 35,
//             borderRadius: 22,
//             border: `1px solid ${COLORS.soft}`,
//             boxShadow: "0 10px 30px rgba(0,0,0,.08)",
//             textAlign: "center",
//           }}
//         >
//           <div
//             style={{
//               width: 85,
//               height: 85,
//               margin: "auto",
//               borderRadius: "50%",
//               background: COLORS.primary,
//               display: "flex",
//               justifyContent: "center",
//               alignItems: "center",
//               fontSize: 38,
//               color: "#fff",
//             }}
//           >
//             🏆
//           </div>

//           <h2 style={{ marginTop: 20, color: COLORS.text }}>Performance</h2>

//           <div
//             style={{
//               display: "inline-block",
//               marginTop: 20,
//               padding: "14px 38px",
//               background: `${performanceColor}15`,
//               color: performanceColor,
//               border: `2px solid ${performanceColor}`,
//               borderRadius: "40px",
//               fontSize: "24px",
//               fontWeight: "700",
//             }}
//           >
//             {performance}
//           </div>

//           <p
//             style={{
//               marginTop: 18,
//               fontSize: "17px",
//               fontWeight: "500",
//               color: COLORS.secondary,
//             }}
//           >
//             {performance === "Pending" ? "Awaiting HR Review" : "Rated by HR Department"}
//           </p>

//           <hr style={{ margin: "30px 0", borderColor: COLORS.soft }} />

//           <small style={{ display: "block", marginTop: "15px", color: COLORS.secondary, fontSize: "15px" }}>
//             <b>Last Updated</b>
//             <br />
//             {userData?.updatedAt?.seconds
//   ? new Date(userData.updatedAt.seconds * 1000).toLocaleDateString("en-IN")
//   : "--"}
//           </small>
//         </div>

//         {/* Leave Balance */}
//         <div
//           style={{
//             background: "#fff",
//             padding: 35,
//             borderRadius: 22,
//             border: `1px solid ${COLORS.soft}`,
//             boxShadow: "0 10px 30px rgba(0,0,0,.08)",
//             textAlign: "center",
//           }}
//         >
//           <h2 style={{ marginTop: 0, color: COLORS.text }}>🏖 Leave Balance</h2>

//           <ResponsiveContainer width="100%" height={160}>
//             <PieChart>
//               <Pie
//                 data={leavePieData}
//                 dataKey="value"
//                 innerRadius={45}
//                 outerRadius={70}
//                 paddingAngle={3}
//               >
//                 {leavePieData.map((entry, index) => (
//                   <Cell key={index} fill={LEAVE_PIE_COLORS[index]} />
//                 ))}
//               </Pie>
//               <Tooltip />
//             </PieChart>
//           </ResponsiveContainer>

//           <h1 style={{ color: COLORS.success, margin: "10px 0 0" }}>{leaveRemaining}</h1>
//           <p style={{ color: COLORS.secondary, margin: "0 0 20px" }}>Days Remaining</p>

//           <div style={{ display: "flex", justifyContent: "space-around", fontSize: 14 }}>
//             <div>
//               <b style={{ color: COLORS.warning }}>{approvedLeaveDays}</b>
//               <p style={{ color: COLORS.secondary, margin: 0 }}>Used</p>
//             </div>
//             <div>
//               <b style={{ color: COLORS.accent }}>{pendingLeaveDays}</b>
//               <p style={{ color: COLORS.secondary, margin: 0 }}>Pending</p>
//             </div>
//             <div>
//               <b style={{ color: COLORS.text }}>{leaveAllocation}</b>
//               <p style={{ color: COLORS.secondary, margin: 0 }}>Allocated</p>
//             </div>
//           </div>
//         </div>

//         {/* Announcements + Holidays */}
//        <div
//   style={{
//     background: "#fff",
//     borderRadius: "22px",
//     padding: "30px",
//     boxShadow: "0 12px 35px rgba(0,0,0,.08)",
//   }}
// >
//   <h2>📢 Announcements</h2>

//   {announcements.length === 0 ? (
//     <div
//       style={{
//         marginTop: 20,
//         padding: "20px",
//         background: "#f8fafc",
//         borderRadius: 15,
//       }}
//     >
//       No Announcements Yet
//     </div>
//   ) : (
//     <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
//       {announcements.map((a) => {
//         const priorityColor =
//           a.priority === "Urgent" ? "#dc2626" : a.priority === "Warning" ? "#d97706" : "#3d6fa8";
//         return (
//           <div
//             key={a.id}
//             style={{
//               padding: "16px 18px",
//               background: "#f8fafc",
//               borderRadius: 12,
//               borderLeft: `4px solid ${priorityColor}`,
//             }}
//           >
//             <h4 style={{ margin: 0, fontSize: 14.5, color: "#0f172a" }}>{a.title}</h4>
//             <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "#64748b" }}>{a.message}</p>
//           </div>
//         );
//       })}
//     </div>
//   )}


//           <div className="holiday-section">
//             <div className="holiday-header">
//               <h2>🎉 Upcoming Holidays</h2>
//               <p>Plan your upcoming days off</p>
//             </div>

//             <div className="holiday-marquee">
//               <div className="holiday-track">
//                 {upcomingHolidays.map((item) => (
//                   <span key={item.id}>
//                     🎉 {item.name || item.holidayName}
//                     &nbsp; 📅 {item.date}
//                     &nbsp;&nbsp; | &nbsp;&nbsp;
//                   </span>
//                 ))}
//               </div>
//             </div>

//             <div className="holiday-list">
//               {upcomingHolidays.length === 0 ? (
//                 <p>No upcoming holidays</p>
//               ) : (
//                 upcomingHolidays.map((item) => (
//                   <div className="holiday-card" key={item.id}>
//                     <div className="holiday-icon">🎊</div>
//                     <div className="holiday-info">
//                       <h3>{item.name || item.holidayName}</h3>
//                       <p>📅 {item.date}</p>
//                     </div>
//                     <span className="holiday-category">{item.category || item.type}</span>
//                   </div>
//                 ))
//               )}
//             </div>
//           </div>
//         </div>
//       </div>
//       </div>
//   );
// }

// /**
//  * Builds a 14-day trend array combining attendance presence and timesheet hours,
//  * grouped by date. Expects attendance docs to have a "date" field and
//  * timesheet docs to have "date" and "hours" fields (adjust field names below
//  * if your schema differs).
//  */
// function buildTrendData(attendance, timesheets) {
//   const days = [];
//   const today = new Date();

//   for (let i = 13; i >= 0; i--) {
//     const d = new Date(today);
//     d.setDate(today.getDate() - i);
//     const key = d.toISOString().split("T")[0];
//     days.push({
//       key,
//       label: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
//       hours: 0,
//       present: 0,
//     });
//   }

//   const dayMap = Object.fromEntries(days.map((d) => [d.key, d]));

//   attendance.forEach((a) => {
//     const dateKey = normalizeDate(a.date);
//     if (dateKey && dayMap[dateKey]) {
//       dayMap[dateKey].present = 1;
//     }
//   });

//   timesheets.forEach((t) => {
//     const dateKey = normalizeDate(t.date);
//     if (dateKey && dayMap[dateKey]) {
//       dayMap[dateKey].hours += Number(t.hours || 0);
//     }
//   });

//   return days;
// }

// function formatTime(value) {
//   if (!value) return null;
//   const d = value.seconds ? new Date(value.seconds * 1000) : new Date(value);
//   if (isNaN(d.getTime())) return null;
//   return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
// }

// function normalizeDate(value) {
//   if (!value) return null;
//   if (value.seconds) return new Date(value.seconds * 1000).toISOString().split("T")[0];
//   const d = new Date(value);
//   if (isNaN(d.getTime())) return null;
//   return d.toISOString().split("T")[0];
// }

// const actionCard = {
//   background: "#fff",
//   border: `1px solid ${COLORS.soft}`,
//   borderRadius: 18,
//   padding: "22px",
//   cursor: "pointer",
//   transition: ".3s",
//   boxShadow: "0 6px 18px rgba(0,0,0,.05)",
// };


// // "use client";

// // import { useEffect, useState } from "react";
// // import {
// //   collection,
// //   getDocs,
// //   doc,
// //   getDoc,
// //   query,
// //   where,
// // } from "firebase/firestore";
// // import { auth, db } from "../../lib/firebase";
// // import { onAuthStateChanged } from "firebase/auth";
// // const COLORS = {
// //   background: "#ffffff",
// //   text: "#111111",
// //   secondary: "#444444",

// //   primary: "#3d6fa8",   // Main Brand Blue
// //   accent: "#66a8e0",    // Accent Blue
// //   soft: "#eaf3ff",      // Light Background

// //   success: "#16a34a",
// //   warning: "#ea580c",
// //   danger: "#dc2626",

// //   border: "#d9e8f8",
// //   shadow: "rgba(61,111,168,0.15)",
// // };
// // export default function DashboardPage() {
// // const [myTimesheets, setMyTimesheets] = useState([]);
// // const [myAttendance, setMyAttendance] = useState([]);
// // const [userName, setUserName] = useState("");
// // const [userData, setUserData] = useState(null);
// // const [upcomingHolidays,setUpcomingHolidays]=useState([]);

// // useEffect(() => {
// //   const unsubscribe = onAuthStateChanged(auth, async (user) => {
// //     if (!user) {
// //       window.location.href = "/login";
// //       return;
// //     }

// //     // Load user profile
// //     const userRef = doc(db, "users", user.uid);

// // const snap = await getDoc(userRef);

// // if (snap.exists()) {

// //     const data = snap.data();

// //     setUserData(data);

// //     setUserName(
// //         `${data.firstName || ""} ${data.lastName || ""}`.trim()
// //     );

// // }

// //     // Load dashboard data
// //     await loadMyData(user);
// //   });

// //   return () => unsubscribe();
// // }, []);

// // const loadMyData = async (user) => {
// //   try {
// //   const attendanceQuery = query(
// //   collection(db, "attendance"),
// //   where("userId", "==", user.uid)
// // );

// // const attendanceSnapshot = await getDocs(attendanceQuery);

// // const attendanceData = attendanceSnapshot.docs.map((doc) => ({
// //   id: doc.id,
// //   ...doc.data(),
// // }));

// // setMyAttendance(attendanceData);

// // const timesheetQuery = query(
// //   collection(db, "timesheets"),
// //   where("email", "==", user.email)
// // );

// // const timesheetSnapshot = await getDocs(timesheetQuery);

// // const timesheetData = timesheetSnapshot.docs.map((doc) => ({
// //   id: doc.id,
// //   ...doc.data(),
// // }));

// // setMyTimesheets(timesheetData);
// // } catch (error) {
// //   console.error(error);
// // }

// // };

// // const totalHours = myTimesheets.reduce(
// // (sum, item) => sum + Number(item.hours || 0),
// // 0
// // );

// // const avgHours =
// // myAttendance.length > 0
// // ? (totalHours / myAttendance.length).toFixed(1)
// // : 0;
// // const totalAttendance = myAttendance.length;

// // const totalTimesheets = myTimesheets.length;

// // const performance = userData?.performance || "Pending";

// // const performanceColor =
// // performance === "Outstanding"
// // ? "#16a34a"
// // : performance === "Excellent"
// // ? "#22c55e"
// // : performance === "Very Good"
// // ? "#3b82f6"
// // : performance === "Good"
// // ? "#f59e0b"
// // : performance === "Average"
// // ? "#f97316"
// // : performance === "Needs Improvement"
// // ? "#dc2626"
// // : "#64748b";


// // const cardStyle = {
// //   background: COLORS.background,
// //   borderRadius: 20,
// //   padding: "30px",
// //   textAlign: "center",
// //   border: `1px solid ${COLORS.soft}`,
// //   boxShadow: "0 10px 30px rgba(0,0,0,.06)",
// //   transition: ".3s",
// // };
// // useEffect(()=>{

// // loadUpcomingHolidays();

// // },[]);



// // const loadUpcomingHolidays=async()=>{


// // const snapshot =
// // await getDocs(
// // collection(db,"holidays")
// // );



// // const today=new Date();


// // const holidays=snapshot.docs
// // .map(doc=>({

// // id:doc.id,
// // ...doc.data()

// // }))
// // .filter(item=>{

// // return new Date(item.date)>=today;

// // })
// // .sort((a,b)=>{

// // return new Date(a.date)-new Date(b.date);

// // })
// // .slice(0,5);



// // setUpcomingHolidays(holidays);


// // };

// // return (
// // <div
// //   style={{
// //     width: "100%",
// //     padding: "8px",
// //     background: "#F5F7FB",
// //     minHeight: "100%",
// //   }}
// // >
// // {/* Header */}
// // <div
// //   style={{
// //     background: COLORS.primary,
// //     color: "#fff",
// //     borderRadius: 22,
// //     padding: "35px",
// //     display: "flex",
// //     justifyContent: "space-between",
// //     alignItems: "center",
// //     marginBottom: 35,
// //     boxShadow: "0 12px 30px rgba(61,111,168,.25)",
// //   }}
// // >
// //   <div>

// //     <h1
// //       style={{
// //         margin: 0,
// //         fontSize: 34,
// //         fontWeight: 700,
// //       }}
// //     >
// //       👋 Welcome Back
    
// //     </h1>

// //     <p
// //       style={{
// //         marginTop: 10,
// //         opacity: .9,
// //         fontSize: 16,
// //       }}
// //     >
// //       Track attendance, productivity and timesheets.
// //     </p>

// //   </div>

// //   <div
// //     style={{
// //       background: COLORS.accent,
// //       padding: "15px 25px",
// //       borderRadius: 15,
// //       fontWeight: 600,
// //       color: "#fff",
// //     }}
// //   >
// //     {new Date().toDateString()}
// //   </div>
// // </div>
// // {/* ================= QUICK ACTIONS ================= */}

// // <h2
// //   style={{
// //     marginBottom: "20px",
// //     color: "#0f172a",
// //     fontWeight: 700,
// //   }}
// // >
// //   🚀 Quick Actions
// // </h2>

// // <div
// //   style={{
// //     display: "grid",
// //     gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
// //     gap: "20px",
// //     marginBottom: "35px",
// //   }}
// // >

// //   <div style={actionCard} onClick={() => window.location.href="/attendance"}>
// //     <h3>🕒 Attendance</h3>
// //     <p>View attendance history</p>
// //   </div>

// //   <div style={actionCard} onClick={() => window.location.href="/timesheet"}>
// //     <h3>📋 Timesheets</h3>
// //     <p>Submit & View Timesheets</p>
// //   </div>

// //   <div style={actionCard} onClick={() => window.location.href="/leave"}>
// //     <h3>🏖 Leave</h3>
// //     <p>Apply & Track Leave</p>
// //   </div>

// //   <div style={actionCard} onClick={() => window.location.href="/documents"}>
// //     <h3>📄 My Documents</h3>
// //     <p>Payslips & HR Documents</p>
// //   </div>

// // </div>

// // {/* ================= DASHBOARD STATS ================= */}

// // <h2
// //   style={{
// //     marginBottom: "20px",
// //     color: "#0f172a",
// //     fontWeight: 700,
// //   }}
// // >
// //   📊 Dashboard Overview
// // </h2>

// // <div
// //   style={{
// //     display: "grid",
// //     gridTemplateColumns: "repeat(4,1fr)",
// //     gap: "20px",
// //     marginBottom: "35px",
// //   }}
// // >

// // <div style={cardStyle}>

// // <div
// // style={{
// // fontSize:42,
// // marginBottom:15
// // }}
// // >
// // 📅
// // </div>

// // <h1
// // style={{
// // color:COLORS.primary,
// // marginBottom:10
// // }}
// // >
// // {totalAttendance}
// // </h1>

// // <h3
// // style={{
// // color:COLORS.text
// // }}
// // >
// // Attendance
// // </h3>

// // <p
// // style={{
// // color:COLORS.secondary
// // }}
// // >
// // Days Present
// // </p>

// // </div>

// // <div style={cardStyle}>

// // <div style={{fontSize:42}}>⏰</div>

// // <h1 style={{color:COLORS.primary}}>
// // {totalHours}
// // </h1>

// // <h3>Total Hours</h3>

// // <p
// // style={{
// // color:COLORS.secondary
// // }}
// // >
// // Working Hours
// // </p>

// // </div>

// // <div style={cardStyle}>

// // <div style={{fontSize:42}}>📝</div>

// // <h1 style={{color:COLORS.primary}}>
// // {totalTimesheets}
// // </h1>

// // <h3>Timesheets</h3>

// // <p
// // style={{
// // color:COLORS.secondary
// // }}
// // >
// // Submitted
// // </p>

// // </div>

// // <div style={cardStyle}>

// // <div style={{fontSize:42}}>📈</div>

// // <h1 style={{color:COLORS.primary}}>
// // {avgHours}
// // </h1>

// // <h3>Average Hours</h3>

// // <p
// // style={{
// // color:COLORS.secondary
// // }}
// // >
// // Per Attendance
// // </p>

// // </div>

// // </div>

// // {/* ================= PERFORMANCE ================= */}

// // <div
// //   style={{
// //     display: "grid",
// //     gridTemplateColumns: "350px 1fr",
// //     gap: "25px",
// //     marginBottom: "35px",
// //   }}
// // >

// // <div
// //   style={{
// // background:"#fff",
// // padding:35,
// // borderRadius:22,
// // border:`1px solid ${COLORS.soft}`,
// // boxShadow:"0 10px 30px rgba(0,0,0,.08)",
// // textAlign:"center"
// // }}
// // >

// // <div
// // style={{
// // width:85,
// // height:85,
// // margin:"auto",
// // borderRadius:"50%",
// // background:COLORS.primary,
// // display:"flex",
// // justifyContent:"center",
// // alignItems:"center",
// // fontSize:38,
// // color:"#fff"
// // }}
// // >
// // 🏆
// // </div>

// // <h2
// // style={{
// // marginTop:20,
// // color:COLORS.text
// // }}
// // >
// // Performance
// // </h2>

// // <div
// // style={{
// // display:"inline-block",
// // marginTop:20,
// // padding:"14px 38px",
// // background:`${performanceColor}15`,
// // color:performanceColor,
// // border:`2px solid ${performanceColor}`,
// // borderRadius:"40px",
// // fontSize:"24px",
// // fontWeight:"700"
// // }}
// // >
// // {performance}
// // </div>

// // <p
// // style={{
// // marginTop:18,
// // fontSize:"17px",
// // fontWeight:"500",
// // color:COLORS.secondary
// // }}
// // >
// // {performance === "Pending"
// // ? "Awaiting HR Review"
// // : "Rated by HR Department"}
// // </p>

// // <hr
// // style={{
// // margin:"30px 0",
// // borderColor:COLORS.soft
// // }}
// // />

// // <small
// // style={{
// // display:"block",
// // marginTop:"15px",
// // color:COLORS.secondary,
// // fontSize:"15px"
// // }}
// // >
// // <b>Last Updated</b>

// // <br/>

// // {
// // userData?.performanceUpdatedAt?.seconds
// // ? new Date(
// // userData.performanceUpdatedAt.seconds * 1000
// // ).toLocaleDateString("en-IN")
// // : "--"
// // }
// // </small>

// // </div>

// // <div
// // style={{
// // background:"#fff",
// // borderRadius:"22px",
// // padding:"30px",
// // boxShadow:"0 12px 35px rgba(0,0,0,.08)"
// // }}
// // >

// // <h2>📢 Announcements</h2>

// // <div
// // style={{
// // marginTop:20,
// // padding:"20px",
// // background:"#f8fafc",
// // borderRadius:15
// // }}
// // >
// // No Announcements Yet
// // </div>
// // <div className="holiday-section">

// //     <div className="holiday-header">
// //         <h2>🎉 Upcoming Holidays</h2>
// //         <p>Plan your upcoming days off</p>
// //     </div>


// //     <div className="holiday-marquee">

// //         <div className="holiday-track">

// //         {
// //         upcomingHolidays.map(item=>(

// //             <span key={item.id}>
// //                 🎉 {item.name || item.holidayName}
// //                 &nbsp; 📅 {item.date}
// //                 &nbsp;&nbsp; | &nbsp;&nbsp;
// //             </span>

// //         ))
// //         }

// //         </div>

// //     </div>



// //     <div className="holiday-list">

// //     {
// //     upcomingHolidays.length===0

// //     ?

// //     <p>No upcoming holidays</p>

// //     :

// //     upcomingHolidays.map(item=>(

// //         <div className="holiday-card" key={item.id}>


// //             <div className="holiday-icon">
// //                 🎊
// //             </div>


// //             <div className="holiday-info">

// //                 <h3>
// //                 {item.name || item.holidayName}
// //                 </h3>

// //                 <p>
// //                 📅 {item.date}
// //                 </p>

// //             </div>


// //             <span className="holiday-category">

// //             {item.category || item.type}

// //             </span>


// //         </div>

// //     ))

// //     }

// //     </div>


// // </div>


// // </div>

// // </div>
// // <div
// //   style={actionCard}
// //   onClick={() => router.push("/workspace")}
// // >
// //     <h3>🤖 AI Workspace</h3>
// //     <p>Open AI Tools</p>
// // </div>


// // </div>

// // );
// // }

// // const thStyle = {
// // borderBottom: "1px solid #ddd",
// // padding: "12px",
// // textAlign: "left",
// // background: "#f8fafc",
// // };

// // const tdStyle = {
// // borderBottom: "1px solid #eee",
// // padding: "12px",
// // };

// // const toolStyle = {
// //   textDecoration: "none",
// //   background: "#eff6ff",
// //   color: "#1e3a8a",
// //   padding: "15px",
// //   borderRadius: "10px",
// //   textAlign: "center",
// //   fontWeight: "600",
// //   transition: "0.3s",
// // };

// // const actionCard = {
// //   background: "#fff",
// //   border: `1px solid ${COLORS.soft}`,
// //   borderRadius: 18,
// //   padding: "22px",
// //   cursor: "pointer",
// //   transition: ".3s",
// //   boxShadow: "0 6px 18px rgba(0,0,0,.05)",
// // };