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
export default function LeavePage() {

const [leaveType, setLeaveType] = useState("");
const [fromDate, setFromDate] = useState("");
const [toDate, setToDate] = useState("");
const [totalDays, setTotalDays] = useState(0);
const [reason, setReason] = useState("");
const [myLeaves, setMyLeaves] = useState([]);

useEffect(() => {

const unsubscribe = auth.onAuthStateChanged((user)=>{

if(user){
loadMyLeaves();
}

});

return ()=>unsubscribe();

}, []);
useEffect(() => {
  if (fromDate && toDate) {
    const start = new Date(fromDate);
    const end = new Date(toDate);

    const diff =
      Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    setTotalDays(diff > 0 ? diff : 0);
  } else {
    setTotalDays(0);
  }
}, [fromDate, toDate]);

const submitLeave = async () => {

  const user = auth.currentUser;

  if (!user) {
    alert("Please Login");
    return;
  }


  // Mandatory field validation
  if (
    !leaveType ||
    !fromDate ||
    !toDate ||
    !reason.trim()
  ) {
    alert("Please fill all required fields");
    return;
  }


  if (totalDays <= 0) {
    alert("Please select a valid date range");
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
      totalDays,
      reason,
      status: "Pending",
      appliedOn: Timestamp.now(),
    });


    await addDoc(collection(db, "activityLogs"), {
      uid: user.uid,
      employeeName: user.displayName || user.email,
      activity: "Applied for Leave",
      type: "Leave",
      description: `${leaveType} (${fromDate} - ${toDate})`,
      createdAt: Timestamp.now(),
    });


    alert("Leave Request Submitted");


    setLeaveType("");
    setFromDate("");
    setToDate("");
    setReason("");
    setTotalDays(0);


    await loadMyLeaves();


  } catch (error) {

    console.error(error);
    alert("Failed to submit");

  }

};
const loadMyLeaves = () => {

  const user = auth.currentUser;

  if (!user) return;


  const q = query(
    collection(db, "leaveRequests"),
    where("uid", "==", user.uid)
  );


  const unsubscribe = onSnapshot(q, (snapshot) => {

    const list = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    setMyLeaves(list);

  });


  return unsubscribe;
};

const casualLeave = 12;
const sickLeave = 10;
const paidLeave = 18;

const approvedCasual = myLeaves.filter(
  (l) => l.leaveType === "Casual Leave" && l.status === "Approved"
).length;

const approvedSick = myLeaves.filter(
  (l) => l.leaveType === "Sick Leave" && l.status === "Approved"
).length;

const approvedPaid = myLeaves.filter(
  (l) => l.leaveType === "Paid Leave" && l.status === "Approved"
).length;

const pendingLeave = myLeaves.filter(
  (l) => l.status === "Pending"
).length;


return (

<div
  style={{
    width: "100%",
    maxWidth: "1800px",
    margin: "30px auto",
    padding: "40px",
    background: "#ffffff",
    borderRadius: "22px",
    boxShadow: "0 12px 35px rgba(37,99,235,.08)",
    fontSize: "20px",
fontWeight: "700",
  }}
>

<div
style={{
display:"grid",
gridTemplateColumns:"repeat(4,1fr)",
gap:"25px",
marginBottom:"45px"
}}
>

<div style={card}>
<h3>Casual Leave</h3>
<h1>{casualLeave-approvedCasual}</h1>
<p>Remaining</p>
</div>

<div style={card}>
<h3>Sick Leave</h3>
<h1>{sickLeave-approvedSick}</h1>
<p>Remaining</p>
</div>

<div style={card}>
<h3>Paid Leave</h3>
<h1>{paidLeave-approvedPaid}</h1>
<p>Remaining</p>
</div>

<div style={card}>
<h3>Pending</h3>
<h1>{pendingLeave}</h1>
<p>Requests</p>
</div>

</div>

<div style={{ marginBottom: 35 }}>

<h1
style={{
fontSize: "42px",
fontWeight: 800,
color: "#0f172a",
marginBottom: 8,
}}
>
🏖 Leave Management
</h1>

<p
style={{
fontSize: 17,
color: "#64748b",
}}
>
Apply for leave and monitor approval status.
</p>

</div>

<div
style={{
display:"grid",
gridTemplateColumns:"repeat(2,minmax(320px,1fr))",
columnGap:"30px",
rowGap:"25px",
gap:20,
marginTop:30
}}
>

<div>

<label>Leave Type</label>

<select
  required
  value={leaveType}
  onChange={(e)=>setLeaveType(e.target.value)}
  style={inputStyle}
>

<option value="">Select</option>

<option>Casual Leave</option>

<option>Sick Leave</option>

<option>Paid Leave</option>

<option>Work From Home</option>

<option>Emergency Leave</option>

</select>

</div>

<div>

<label>From Date</label>

<input
  type="date"
  required
  value={fromDate}
  onChange={(e)=>setFromDate(e.target.value)}
  style={inputStyle}
/>

</div>

<div>

<label>To Date</label>

<input
  type="date"
  required
  value={toDate}
  onChange={(e)=>setToDate(e.target.value)}
  style={inputStyle}
/>

</div>

<div
style={{
gridColumn:"1 / span 2"
}}
>
  <label>Total Days</label>

  <input
    value={totalDays}
    disabled
    style={inputStyle}
  />
</div>

<div
style={{
gridColumn:"1 / span 2"
}}
>

<label>Reason</label>

<textarea
  required
  rows={6}
  value={reason}
  onChange={(e)=>setReason(e.target.value)}
  style={inputStyle}
/>

</div>

</div>

<button
  onClick={submitLeave}
  style={{
    marginTop:30,
    padding:"16px 38px",
background:"#2563eb",
fontSize:"20px",
fontWeight:"700",
borderRadius:"12px",
boxShadow:"0 8px 20px rgba(37,99,235,.25)",
    color:"#fff",
    border:"none",
    borderRadius:10,
    cursor:"pointer",
    fontWeight:"bold"
  }}
>

📨 Submit Leave Request

</button>

<hr style={{ margin: "40px 0" }} />

<h2>📋 My Leave Requests</h2>

<div
style={{
marginTop:30,
background:"#fff",
borderRadius:18,
padding:20,
boxShadow:"0 6px 18px rgba(0,0,0,.06)"
}}
>

<table
style={{
width:"100%",
borderCollapse:"collapse",
}}
>
  <thead>
<tr>
<th style={th}>Leave Type</th>
<th style={th}>From</th>
<th style={th}>To</th>
<th style={th}>Reason</th>
<th style={th}>Status</th>
<th style={th}>Approved By</th>
<th style={th}>Approved On</th>
</tr>
</thead>

  <tbody>
{myLeaves.map((leave) => (
<tr key={leave.id}>

<td style={td}>{leave.leaveType}</td>

<td style={td}>{leave.fromDate}</td>

<td style={td}>{leave.toDate}</td>

<td style={td}>{leave.reason}</td>

<td style={td}>
  <span
    style={{
      display: "inline-block",
      padding: "6px 14px",
      borderRadius: "20px",
      fontWeight: "600",
      fontSize: "14px",
      background:
        leave.status === "Approved"
          ? "#dcfce7"
          : leave.status === "Rejected"
          ? "#fee2e2"
          : "#fef3c7",
      color:
        leave.status === "Approved"
          ? "#15803d"
          : leave.status === "Rejected"
          ? "#dc2626"
          : "#b45309",
    }}
  >
    {leave.status}
  </span>
</td>

<td style={td}>
{leave.approvedBy || "-"}
</td>

<td style={td}>
{leave.approvedAt?.toDate?.().toLocaleDateString() || "-"}
</td>

</tr>
))}
</tbody>
</table>
</div>
</div>
);

}
const inputStyle = {
width:"100%",
padding:"14px 16px",
marginTop:"8px",
fontSize:"20px",
borderRadius:"12px",
border:"1px solid #dbeafe",
outline:"none",
background:"#fff",
transition:"0.3s",
};

const th={
padding:"16px",
background:"#2563eb",
color:"#fff",
fontWeight:"700",
fontSize:"20px",
textAlign:"left",
};

const td={
padding:"16px",
fontSize:"20px",
borderBottom:"1px solid #eef2ff",
};

const card = {
background:"#ffffff",
padding:"30px",
borderRadius:"18px",
textAlign:"center",
border:"1px solid #dbeafe",
boxShadow:"0 10px 25px rgba(37,99,235,.08)",
};

card.h3 = {
fontSize:"20px"
};

card.h1 = {
fontSize:"42px"
};
