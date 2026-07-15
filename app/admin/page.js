"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  limit,
  query,
  orderBy
} from "firebase/firestore";

import { auth, db } from "../../lib/firebase";

export default function AdminPage() {
  const [loading, setLoading] = useState(true);

  const [totalEmployees, setTotalEmployees] = useState(0);
  const [attendanceCount, setAttendanceCount] = useState(0);
  const [timesheetCount, setTimesheetCount] = useState(0);
  const [inactiveUsers, setInactiveUsers] = useState(0);
const [activities, setActivities] = useState([]);
  useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "/admin/login";
      return;
    }

    try {
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        alert("User not found");
        window.location.href = "/";
        return;
      }

      const data = userSnap.data();

      const allowedEmails = [
        "admin@omtatvadigitals.com",
        "hr@omtatvadigitals.com",
        "owner@omtatvadigitals.com",
      ];

      const allowedRoles = [
        "admin",
        "owner",
        "hr",
      ];

      const emailAllowed = allowedEmails.includes(user.email || "");

      const roleAllowed = allowedRoles.includes(
        (data.role || "").toLowerCase()
      );

      if (!emailAllowed && !roleAllowed) {
        alert("Access Denied");
        window.location.href = "/";
        return;
      }

      await loadDashboard();
      setLoading(false);

    } catch (error) {
      console.error(error);
    }
  });

  return () => unsubscribe();
}, []);

useEffect(() => {
  loadActivities();
}, []);

const loadActivities = async () => {

  const q = query(
    collection(db, "activityLogs"),
    orderBy("createdAt", "desc"),
    limit(10)
  );

  const snapshot = await getDocs(q);

  const list = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));

  setActivities(list);

};

const loadDashboard = async () => {
  try {
    const usersSnapshot = await getDocs(collection(db, "users"));

    const users = usersSnapshot.docs.map((doc) => doc.data());

    setTotalEmployees(users.length);

    setInactiveUsers(
        users.filter(
  (user) =>
    (user.status || "").toLowerCase() === "inactive"
).length

    );

    const attendanceSnapshot = await getDocs(
      collection(db, "attendance")
    );

    setAttendanceCount(attendanceSnapshot.size);

    const timesheetSnapshot = await getDocs(
      collection(db, "timesheets")
    );

    setTimesheetCount(timesheetSnapshot.size);

  } catch (error) {
    console.error(error);
  }
};

  if (loading) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontSize: "22px",
        fontWeight: "600",
      }}
    >
      Loading Admin Dashboard...
    </div>
  );
}

return (
<div
style={{
maxWidth:"1500px",
margin:"30px auto",
padding:"25px"
}}
>

<h1
style={{
fontSize:"38px",
fontWeight:"700",
marginBottom:"8px"
}}
>
🏢 Admin Dashboard
</h1>

<p
style={{
color:"#64748b",
marginBottom:"35px"
}}
>
Manage HR, Production & AI Operations from one place.
</p>


{/* Statistics */}

<div
style={{
display:"grid",
gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",
gap:"20px",
marginBottom:"35px"
}}
>

{[
{
title:"Employees",
value:totalEmployees,
color:"#2563eb",
icon:"👥"
},
{
title:"Attendance",
value:attendanceCount,
color:"#16a34a",
icon:"🕒"
},
{
title:"Timesheets",
value:timesheetCount,
color:"#9333ea",
icon:"📋"
},
{
title:"Inactive",
value:inactiveUsers,
color:"#dc2626",
icon:"⚠️"
}
].map((card)=>(

<div
key={card.title}
style={{
background:"#fff",
borderRadius:"18px",
padding:"25px",
boxShadow:"0 10px 25px rgba(0,0,0,.08)"
}}
>

<div
style={{
display:"flex",
justifyContent:"space-between",
alignItems:"center"
}}
>

<div>

<p
style={{
margin:0,
color:"#64748b"
}}
>
{card.title}
</p>

<h1
style={{
margin:"10px 0 0",
fontSize:"40px",
color:card.color
}}
>
{card.value}
</h1>

</div>

<div
style={{
fontSize:"45px"
}}
>
{card.icon}
</div>

</div>

</div>

))

}

</div>


{/* Quick Actions */}

<div
style={{
background:"#fff",
padding:"30px",
borderRadius:"18px",
boxShadow:"0 10px 25px rgba(0,0,0,.08)",
marginBottom:"30px"
}}
>

<h2
style={{
marginBottom:"25px"
}}
>
⚡ Quick Actions
</h2>

<div
style={{
display:"grid",
gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",
gap:"20px"
}}
>

{[
["👥 Employee Management","/admin/users"],
["🕒 Attendance","/admin/attendance"],
["🏖 Leave","/admin/leave"],
["💰 Payroll","/admin/payroll"],
["📋 Timesheets","/admin/timesheet"],
["📄 Documents","/admin/documents"],
["📊 Reports","/admin/reports"],
["🎬 AI Production","/admin/production"],
["📅 Holidays", "/admin/holidays"]
].map(([title,link])=>(

<button
key={title}
onClick={()=>window.location.href=link}
style={{
padding:"25px",
borderRadius:"15px",
background:"#f8fbff",
border:"1px solid #dbeafe",
fontSize:"17px",
fontWeight:"600",
cursor:"pointer",
transition:".3s"
}}
>

{title}

</button>

))

}

</div>

</div>


{/* Activity */}

<div
style={{
display:"grid",
gridTemplateColumns:"2fr 1fr",
gap:"25px"
}}
>

<div
style={{
background:"#fff",
padding:"30px",
borderRadius:"18px",
boxShadow:"0 10px 25px rgba(0,0,0,.08)"
}}
>

<h2>📢 Recent Activity</h2>

<table
style={{
width:"100%",
marginTop:"20px",
borderCollapse:"collapse"
}}
>

<thead>

<tr>

<th style={thStyle}>Employee</th>

<th style={thStyle}>Activity</th>

<th style={thStyle}>Time</th>

</tr>

</thead>

<tbody>

{activities.map((item) => (

<tr key={item.id}>

<td style={tdStyle}>
{item.employeeName}
</td>

<td style={tdStyle}>
{item.activity}
</td>

<td style={tdStyle}>
{item.createdAt?.toDate().toLocaleString()}
</td>

</tr>

))}

</tbody>

</table>

</div>


<div
style={{
background:"#fff",
padding:"30px",
borderRadius:"18px",
boxShadow:"0 10px 25px rgba(0,0,0,.08)"
}}
>

<h2>📌 Overview</h2>

<div
style={{
marginTop:"20px",
display:"flex",
flexDirection:"column",
gap:"20px"
}}
>

<div>

<h3>Today's Attendance</h3>

<p>{attendanceCount} Records</p>

</div>

<div>

<h3>Employees</h3>

<p>{totalEmployees}</p>

</div>

<div>

<h3>Inactive</h3>

<p>{inactiveUsers}</p>

</div>

<div>

<h3>Timesheets</h3>

<p>{timesheetCount}</p>

</div>

</div>

</div>

</div>

</div>
);
}

const buttonStyle = {
background: "#2563eb",
color: "#fff",
border: "none",
padding: "12px 20px",
borderRadius: "8px",
cursor: "pointer",
fontWeight: "600",
};

const thStyle = {
padding: "15px",
textAlign: "left",
background: "#f8fafc",
borderBottom: "1px solid #e5e7eb",
};

const tdStyle = {
padding: "15px",
borderBottom: "1px solid #f1f5f9",
};