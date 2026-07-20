"use client";

import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  addDoc,
  Timestamp
} from "firebase/firestore";

import { useEffect, useState } from "react";
import { auth, db } from "../../../lib/firebase";


export default function LeaveAdminPage() {

const [requests,setRequests]=useState([]);
const [remarks,setRemarks]=useState({});


useEffect(()=>{

const unsubscribe = loadRequests();

return ()=>{
 if(unsubscribe) unsubscribe();
}

},[]);



const loadRequests = () => {

const unsubscribe = onSnapshot(
collection(db,"leaveRequests"),

(snapshot)=>{

const list = snapshot.docs.map((item)=>({
id:item.id,
...item.data()
}));

setRequests(list);

},

(error)=>{

console.log("Load Requests Error:",error);
setRequests([]);

}

);

return unsubscribe;

};



const updateLeaveStatus = async (id, status) => {

  try {

    const leave = requests.find(r => r.id === id);

    if (!leave) {
      alert("Leave record not found");
      return;
    }


    // 1. Update leave status in Firestore

    await updateDoc(
      doc(db, "leaveRequests", id),
      {
        status: status,
        approvedBy: auth.currentUser?.displayName || "Admin",
        approvedAt: Timestamp.now(),
        remarks: remarks[id] || ""
      }
    );


    // 2. Send email through Cloud Run

    await fetch(
      "YOUR_CLOUD_RUN_EMAIL_API_URL",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({

          to: leave.email,

          employeeName:
          leave.employeeName,

          leaveType:
          leave.leaveType,

          status: status,

          fromDate:
          leave.fromDate,

          toDate:
          leave.toDate,

          approvedBy:
          auth.currentUser?.displayName || "Admin",

          remarks:
          remarks[id] || ""

        })

      }
    );


    // 3. Activity Log

    await addDoc(
      collection(db,"activityLogs"),
      {

        employeeName:
        leave.employeeName,

        uid:
        leave.uid,

        activity:
        `Leave ${status}`,

        type:
        "Leave",

        description:
        `${leave.leaveType} (${leave.fromDate} - ${leave.toDate})`,

        createdAt:
        Timestamp.now()

      }
    );


    alert("Status Updated & Email Sent");


  }
  catch(error){

    console.log(error);

    alert("Failed");

  }

};




return(

<div
style={{
width: "98%",
minHeight: "100vh",
padding: "35px 40px",
background: "#f5f8fc",
}}
>

<h1>🏖 Leave Requests</h1>
<button
        onClick={() => (window.location.href = "/admin")}
        style={{
          background: "#2563eb",
          color: "#fff",
          border: "none",
          padding:"12px 28px",
          fontSize:"15px",
          fontWeight:"600",
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

<div
style={{
background:"#fff",
borderRadius:"18px",
boxShadow:"0 12px 35px rgba(0,0,0,.08)",
overflowX:"auto",
marginTop:"25px",
}}
>

<table
style={{
width:"100%",
minWidth:"1400px",
borderCollapse:"collapse"
}}
>

<thead>

<tr>

<th style={th}>Employee</th>

<th style={th}>Leave</th>

<th style={th}>Days</th>

<th style={th}>From</th>

<th style={th}>To</th>

<th style={th}>Reason</th>

<th style={th}>Status</th>

<th style={th}>HR Remarks</th>

<th style={th}>Action</th>

</tr>

</thead>

<tbody>

{requests && requests.map((item) => (

<tr key={item.id}>

<td style={td}>
<div style={{fontWeight:"700"}}>
{item.employeeName}
</div>

<div style={{
fontSize:"13px",
color:"#64748b",
marginTop:"4px"
}}>
{item.email}
</div>
</td>

<td style={td}>{item.leaveType}</td>

<td style={td}>{item.totalDays || "-"}</td>

<td style={td}>{item.fromDate}</td>

<td style={td}>{item.toDate}</td>

<td style={td}>{item.reason}</td>

<td style={td}>

<span
style={{
padding:"6px 14px",
borderRadius:"20px",
fontWeight:"600",
background:
item.status==="Approved"
? "#dcfce7"
: item.status==="Rejected"
? "#fee2e2"
: "#fef3c7",

color:
item.status==="Approved"
? "#15803d"
: item.status==="Rejected"
? "#dc2626"
: "#b45309"
}}
>

{item.status}

</span>

<br />

{item.approvedBy && (

<div
style={{
marginTop:8,
fontSize:12,
color:"#64748b"
}}
>

{item.approvedBy}

<br />

{item.approvedAt?.toDate?.().toLocaleDateString()}

</div>

)}

</td>

<td style={td}>

<textarea
rows={2}
style={{
width:"100%",
padding:"10px",
border:"1px solid #dbe4f0",
borderRadius:"10px",
resize:"none",
fontSize:"14px",
}}

rows={2}

placeholder="HR Remarks..."

value={remarks[item.id] || ""}

onChange={(e)=>

setRemarks({

...remarks,

[item.id]:e.target.value

})

}

style={{

width:"100%",

padding:8,

borderRadius:8,

border:"1px solid #ddd"

}}

>

</textarea>

</td>

<td style={td}>

<button

style={greenBtn}

onClick={()=>

updateLeaveStatus(item.id,"Approved")

}

>

Approve

</button>

<button

style={redBtn}

onClick={()=>

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
</div>

);

}

const th={
padding:"18px",
background:"#2563eb",
color:"#fff",
fontSize:"15px",
fontWeight:"700",
textAlign:"left",
whiteSpace:"nowrap",
};

const td={
padding:"18px",
borderBottom:"1px solid #edf2f7",
verticalAlign:"middle",
whiteSpace:"nowrap",
};

const greenBtn={
background:"#16a34a",
color:"#fff",
border:"none",
padding:"10px 18px",
borderRadius:"10px",
cursor:"pointer",
fontWeight:"600",
marginRight:"8px",
};

const redBtn={
background:"#ef4444",
color:"#fff",
border:"none",
padding:"10px 18px",
borderRadius:"10px",
cursor:"pointer",
fontWeight:"600",
};