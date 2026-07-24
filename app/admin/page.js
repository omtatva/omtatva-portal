"use client";

import { useEffect, useState } from "react";

import { 
  onAuthStateChanged 
} from "firebase/auth";

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


const [loading,setLoading] = useState(true);

const [totalEmployees,setTotalEmployees] = useState(0);

const [attendanceCount,setAttendanceCount] = useState(0);

const [timesheetCount,setTimesheetCount] = useState(0);

const [inactiveUsers,setInactiveUsers] = useState(0);

const [activities,setActivities] = useState([]);



useEffect(()=>{


const unsubscribe = onAuthStateChanged(
auth,

async(user)=>{


if(!user){

window.location.href="/admin/login";

return;

}



try{


const userRef = doc(
db,
"users",
user.uid
);


const userSnap = await getDoc(userRef);



if(!userSnap.exists()){


alert("User not found");

window.location.href="/";

return;

}



const data = userSnap.data();



const allowedEmails=[

"admin@omtatvadigitals.com",
"hr@omtatvadigitals.com",
"itsupport@omtatvadigitals.com"

];



const allowedRoles=[

"admin",
"hr",
"Developer"

];



const emailAllowed =
allowedEmails.includes(user.email);



const roleAllowed =
allowedRoles.includes(
(data.role || "").toLowerCase()
);



if(!emailAllowed && !roleAllowed){


alert("Access Denied");

window.location.href="/";

return;


}



await loadDashboard();

await loadActivities();


setLoading(false);



}

catch(error){

console.log(error);

}


}

);


return ()=>unsubscribe();


},[]);






const loadDashboard = async()=>{


try{


const usersSnap =
await getDocs(
collection(db,"users")
);



const users =
usersSnap.docs.map(
doc=>doc.data()
);



setTotalEmployees(
users.length
);



setInactiveUsers(

users.filter(
user=>
(user.status || "")
.toLowerCase()
==="inactive"

).length

);




const attendanceSnap =
await getDocs(
collection(db,"attendance")
);



setAttendanceCount(
attendanceSnap.size
);





const timesheetSnap =
await getDocs(
collection(db,"timesheets")
);



setTimesheetCount(
timesheetSnap.size
);



}

catch(error){

console.log(error);

}


};







const loadActivities = async()=>{


try{


const q=query(

collection(
db,
"activityLogs"
),

orderBy(
"createdAt",
"desc"
),

limit(10)

);



const snap =
await getDocs(q);



const list =
snap.docs.map(doc=>({

id:doc.id,
...doc.data()

}));



setActivities(list);



}

catch(error){

console.log(error);

}


};







if(loading){


return(

<div

style={{

minHeight:"100vh",

display:"flex",

justifyContent:"center",

alignItems:"center",

fontSize:"22px",

fontWeight:700,

color:"#3d6fa8"

}}

>

Loading Admin Dashboard...

</div>


)


}






return(


<div

style={{

width:"90%",

padding:"25px",

background:"#f5f8fc",

minHeight:"100vh"

}}

>



{/* HEADER */}


<div

style={{

background:"#ffffff",

padding:"35px",

borderRadius:"25px",

marginBottom:"30px",

boxShadow:
"0 10px 30px rgba(61,111,168,0.12)",

border:
"1px solid #eaf3ff"

}}

>


<h1

style={{

fontSize:"42px",

fontWeight:800,

margin:0,

color:"#111111"

}}

>

🏢 Admin Dashboard

</h1>



<p

style={{

fontSize:"19px",

color:"#444444",

marginTop:"12px"

}}

>

Manage HR, Payroll, Creative Production & AI Operations from one place.

</p>



<div

style={{

height:"5px",

width:"180px",

borderRadius:"10px",

background:
"linear-gradient(90deg,#3d6fa8,#66a8e0)"

}}

></div>



</div>





{/* STATISTICS CARDS */}


<div

style={{

display:"grid",

gridTemplateColumns:
"repeat(auto-fit,minmax(220px,1fr))",

gap:"22px",

marginBottom:"35px"

}}

>


<StatCard

title="Employees"

value={totalEmployees}

icon="👥"

/>


<StatCard

title="Attendance"

value={attendanceCount}

icon="🕒"

/>


<StatCard

title="Timesheets"

value={timesheetCount}

icon="📋"

/>


<StatCard

title="Inactive"

value={inactiveUsers}

icon="⚠️"

/>


</div>

// QUICK ACTIONS

<div
style={{
background:"#ffffff",
padding:"30px",
borderRadius:"22px",
boxShadow:"0 10px 25px rgba(61,111,168,0.12)",
marginBottom:"30px"
}}
>


<h2

style={{

fontSize:"28px",

fontWeight:800,

color:"#111111",

marginBottom:"25px"

}}

>

⚡ Quick Actions

</h2>



<div

style={{

display:"grid",

gridTemplateColumns:
"repeat(auto-fit,minmax(220px,1fr))",

gap:"20px"

}}

>


{

[

["👥 Employee Management","/admin/users"],

["🕒 Attendance","/admin/attendance"],

["🏖 Leave","/admin/leave"],

["💰 Payroll","/admin/payroll"],

["📋 Timesheets","/admin/timesheet"],

["📄 Documents","/admin/documents"],

["📊 Reports","/admin/reports"],

["🎬 AI Production","/admin/production"],

["📅 Holidays","/admin/holidays"]

].map(([title,link])=>(


<button

key={title}

onClick={()=>window.location.href=link}

style={{

padding:"25px",

borderRadius:"18px",

background:"#eaf3ff",

border:"1px solid #66a8e0",

fontSize:"17px",

fontWeight:700,

color:"#111111",

cursor:"pointer",

transition:"0.3s"

}}


onMouseEnter={(e)=>{

e.currentTarget.style.background="#3d6fa8";

e.currentTarget.style.color="#ffffff";

}}


onMouseLeave={(e)=>{

e.currentTarget.style.background="#eaf3ff";

e.currentTarget.style.color="#111111";

}}


>

{title}

</button>


))


}


</div>


</div>







{/* ACTIVITY + OVERVIEW */}



<div

style={{

display:"grid",

gridTemplateColumns:"2fr 1fr",

gap:"25px"

}}

>



{/* RECENT ACTIVITY */}



<div

style={{

background:"#ffffff",

padding:"30px",

borderRadius:"22px",

boxShadow:
"0 10px 25px rgba(61,111,168,0.12)"

}}

>


<h2

style={{

fontSize:"26px",

fontWeight:800,

color:"#111111"

}}

>

📢 Recent Activity

</h2>




<table

style={{

width:"100%",

marginTop:"20px",

borderCollapse:"collapse"

}}

>


<thead>

<tr>


<th style={thStyle}>
Employee
</th>


<th style={thStyle}>
Activity
</th>


<th style={thStyle}>
Time
</th>


</tr>

</thead>




<tbody>


{

activities.length===0 ?


<tr>

<td

colSpan="3"

style={{

textAlign:"center",

padding:"25px",

color:"#444"

}}

>

No Activity Found

</td>

</tr>



:


activities.map((item)=>(


<tr key={item.id}>


<td style={tdStyle}>

<b>
{item.employeeName || "-"}
</b>

</td>



<td style={tdStyle}>


<span

style={{

background:"#eaf3ff",

color:"#3d6fa8",

padding:"8px 14px",

borderRadius:"20px",

fontWeight:600

}}

>

{item.activity}

</span>


</td>




<td style={tdStyle}>


{

item.createdAt?.toDate

?

item.createdAt
.toDate()
.toLocaleString()

:

"-"

}


</td>



</tr>


))


}



</tbody>


</table>



</div>








{/* OVERVIEW */}



<div

style={{

background:"#ffffff",

padding:"30px",

borderRadius:"22px",

boxShadow:
"0 10px 25px rgba(61,111,168,0.12)"

}}

>


<h2

style={{

fontSize:"26px",

fontWeight:800,

color:"#111111"

}}

>

📌 Overview

</h2>



<div

style={{

display:"flex",

flexDirection:"column",

gap:"18px",

marginTop:"25px"

}}

>


<OverviewItem

title="Today's Attendance"

value={`${attendanceCount} Records`}

/>



<OverviewItem

title="Total Employees"

value={totalEmployees}

/>



<OverviewItem

title="Inactive Employees"

value={inactiveUsers}

/>



<OverviewItem

title="Timesheets Submitted"

value={timesheetCount}

/>



</div>


</div>





</div>



</div>



);

}


function StatCard({
title,
value,
icon
}){

return(

<div

style={{

background:"#ffffff",

padding:"28px",

borderRadius:"22px",

border:"1px solid #eaf3ff",

boxShadow:
"0 8px 25px rgba(61,111,168,0.12)",

position:"relative",

overflow:"hidden"

}}

>


<div

style={{

position:"absolute",

right:"-25px",

top:"-25px",

width:"100px",

height:"100px",

borderRadius:"50%",

background:"#eaf3ff"

}}

></div>



<div

style={{

fontSize:"42px",

marginBottom:"15px"

}}

>

{icon}

</div>




<p

style={{

margin:0,

fontSize:"17px",

fontWeight:600,

color:"#444444"

}}

>

{title}

</p>




<h1

style={{

fontSize:"42px",

fontWeight:800,

color:"#3d6fa8",

margin:"10px 0"

}}

>

{value}

</h1>




<div

style={{

height:"5px",

width:"70px",

borderRadius:"10px",

background:
"linear-gradient(90deg,#3d6fa8,#66a8e0)"

}}

></div>



</div>


)

}







function OverviewItem({

title,

value

}){


return(


<div

style={{

background:"#eaf3ff",

padding:"18px",

borderRadius:"15px",

border:"1px solid #66a8e0"

}}

>


<p

style={{

margin:0,

fontSize:"15px",

fontWeight:600,

color:"#444444"

}}

>

{title}

</p>



<h2

style={{

margin:"8px 0 0",

fontSize:"28px",

fontWeight:800,

color:"#3d6fa8"

}}

>

{value}

</h2>



</div>


)


}







const thStyle = {

padding:"15px",

textAlign:"left",

background:"#eaf3ff",

color:"#111111",

fontWeight:700,

borderBottom:"1px solid #66a8e0"

};




const tdStyle = {

padding:"15px",

color:"#444444",

borderBottom:"1px solid #edf2f7"

};


// "use client";

// import { useEffect, useState } from "react";
// import { onAuthStateChanged } from "firebase/auth";
// import {
//   collection,
//   getDocs,
//   doc,
//   getDoc,
//   limit,
//   query,
//   orderBy
// } from "firebase/firestore";

// import { auth, db } from "../../lib/firebase";

// export default function AdminPage() {
//   const [loading, setLoading] = useState(true);

//   const [totalEmployees, setTotalEmployees] = useState(0);
//   const [attendanceCount, setAttendanceCount] = useState(0);
//   const [timesheetCount, setTimesheetCount] = useState(0);
//   const [inactiveUsers, setInactiveUsers] = useState(0);
// const [activities, setActivities] = useState([]);
//   useEffect(() => {
//   const unsubscribe = onAuthStateChanged(auth, async (user) => {
//     if (!user) {
//       window.location.href = "/admin/login";
//       return;
//     }

//     try {
//       const userRef = doc(db, "users", user.uid);
//       const userSnap = await getDoc(userRef);

//       if (!userSnap.exists()) {
//         alert("User not found");
//         window.location.href = "/";
//         return;
//       }

//       const data = userSnap.data();

//       const allowedEmails = [
//         "admin@omtatvadigitals.com",
//         "hr@omtatvadigitals.com",
//         "owner@omtatvadigitals.com",
//       ];

//       const allowedRoles = [
//         "admin",
//         "owner",
//         "hr",
//       ];

//       const emailAllowed = allowedEmails.includes(user.email || "");

//       const roleAllowed = allowedRoles.includes(
//         (data.role || "").toLowerCase()
//       );

//       if (!emailAllowed && !roleAllowed) {
//         alert("Access Denied");
//         window.location.href = "/";
//         return;
//       }

//       await loadDashboard();
//       setLoading(false);

//     } catch (error) {
//       console.error(error);
//     }
//   });

//   return () => unsubscribe();
// }, []);

// useEffect(() => {
//   loadActivities();
// }, []);

// const loadActivities = async () => {

//   const q = query(
//     collection(db, "activityLogs"),
//     orderBy("createdAt", "desc"),
//     limit(10)
//   );

//   const snapshot = await getDocs(q);

//   const list = snapshot.docs.map(doc => ({
//     id: doc.id,
//     ...doc.data(),
//   }));

//   setActivities(list);

// };

// const loadDashboard = async () => {
//   try {
//     const usersSnapshot = await getDocs(collection(db, "users"));

//     const users = usersSnapshot.docs.map((doc) => doc.data());

//     setTotalEmployees(users.length);

//     setInactiveUsers(
//         users.filter(
//   (user) =>
//     (user.status || "").toLowerCase() === "inactive"
// ).length

//     );

//     const attendanceSnapshot = await getDocs(
//       collection(db, "attendance")
//     );

//     setAttendanceCount(attendanceSnapshot.size);

//     const timesheetSnapshot = await getDocs(
//       collection(db, "timesheets")
//     );

//     setTimesheetCount(timesheetSnapshot.size);

//   } catch (error) {
//     console.error(error);
//   }
// };

//   if (loading) {
//   return (
//     <div
//       style={{
//         minHeight: "100vh",
//         display: "flex",
//         justifyContent: "center",
//         alignItems: "center",
//         fontSize: "22px",
//         fontWeight: "600",
//       }}
//     >
//       Loading Admin Dashboard...
//     </div>
//   );
// }

// return (
// <div
// style={{
//     width: "100%",
//     padding: "8px",
//     background: "#F5F7FB",
//     minHeight: "100%",
//   }}
// // style={{
// // maxWidth:"1500px",
// // margin:"30px auto",
// // padding:"25px"
// // }}
// >

// <h1
// style={{
// fontSize:"38px",
// fontWeight:"700",
// marginBottom:"8px"
// }}
// >
// 🏢 Admin Dashboard
// </h1>

// <p
// style={{
// color:"#64748b",
// marginBottom:"35px"
// }}
// >
// Manage HR, Production & AI Operations from one place.
// </p>


// {/* Statistics */}

// <div
// style={{
// display:"grid",
// gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",
// gap:"20px",
// marginBottom:"35px"
// }}
// >

// {[
// {
// title:"Employees",
// value:totalEmployees,
// color:"#2563eb",
// icon:"👥"
// },
// {
// title:"Attendance",
// value:attendanceCount,
// color:"#16a34a",
// icon:"🕒"
// },
// {
// title:"Timesheets",
// value:timesheetCount,
// color:"#9333ea",
// icon:"📋"
// },
// {
// title:"Inactive",
// value:inactiveUsers,
// color:"#dc2626",
// icon:"⚠️"
// }
// ].map((card)=>(

// <div
// key={card.title}
// style={{
// background:"#fff",
// borderRadius:"18px",
// padding:"25px",
// boxShadow:"0 10px 25px rgba(0,0,0,.08)"
// }}
// >

// <div
// style={{
// display:"flex",
// justifyContent:"space-between",
// alignItems:"center"
// }}
// >

// <div>

// <p
// style={{
// margin:0,
// color:"#64748b"
// }}
// >
// {card.title}
// </p>

// <h1
// style={{
// margin:"10px 0 0",
// fontSize:"40px",
// color:card.color
// }}
// >
// {card.value}
// </h1>

// </div>

// <div
// style={{
// fontSize:"45px"
// }}
// >
// {card.icon}
// </div>

// </div>

// </div>

// ))

// }

// </div>


// {/* Quick Actions */}

// <div
// style={{
// background:"#fff",
// padding:"30px",
// borderRadius:"18px",
// boxShadow:"0 10px 25px rgba(0,0,0,.08)",
// marginBottom:"30px"
// }}
// >

// <h2
// style={{
// marginBottom:"25px"
// }}
// >
// ⚡ Quick Actions
// </h2>

// <div
// style={{
// display:"grid",
// gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",
// gap:"20px"
// }}
// >

// {[
// ["👥 Employee Management","/admin/users"],
// ["🕒 Attendance","/admin/attendance"],
// ["🏖 Leave","/admin/leave"],
// ["💰 Payroll","/admin/payroll"],
// ["📋 Timesheets","/admin/timesheet"],
// ["📄 Documents","/admin/documents"],
// ["📊 Reports","/admin/reports"],
// ["🎬 AI Production","/admin/production"],
// ["📅 Holidays", "/admin/holidays"]
// ].map(([title,link])=>(

// <button
// key={title}
// onClick={()=>window.location.href=link}
// style={{
// padding:"25px",
// borderRadius:"15px",
// background:"#f8fbff",
// border:"1px solid #dbeafe",
// fontSize:"17px",
// fontWeight:"600",
// cursor:"pointer",
// transition:".3s"
// }}
// >

// {title}

// </button>

// ))

// }

// </div>

// </div>


// {/* Activity */}

// <div
// style={{
// display:"grid",
// gridTemplateColumns:"2fr 1fr",
// gap:"25px"
// }}
// >

// <div
// style={{
// background:"#fff",
// padding:"30px",
// borderRadius:"18px",
// boxShadow:"0 10px 25px rgba(0,0,0,.08)"
// }}
// >

// <h2>📢 Recent Activity</h2>

// <table
// style={{
// width:"100%",
// marginTop:"20px",
// borderCollapse:"collapse"
// }}
// >

// <thead>

// <tr>

// <th style={thStyle}>Employee</th>

// <th style={thStyle}>Activity</th>

// <th style={thStyle}>Time</th>

// </tr>

// </thead>

// <tbody>

// {activities.map((item) => (

// <tr key={item.id}>

// <td style={tdStyle}>
// {item.employeeName}
// </td>

// <td style={tdStyle}>
// {item.activity}
// </td>

// <td style={tdStyle}>
// {item.createdAt?.toDate().toLocaleString()}
// </td>

// </tr>

// ))}

// </tbody>

// </table>

// </div>


// <div
// style={{
// background:"#fff",
// padding:"30px",
// borderRadius:"18px",
// boxShadow:"0 10px 25px rgba(0,0,0,.08)"
// }}
// >

// <h2>📌 Overview</h2>

// <div
// style={{
// marginTop:"20px",
// display:"flex",
// flexDirection:"column",
// gap:"20px"
// }}
// >

// <div>

// <h3>Today's Attendance</h3>

// <p>{attendanceCount} Records</p>

// </div>

// <div>

// <h3>Employees</h3>

// <p>{totalEmployees}</p>

// </div>

// <div>

// <h3>Inactive</h3>

// <p>{inactiveUsers}</p>

// </div>

// <div>

// <h3>Timesheets</h3>

// <p>{timesheetCount}</p>

// </div>

// </div>

// </div>

// </div>

// </div>
// );
// }

// const buttonStyle = {
// background: "#2563eb",
// color: "#fff",
// border: "none",
// padding: "12px 20px",
// borderRadius: "8px",
// cursor: "pointer",
// fontWeight: "600",
// };

// const thStyle = {
// padding: "15px",
// textAlign: "left",
// background: "#f8fafc",
// borderBottom: "1px solid #e5e7eb",
// };

// const tdStyle = {
// padding: "15px",
// borderBottom: "1px solid #f1f5f9",
// };