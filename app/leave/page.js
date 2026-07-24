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
width:"100%",
maxWidth:"100%",
padding:"20px",
background:"#F5F7FB",
minHeight:"100vh",
}}
>


{/* Header */}

<div
style={{
background:"#fff",
padding:"30px",
borderRadius:"24px",
marginBottom:"25px",
boxShadow:"0 10px 30px rgba(0,0,0,.06)"
}}
>

<h1
style={{
fontSize:"36px",
fontWeight:800,
color:"#1e3a8a",
margin:0
}}
>
🏖 Leave Management
</h1>


<p
style={{
marginTop:"10px",
color:"#64748b",
fontSize:"16px"
}}
>
Apply leave, track approval status and manage your leave balance.
</p>


</div>



{/* Leave Cards */}

<div
style={{
display:"grid",
gridTemplateColumns:
"repeat(auto-fit,minmax(220px,1fr))",
gap:"20px",
marginBottom:"25px"
}}
>


<LeaveCard
title="Casual Leave"
value={casualLeave-approvedCasual}
color="#2563eb"
/>


<LeaveCard
title="Sick Leave"
value={sickLeave-approvedSick}
color="#16a34a"
/>


<LeaveCard
title="Paid Leave"
value={paidLeave-approvedPaid}
color="#9333ea"
/>


<LeaveCard
title="Pending Requests"
value={pendingLeave}
color="#f59e0b"
/>


</div>





{/* Apply Leave Form */}

<div
style={{
background:"#fff",
padding:"30px",
borderRadius:"24px",
boxShadow:"0 10px 30px rgba(0,0,0,.06)",
marginBottom:"30px"
}}
>


<h2
style={{
fontSize:"26px",
fontWeight:700,
marginBottom:"25px"
}}
>
📝 Apply New Leave
</h2>



<div
style={{
display:"grid",
gridTemplateColumns:
"repeat(auto-fit,minmax(280px,1fr))",
gap:"20px"
}}
>


<div>
<label>Leave Type</label>

<select
value={leaveType}
onChange={(e)=>setLeaveType(e.target.value)}
style={inputStyle}
>

<option value="">
Select Leave
</option>

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
value={fromDate}
onChange={(e)=>setFromDate(e.target.value)}
style={inputStyle}
/>

</div>




<div>
<label>To Date</label>

<input
type="date"
value={toDate}
onChange={(e)=>setToDate(e.target.value)}
style={inputStyle}
/>

</div>




<div>

<label>Total Days</label>

<input
value={totalDays}
disabled
style={inputStyle}
/>

</div>


</div>



<div
style={{
marginTop:"20px"
}}
>

<label>
Reason
</label>


<textarea
rows={5}
value={reason}
onChange={(e)=>setReason(e.target.value)}
style={{
...inputStyle,
resize:"none"
}}
/>


</div>



<button
onClick={submitLeave}
style={{
marginTop:"25px",
padding:"14px 35px",
background:"#2563eb",
color:"#fff",
border:"none",
borderRadius:"12px",
fontSize:"18px",
fontWeight:700,
cursor:"pointer"
}}
>

📨 Submit Request

</button>


</div>






{/* History Table */}

<div
style={{
background:"#fff",
padding:"30px",
borderRadius:"24px",
boxShadow:"0 10px 30px rgba(0,0,0,.06)",
overflowX:"auto"
}}
>


<h2
style={{
fontSize:"26px",
fontWeight:700,
marginBottom:"20px"
}}
>
📋 Leave History
</h2>



<table
style={{
width:"100%",
borderCollapse:"collapse",
minWidth:"900px"
}}
>

<thead>

<tr>

<th style={th}>
Type
</th>

<th style={th}>
From
</th>

<th style={th}>
To
</th>

<th style={th}>
Days
</th>

<th style={th}>
Reason
</th>

<th style={th}>
Status
</th>

</tr>

</thead>



<tbody>


{
myLeaves.map((leave)=>(


<tr key={leave.id}>


<td style={td}>
{leave.leaveType}
</td>


<td style={td}>
{leave.fromDate}
</td>


<td style={td}>
{leave.toDate}
</td>


<td style={td}>
{leave.totalDays}
</td>


<td style={td}>
{leave.reason}
</td>


<td style={td}>

<span
style={{
padding:"6px 15px",
borderRadius:"20px",
background:
leave.status==="Approved"
?"#dcfce7"
:
leave.status==="Rejected"
?"#fee2e2"
:"#fef3c7"
}}
>

{leave.status}

</span>

</td>


</tr>


))

}


</tbody>


</table>


</div>



</div>
);

}

function LeaveCard({
  title,
  value,
  color,
}) {

  return (
    <div
      style={{
        background:"#ffffff",
        padding:"25px",
        borderRadius:"20px",
        borderLeft:`6px solid ${color}`,
        boxShadow:"0 8px 25px rgba(0,0,0,.06)",
      }}
    >

      <h3
        style={{
          color:"#64748b",
          fontSize:"18px",
          marginBottom:"10px"
        }}
      >
        {title}
      </h3>


      <h1
        style={{
          fontSize:"38px",
          fontWeight:800,
          color:color,
          margin:0
        }}
      >
        {value}
      </h1>


      <p
        style={{
          color:"#94a3b8",
          marginTop:"8px"
        }}
      >
        Remaining
      </p>


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
