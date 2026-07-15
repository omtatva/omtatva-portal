"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
} from "firebase/firestore";
import { useSearchParams } from "next/navigation";
import { db } from "../../../lib/firebase";

export default function LeaveAdminPage() {

const [requests,setRequests]=useState([]);

useEffect(()=>{
loadRequests();
},[]);

const loadRequests=async()=>{
const snapshot=await getDocs(
collection(db,"leaveRequests")
);

const list=snapshot.docs.map(doc=>({
id:doc.id,
...doc.data()
}));

setRequests(list);

};
const updateLeaveStatus = async (id, status) => {

  try {

    await updateDoc(
      doc(db, "leaveRequests", id),
      {
        status,
      }
    );

    alert("Status Updated");

    loadRequests();

  } catch (error) {

    console.error(error);

    alert("Failed");

  }

};


return(

<div
style={{
maxWidth:1400,
margin:"40px auto",
padding:30
}}
>

<h1>🏖 Leave Requests</h1>
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
marginBottom:30
}}
>

Approve or Reject employee leave requests.

</p>

<table
style={{
width:"100%",
borderCollapse:"collapse",
background:"#fff",
boxShadow:"0 10px 30px rgba(0,0,0,.08)"
}}
>

<thead>

<tr>

<th style={th}>Employee</th>

<th style={th}>Leave</th>

<th style={th}>From</th>

<th style={th}>To</th>

<th style={th}>Status</th>

<th style={th}>Action</th>

</tr>

</thead>

<tbody>

{requests.map((item) => (

<tr key={item.id}>

<td style={td}>{item.employeeName}</td>

<td style={td}>{item.leaveType}</td>

<td style={td}>{item.fromDate}</td>

<td style={td}>{item.toDate}</td>

<td style={td}>{item.status}</td>

<td style={td}>

<button
style={greenBtn}
onClick={() =>
updateLeaveStatus(item.id,"Approved")
}
>

Approve

</button>

<button
style={redBtn}
onClick={() =>
updateLeaveStatus(item.id,"Rejected")
}
>

Reject

</button>

</td>

</tr>

))}

</tbody>

</table>

</div>

);

}

const th={
padding:15,
background:"#f8fafc",
textAlign:"left"
};

const td={
padding:15,
borderBottom:"1px solid #eee"
};

const greenBtn = {
  background: "#16a34a",
  color: "#fff",
  border: "none",
  padding: "8px 14px",
  borderRadius: "8px",
  cursor: "pointer",
  marginRight: "10px",
};

const redBtn = {
  background: "#dc2626",
  color: "#fff",
  border: "none",
  padding: "8px 14px",
  borderRadius: "8px",
  cursor: "pointer",
};