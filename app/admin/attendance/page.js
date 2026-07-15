"use client";

import { useEffect, useState } from "react";

import {
  collection,
  getDocs,
  doc,
  deleteDoc,
} from "firebase/firestore";

import { db } from "../../../lib/firebase";

export default function AttendancePage() {
    const [attendance, setAttendance] = useState([]);

const [search, setSearch] = useState("");

const [statusFilter, setStatusFilter] = useState("");

const [loading, setLoading] = useState(true);


useEffect(() => {

  loadAttendance();

}, []);

const loadAttendance = async () => {

  try {

    const snapshot = await getDocs(
      collection(db, "attendance")
    );

    const list = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    setAttendance(list);

  } catch (error) {

    console.log(error);

  } finally {

    setLoading(false);

  }

};

const deleteAttendance = async (id) => {

  const confirmDelete = window.confirm(
    "Delete this attendance record?"
  );

  if (!confirmDelete) return;

  await deleteDoc(
    doc(db, "attendance", id)
  );

  loadAttendance();

};
const filteredAttendance = attendance.filter((item) => {

  const matchSearch =
    item.employeeName
      ?.toLowerCase()
      .includes(search.toLowerCase());

  const matchStatus =
    statusFilter === "" ||
    item.status === statusFilter;

  return (
    matchSearch &&
    matchStatus
  );

});

if (loading) {

  return (

    <div style={{ padding: 40 }}>

      Loading Attendance...

    </div>

  );

}
return (

<div
style={{
maxWidth:"1400px",
margin:"40px auto",
padding:"30px"
}}
>

<h1
style={{
fontSize:"36px",
marginBottom:"10px"
}}
>
📅 Attendance Management
</h1>
<button
        onClick={() => (window.location.href = "/admin")}
        style={{
          background: "#2563eb",
          color: "#fff",
          border: "none",
          padding: "10px 20px",
          borderRadius: "10px",
          cursor: "pointer",
          fontWeight: "600",
        }}
      >
        ← Dashboard
      </button>
<p
style={{
color:"#64748b",
marginBottom:"30px"
}}
>
View, search and manage employee attendance.
</p>

<div
style={{
display:"grid",
gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",
gap:20,
marginBottom:30
}}
>

<div style={card}>
<h3>Total Records</h3>
<h1>{attendance.length}</h1>
</div>

<div style={card}>
<h3>Present</h3>
<h1>
{
attendance.filter(
a=>a.status==="Present"
).length
}
</h1>
</div>

<div style={card}>
<h3>Absent</h3>
<h1>
{
attendance.filter(
a=>a.status==="Absent"
).length
}
</h1>
</div>

<div style={card}>
<h3>Leave</h3>
<h1>
{
attendance.filter(
a=>a.status==="Leave"
).length
}
</h1>
</div>

</div>
<div
style={{
background:"#fff",
borderRadius:"15px",
padding:"25px",
boxShadow:"0 8px 20px rgba(0,0,0,.08)"
}}
>

<h2
style={{
marginBottom:"20px"
}}
>
Attendance Records
</h2>

<table
style={{
width:"100%",
borderCollapse:"collapse"
}}
>

<thead>

<tr>

<th style={th}>Employee</th>

<th style={th}>Date</th>

<th style={th}>Check In</th>

<th style={th}>Check Out</th>

<th style={th}>Hours</th>

<th style={th}>Status</th>

<th style={th}>Actions</th>

</tr>

</thead>

<tbody>

{filteredAttendance.length===0 ? (

<tr>

<td
colSpan="7"
style={{
padding:"30px",
textAlign:"center"
}}
>

No Attendance Records

</td>

</tr>

) : (

filteredAttendance.map((item)=>(

<tr key={item.id}>

<td style={td}>
{item.employeeName}
</td>

<td style={td}>
{item.date}
</td>

<td style={td}>
{item.checkIn}
</td>

<td style={td}>
{item.checkOut}
</td>

<td style={td}>
{item.totalHours}
</td>

<td style={td}>

<span
style={{
padding:"6px 12px",
borderRadius:"20px",
background:
item.status==="Present"
? "#dcfce7"
: item.status==="Absent"
? "#fee2e2"
: "#fef9c3",
color:
item.status==="Present"
? "#15803d"
: item.status==="Absent"
? "#dc2626"
: "#ca8a04",
fontWeight:"600"
}}
>

{item.status}

</span>

</td>

<td style={td}>

<button
style={redBtn}
onClick={()=>
deleteAttendance(item.id)
}
>

Delete

</button>

</td>

</tr>

))

)}

</tbody>

</table>

</div>
</div>

);
}

const card = {
  background: "#fff",
  padding: "20px",
  borderRadius: "15px",
  textAlign: "center",
  boxShadow: "0 8px 20px rgba(0,0,0,.08)",
};

const inputStyle = {
  padding: "12px",
  border: "1px solid #ddd",
  borderRadius: "8px",
  width: "250px",
};

const th = {
  background: "#f8fafc",
  padding: "15px",
  textAlign: "left",
  borderBottom: "1px solid #e5e7eb",
};

const td = {
  padding: "15px",
  borderBottom: "1px solid #f1f5f9",
};

const redBtn = {
  background: "#dc2626",
  color: "#fff",
  border: "none",
  padding: "8px 15px",
  borderRadius: "8px",
  cursor: "pointer",
};
