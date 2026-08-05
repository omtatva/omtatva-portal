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

const [wfhRequests,setWfhRequests]=useState([]);
const [wfhRemarks,setWfhRemarks]=useState({});

const [activeTab,setActiveTab]=useState("leave"); // "leave" | "wfh"


useEffect(()=>{

const unsubscribeLeave = loadRequests();
const unsubscribeWfh = loadWfhRequests();

return ()=>{
 if(unsubscribeLeave) unsubscribeLeave();
 if(unsubscribeWfh) unsubscribeWfh();
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


const loadWfhRequests = () => {

const unsubscribe = onSnapshot(
collection(db,"wfhRequests"),

(snapshot)=>{

const list = snapshot.docs.map((item)=>({
id:item.id,
...item.data()
}));

setWfhRequests(list);

},

(error)=>{

console.log("Load WFH Requests Error:",error);
setWfhRequests([]);

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

   // 3. Activity Log

const currentUser = auth.currentUser;


await addDoc(
  collection(db,"activityLogs"),
  {

    employeeName:
    leave.employeeName,

    uid:
    leave.uid,


    // Dashboard me dikhega
    activity:
    `Leave ${status}`,


    // Module name
    module:
    "Leave",


    // Ye kis type ka action hai
    type:
    "Leave",


    description:
    `${leave.leaveType} (${leave.fromDate} - ${leave.toDate})`,


    // Kisne kiya
    updatedBy:
    currentUser?.email || "Unknown",


    updatedByUid:
    currentUser?.uid || "",


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


const updateWfhStatus = async (id, status) => {

  try {

    const wfh = wfhRequests.find(r => r.id === id);

    if (!wfh) {
      alert("WFH record not found");
      return;
    }


    // 1. Update WFH status in Firestore

    await updateDoc(
      doc(db, "wfhRequests", id),
      {
        status: status,
        approvedBy: auth.currentUser?.displayName || "Admin",
        approvedAt: Timestamp.now(),
        remarks: wfhRemarks[id] || ""
      }
    );


    // 2. Activity Log

    await addDoc(
      collection(db,"activityLogs"),
      {

        employeeName:
        wfh.employeeName,

        uid:
        wfh.uid,

        activity:
        `WFH ${status}`,

        type:
        "WFH",

        description:
        `Work From Home (${wfh.date})`,

        createdAt:
        Timestamp.now()

      }
    );
// 3. Activity Log

const currentUser = auth.currentUser;


await addDoc(
  collection(db,"activityLogs"),
  {

    employeeName:
    wfh.employeeName,

    uid:
    wfh.uid,


    // Dashboard me dikhega
    activity:
    `WFH ${status}`,


    // Module name
    module:
    "wfh",


    // Ye kis type ka action hai
    type:
    "WFH",


    description:
    `${wfh.leaveType} (${wfh.fromDate} - ${wfh.toDate})`,


    // Kisne kiya
    updatedBy:
    currentUser?.email || "Unknown",


    updatedByUid:
    currentUser?.uid || "",


    createdAt:
    Timestamp.now()

  }
);

    alert("WFH Status Updated");


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

{/* Header */}

<div
style={{
display:"flex",
justifyContent:"space-between",
alignItems:"center",
width:"100%",
marginBottom:"30px",
}}
>

<div>

<h1
style={{
fontSize:"42px",
fontWeight:"800",
margin:0,
color:"#0f172a",
}}
>
🏖 Leave Requests
</h1>


<p
style={{
color:"#64748b",
fontSize:"18px",
marginTop:"10px",
}}
>
Approve or Reject employee leave and WFH requests.
</p>

</div>



<button
onClick={() => (window.location.href = "/admin")}
style={{
background:"#3d6fa8",
color:"#fff",
border:"none",
padding:"14px 30px",
fontSize:"16px",
fontWeight:"700",
borderRadius:"12px",
cursor:"pointer",
boxShadow:"0 8px 20px rgba(30,58,138,.25)",
}}
>
← Dashboard
</button>


</div>


{/* Tabs */}

<div
style={{
display:"flex",
gap:"12px",
marginBottom:"20px",
}}
>

<button
onClick={()=>setActiveTab("leave")}
style={{
padding:"12px 26px",
borderRadius:"12px",
border:"none",
fontWeight:"700",
fontSize:"15px",
cursor:"pointer",
background: activeTab==="leave" ? "#3d6fa8" : "#e2e8f0",
color: activeTab==="leave" ? "#fff" : "#334155",
}}
>
🏖 Leave Requests ({requests.length})
</button>

<button
onClick={()=>setActiveTab("wfh")}
style={{
padding:"12px 26px",
borderRadius:"12px",
border:"none",
fontWeight:"700",
fontSize:"15px",
cursor:"pointer",
background: activeTab==="wfh" ? "#3d6fa8" : "#e2e8f0",
color: activeTab==="wfh" ? "#fff" : "#334155",
}}
>
💻 WFH Requests ({wfhRequests.length})
</button>

</div>


{activeTab === "leave" && (

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

border:"1px solid #ddd",

resize:"none",

fontSize:"14px",

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

)}


{activeTab === "wfh" && (

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
minWidth:"1100px",
borderCollapse:"collapse"
}}
>

<thead>

<tr>

<th style={th}>Employee</th>

<th style={th}>Date</th>

<th style={th}>Reason</th>

<th style={th}>Status</th>

<th style={th}>HR Remarks</th>

<th style={th}>Action</th>

</tr>

</thead>

<tbody>

{wfhRequests && wfhRequests.map((item) => (

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

<td style={td}>{item.date}</td>

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

placeholder="HR Remarks..."

value={wfhRemarks[item.id] || ""}

onChange={(e)=>

setWfhRemarks({

...wfhRemarks,

[item.id]:e.target.value

})

}

style={{

width:"100%",

padding:8,

borderRadius:8,

border:"1px solid #ddd",

resize:"none",

fontSize:"14px",

}}

>

</textarea>

</td>

<td style={td}>

<button

style={greenBtn}

onClick={()=>

updateWfhStatus(item.id,"Approved")

}

>

Approve

</button>

<button

style={redBtn}

onClick={()=>

updateWfhStatus(item.id,"Rejected")

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

)}

</div>

);

}

const th={
padding:"18px",
background:"#3d6fa8",
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