"use client";

import {useEffect,useState} from "react";

import {
onAuthStateChanged
} from "firebase/auth";



import {
BarChart,
Bar,
LineChart,
Line,
XAxis,
YAxis,
Tooltip,
ResponsiveContainer,
PieChart,
Pie,
Cell
} from "recharts";


import { auth, db } from "@/lib/firebase";

import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  getDoc
} from "firebase/firestore";


import AttendanceCalendar from "./AttendanceCalendar";



export default function AttendancePage(){


const [user,setUser]=useState(null);

const [todayData,setTodayData]=useState(null);

const [history,setHistory]=useState([]);

const [attendanceRules,setAttendanceRules]=useState(null);

const [locationStatus,setLocationStatus]=useState("");

const [distance,setDistance]=useState(0);

const [currentLocation,setCurrentLocation]=useState(null);

const [insideOffice,setInsideOffice]=useState(false);
const [stats,setStats]=useState({

present:0,

absent:0,

late:0,

hours:0

});



const today =
new Date()
.toISOString()
.substring(0,10);


useEffect(() => {

  const unsubscribe = onAuthStateChanged(
    auth,
    async (currentUser) => {

      if (!currentUser) {
        window.location.href = "/login";
        return;
      }

      setUser(currentUser);

      await loadAttendanceRules();

      await loadToday(currentUser.uid);

      await loadHistory(currentUser.uid);

      await checkOfficeRange();

    }
  );

  return () => unsubscribe();

}, []);

// =======================
// LOAD ATTENDANCE RULES
// =======================

async function loadAttendanceRules(){

try{

const snap = await getDoc(
doc(db,"settings","attendanceRules")
);

if(snap.exists()){

setAttendanceRules(snap.data());

}

}catch(error){

console.log(error);

}

}



// =======================
// DATE HELPERS
// =======================

function convertDate(value){

if(!value) return null;

if(value.toDate)
return value.toDate();

return new Date(value);

}

function formatTime(value){

const d = convertDate(value);

if(!d) return "--";

return d.toLocaleTimeString([],{
hour:"2-digit",
minute:"2-digit"
});

}



// =======================
// GPS
// =======================

async function getCurrentLocation(){

return new Promise((resolve,reject)=>{

if(!navigator.geolocation){

reject(new Error("Location not supported"));
return;

}

navigator.geolocation.getCurrentPosition(

(position)=>{

resolve(position);

},

(error)=>{

reject(error);

},

{

enableHighAccuracy:true,

timeout:10000,

maximumAge:0

}

);

});

}



// =======================
// DISTANCE
// =======================

function calculateDistance(
lat1,
lon1,
lat2,
lon2
){

const R = 6371000;

const dLat =
(lat2-lat1) *
Math.PI/180;

const dLon =
(lon2-lon1) *
Math.PI/180;

const a =

Math.sin(dLat/2) *
Math.sin(dLat/2)

+

Math.cos(lat1*Math.PI/180)

*

Math.cos(lat2*Math.PI/180)

*

Math.sin(dLon/2)

*

Math.sin(dLon/2);

const c =

2 *

Math.atan2(

Math.sqrt(a),

Math.sqrt(1-a)

);

return Math.round(R*c);

}



// =======================
// CHECK OFFICE RANGE
// =======================

async function checkOfficeRange(){

if(!attendanceRules){

return false;

}

try{

const position =
await getCurrentLocation();

const latitude =
position.coords.latitude;

const longitude =
position.coords.longitude;

const accuracy =
position.coords.accuracy;

setCurrentLocation({

latitude,
longitude,
accuracy

});

const meter =
calculateDistance(

latitude,

longitude,

Number(attendanceRules.officeLatitude),

Number(attendanceRules.officeLongitude)

);

setDistance(meter);

const inside =
meter <= attendanceRules.officeRadius;

setInsideOffice(inside);

setLocationStatus(

inside
?

"Inside Office"

:

"Outside Office"

);

return inside;

}catch(error){

console.log(error);

alert("Unable to fetch GPS");

return false;

}

}

async function loadToday(uid){


const q=query(

collection(db,"attendance"),

where(
"userId",
"==",
uid
),

where(
"date",
"==",
today
)

);



const snap=
await getDocs(q);



if(!snap.empty){


setTodayData({

id:snap.docs[0].id,

...snap.docs[0].data()

});


}
else{


setTodayData(null);


}


}


async function loadHistory(uid){


const q=query(

collection(db,"attendance"),

where(
"userId",
"==",
uid
)

);



const snap=
await getDocs(q);



const list=
snap.docs.map(doc=>({

id:doc.id,

...doc.data()

}));


setHistory(list);



let hours=0;

let late=0;



list.forEach(item=>{


hours+=Number(
item.totalHours || 0
);



const punch=
convertDate(
item.PunchIn
);



if(punch){

if(
punch.getHours()>9 ||
(
punch.getHours()===9 &&
punch.getMinutes()>30
)

){

late++;

}

}


});




setStats({

present:list.length,

absent:0,

late,

hours:Number(
hours.toFixed(1)
)

});


}


async function punchIn(){

try{

if(!user) return;

if(todayData){

alert("Already punched in today");

return;

}

// Attendance Rules

if(!attendanceRules){

alert("Attendance Rules not found.");

return;

}

const officeLatitude =
Number(attendanceRules.officeLatitude);

const officeLongitude =
Number(attendanceRules.officeLongitude);

const allowedRadius =
Number(attendanceRules.officeRadius);

// Current GPS

const position =
await getCurrentLocation();

const latitude =
position.coords.latitude;

const longitude =
position.coords.longitude;

const accuracy =
position.coords.accuracy;

const meter =
calculateDistance(

latitude,

longitude,

officeLatitude,

officeLongitude

);

// Update UI

setDistance(meter);

setCurrentLocation({

latitude,
longitude,
accuracy

});

const inside =
meter <= allowedRadius;

setInsideOffice(inside);

setLocationStatus(

inside
?
"Inside Office"
:
"Outside Office"

);

// Stop if outside

if(
!inside &&
attendanceRules.restrictOutsideOffice &&
!attendanceRules.allowRemotePunch
){

alert(

`You are outside office range.

Distance : ${meter} m`

);

return;

}

// Save Attendance

await addDoc(

collection(db,"attendance"),

{

userId:user.uid,

employeeName:
user.displayName || "",

email:user.email,

date:today,

PunchIn:new Date(),

PunchOut:null,

totalHours:0,

status:"Present",

attendanceSource:"Mobile",

latitude,

longitude,

accuracy,

distanceFromOffice:meter,

gpsStatus:

inside
?
"Inside Office"
:
"Outside Office",

createdAt:new Date()

}

);

await loadToday(user.uid);

await loadHistory(user.uid);

alert("Punch In Successful");

}

catch(error){

console.log(error);

alert(
"Unable to get GPS location. Please enable location."
);

}


};






async function punchOut(){


try{


if(!todayData){

alert("Please punch in first");

return;

}



if(todayData.PunchOut){

alert("Already punched out");

return;

}





const q=query(

collection(db,"attendance"),

where(
"userId",
"==",
user.uid
),

where(
"date",
"==",
today
)

);



const snap=
await getDocs(q);



const ref=
snap.docs[0].ref;




const start=
convertDate(
todayData.PunchIn
);



const end=
new Date();




const hours=
(
(end-start)/
(1000*60*60)

).toFixed(2);


const position =
await getCurrentLocation();

const latitude =
position.coords.latitude;

const longitude =
position.coords.longitude;

const accuracy =
position.coords.accuracy;


const meter =
calculateDistance(

latitude,

longitude,

Number(attendanceRules.officeLatitude),

Number(attendanceRules.officeLongitude)

);


await updateDoc(
ref,
{

PunchOut:end,

totalHours:Number(hours),

punchOutLatitude:latitude,

punchOutLongitude:longitude,

punchOutAccuracy:accuracy,

punchOutDistanceFromOffice:meter

}

);



await loadToday(user.uid);

await loadHistory(user.uid);



alert("Punch Out Successful");



}
catch(error){

console.log(error);

alert(error.message);

}



}

const chartData =
history.map(item=>({

date:item.date,

hours:Number(
item.totalHours || 0
)

}));





const pieData=[

{
name:"Present",
value:stats.present
},

{
name:"Late",
value:stats.late
},

{
name:"Absent",
value:stats.absent
}

];


return (

<div className="
flex
flex-col
md:flex-row
md:justify-between
gap-4
items-start
md:items-center
">


<main className="
w-full
max-w-screen-xl
mx-auto
px-4
py-4
overflow-hidden
">


{/* TOP HEADER */}
<section className="
bg-[#eaf3ff]
rounded-2xl
p-6
mb-6
border
border-[#66a8e0]
">


<div className="
flex
justify-between
items-center
">


<div>


<h1 className="
text-3xl
font-bold
text-[#111]
">

Attendance Dashboard

</h1>


<p className="
text-[#444]
mt-2
">

Employee attendance management system

</p>


</div>




<div className="
bg-[#3d6fa8]
text-white
px-6
py-3
rounded-xl
font-semibold
">


{
todayData

?

"🟢 Present Today"

:

"⚪ Not Checked"

}


</div>


</div>


</section>








{/* SUMMARY CARDS */}


<div className="
grid
grid-cols-2
lg:grid-cols-4
gap-3
mb-5
">



<StatCard

icon="🟢"

title="Present Days"

value={stats.present}

/>



<StatCard

icon="🔴"

title="Absent Days"

value={stats.absent}

/>



<StatCard

icon="🟡"

title="Late Days"

value={stats.late}

/>



<StatCard

icon="⏱"

title="Working Hours"

value={`${stats.hours} hrs`}

/>



</div>

{/* MAIN GRID */}

<div className="
grid
xl:grid-cols-2
gap-6
mb-8
">



{/* TODAY ATTENDANCE */}

<div className="
bg-white
rounded-3xl
p-7
border
border-[#eaf3ff]
shadow-sm
">


<h2 className="
text-xl
font-bold
text-[#111]
">

Today's Attendance

</h2>



<div className="
grid
grid-cols-2
gap-5
mt-6
">


<InfoBox

title="Punch In"

value={
formatTime(
todayData?.PunchIn
)
}

/>



<InfoBox

title="Punch Out"

value={
formatTime(
todayData?.PunchOut
)
}

/>



</div>





<div className="
flex
gap-4
mt-8
">


<button

onClick={punchIn}

disabled={todayData}

className="
flex-1
bg-[#3d6fa8]
text-white
py-3
rounded-xl
font-semibold
disabled:bg-gray-300
hover:bg-[#325d8d]
transition
"

>

Punch In

</button>





<button

onClick={punchOut}

disabled={
!todayData ||
todayData.PunchOut
}

className="
flex-1
bg-[#66a8e0]
text-white
py-3
rounded-xl
font-semibold
disabled:bg-gray-300
hover:bg-[#5595ca]
transition
"

>

Punch Out

</button>


</div>



</div>





{/* CALENDAR */}


<AttendanceCalendar

history={history}

/>



</div>







{/* GRAPH SECTION */}


<div className="
grid
xl:grid-cols-2
gap-6
mb-8
">





{/* BAR CHART */}


<div className="
bg-white
rounded-3xl
p-7
border
border-[#eaf3ff]
shadow-sm
">


<h2 className="
text-xl
font-bold
mb-5
">

Working Hours

</h2>



<ResponsiveContainer

width="100%"

height={280}

>


<BarChart data={chartData}>


<XAxis

dataKey="date"

/>


<YAxis/>


<Tooltip/>


<Bar

dataKey="hours"

fill="#3d6fa8"

radius={[
8,
8,
0,
0
]}

/>


</BarChart>



</ResponsiveContainer>


</div>








{/* LINE CHART */}


<div className="
bg-white
rounded-3xl
p-7
border
border-[#eaf3ff]
shadow-sm
">


<h2 className="
text-xl
font-bold
mb-5
">

Attendance Trend

</h2>



<ResponsiveContainer

width="100%"

height={280}

>


<LineChart

data={chartData}

>


<XAxis

dataKey="date"

/>


<YAxis/>


<Tooltip/>


<Line

type="monotone"

dataKey="hours"

stroke="#66a8e0"

strokeWidth={3}

/>



</LineChart>



</ResponsiveContainer>


</div>



</div>

{/* // ================= PIE + HISTORY ================= */}


<div className="
grid
xl:grid-cols-3
gap-6
mb-8
">



{/* PIE CHART */}


<div className="
bg-white
rounded-3xl
p-7
border
border-[#eaf3ff]
shadow-sm
">


<h2 className="
text-xl
font-bold
mb-5
">

Attendance Status

</h2>



<ResponsiveContainer

width="100%"

height={260}

>


<PieChart>


<Pie

data={pieData}

dataKey="value"

nameKey="name"

outerRadius={90}

label

>


<Cell fill="#3d6fa8"/>

<Cell fill="#66a8e0"/>

<Cell fill="#eaf3ff"/>


</Pie>


</PieChart>



</ResponsiveContainer>



</div>








{/* HISTORY TABLE */}



<div className="
xl:col-span-2
bg-white
rounded-3xl
p-7
border
border-[#eaf3ff]
shadow-sm
">


<h2 className="
text-xl
font-bold
mb-5
">

Attendance History

</h2>



<div className="
overflow-x-auto
">


<table className="
w-full
text-left
">


<thead>


<tr className="
border-b
text-[#444]
">


<th className="
py-3
">

Date

</th>


<th>

Punch In

</th>


<th>

Punch Out

</th>


<th>

Hours

</th>


<th>

Status

</th>


</tr>


</thead>



<tbody>


{
history.map(item=>(


<tr

key={item.id}

className="
border-b
hover:bg-[#eaf3ff]
transition
"

>


<td className="
py-4
">

{item.date}

</td>



<td>

{
formatTime(
item.PunchIn
)
}

</td>



<td>

{
formatTime(
item.PunchOut
)
}

</td>



<td>

{
item.totalHours || 0
}

 hrs

</td>




<td>


<span className="
bg-[#eaf3ff]
text-[#3d6fa8]
px-3
py-1
rounded-full
text-sm
">

{
item.status
}

</span>


</td>


</tr>


))

}



</tbody>


</table>


</div>


</div>


</div>

  </main>
</div>

);

}




// ================= COMPONENTS =================


function StatCard({
icon,
title,
value
}){


return (

<div className="
bg-white
rounded-3xl
p-6
border
border-[#eaf3ff]
shadow-sm
hover:shadow-md
transition
">


<div className="
w-12
h-12
rounded-xl
bg-[#eaf3ff]
flex
items-center
justify-center
text-2xl
">

{icon}

</div>



<p className="
mt-4
text-[#444]
text-sm
">

{title}

</p>



<h2 className="
text-3xl
font-bold
text-[#111]
mt-1
">

{value}

</h2>



</div>


);


}







function InfoBox({
title,
value
}){


return (

<div className="
bg-[#eaf3ff]
rounded-2xl
p-5
">


<p className="
text-[#444]
text-sm
">

{title}

</p>



<h3 className="
text-xl
font-bold
text-[#111]
mt-2
">

{value}

</h3>


</div>


);


}


// "use client";

// import { useEffect, useState } from "react";
// import { onAuthStateChanged } from "firebase/auth";

// import {
//   addDoc,
//   collection,
//   getDocs,
//   query,
//   where,
//   updateDoc,
// } from "firebase/firestore";

// import { auth, db } from "../../lib/firebase";


// export default function AttendancePage() {

//   const [attendance, setAttendance] = useState(null);
//   const [currentUser, setCurrentUser] = useState(null);
  
// const [myAttendance, setMyAttendance] = useState([]);
//   const [attendanceHistory, setAttendanceHistory] = useState([]);

//   const [presentDays, setPresentDays] = useState(0);
//   const [absentDays, setAbsentDays] = useState(0);
//   const [lateDays, setLateDays] = useState(0);
//   const [workingHours, setWorkingHours] = useState(0);

//   const today = new Date().toISOString().split("T")[0];

// useEffect(() => {

//   const unsubscribe = onAuthStateChanged(auth, async (user) => {

//     if (!user) {
//       window.location.href = "/login";
//       return;
//     }

//     setCurrentUser(user);

//     await loadAttendance(user.uid);

//     await loadAttendanceHistory(user.uid);

//   });

//   return () => unsubscribe();

// }, []);

// const loadAttendance = async (uid) => {

//   const q = query(
//     collection(db, "attendance"),
//     where("userId", "==", uid),
//     where("date", "==", today)
//   );

//   const snapshot = await getDocs(q);

//   if (!snapshot.empty) {

//     setAttendance({
//       id: snapshot.docs[0].id,
//       ...snapshot.docs[0].data(),
//     });

//   } else {

//     setAttendance(null);

//   }

// };

// const loadAttendanceHistory = async (uid) => {

//   const q = query(
//     collection(db, "attendance"),
//     where("userId", "==", uid)
//   );

//   const snapshot = await getDocs(q);

//   const list = snapshot.docs.map(doc => ({
//     id: doc.id,
//     ...doc.data(),
//   }));

//   setAttendanceHistory(list);
// setMyAttendance(list);

//   // Present Days
//   setPresentDays(list.length);

//   // Absent Days (you can improve this later)
//   setAbsentDays(0);

//   let late = 0;
//   let totalHours = 0;

//   list.forEach(item => {

//     if (item.PunchIn) {

//       const punchIn = item.PunchIn.toDate
//         ? item.PunchIn.toDate()
//         : new Date(item.PunchIn);

//       // Late after 9:15 AM
//       if (
//         punchIn.getHours() > 9 ||
//         (punchIn.getHours() === 9 &&
//           punchIn.getMinutes() > 15)
//       ) {
//         late++;
//       }

//     }

//     if (item.PunchIn && item.PunchOut) {

//       const inTime = item.PunchIn.toDate
//         ? item.PunchIn.toDate()
//         : new Date(item.PunchIn);

//       const outTime = item.PunchOut.toDate
//         ? item.PunchOut.toDate()
//         : new Date(item.PunchOut);

//       totalHours +=
//         (outTime - inTime) /
//         (1000 * 60 * 60);

//     }

//   });

//   setLateDays(late);
//   setWorkingHours(totalHours.toFixed(1));

// };

// const PunchIn = async () => {

//   const user = auth.currentUser;

//   if (!user) {
//     alert("Please login first");
//     return;
//   }

//   if (attendance) {
//     alert("Already Punched In Today");
//     return;
//   }

//   try {

//     await addDoc(collection(db, "attendance"), {
//   userId: user.uid,
//   employeeName: user.displayName || user.email,
//   email: user.email,

//   date: today,

//   PunchIn: new Date(),
//   PunchOut: null,

//   PunchIn: new Date(),
//   PunchOut: null,

//   totalHours: 0,

//   status: "Present",
// });

//     await loadAttendance(user.uid);
//     await loadAttendanceHistory(user.uid);

//     alert("Punch In Successful");

//   } catch (error) {

//     console.error(error);
//     alert("Punch In Failed");

//   }

// };

// const PunchOut = async () => {

//   const user = auth.currentUser;

//   if (!user) {
//     alert("Please login first");
//     return;
//   }

//   if (!attendance) {
//     alert("Please Punch In First");
//     return;
//   }

//   if (attendance.PunchOut) {
//     alert("Already Punched Out");
//     return;
//   }

//   try {

//     const q = query(
//       collection(db, "attendance"),
//       where("userId", "==", user.uid),
//       where("date", "==", today)
//     );

//     const snapshot = await getDocs(q);

//     if (snapshot.empty) {
//       alert("Attendance record not found.");
//       return;
//     }

//     const docRef = snapshot.docs[0].ref;

//     const outTime = new Date();

// const inTime = attendance.PunchIn.toDate
//   ? attendance.PunchIn.toDate()
//   : new Date(attendance.PunchIn);

// const hours =
//   ((outTime - inTime) / (1000 * 60 * 60)).toFixed(2);

// await updateDoc(docRef,{
//   PunchOut: outTime,

//   PunchOut: outTime,

//   totalHours: hours,

//   status: "Present",
// });

//     await loadAttendance(user.uid);
//     await loadAttendanceHistory(user.uid);

//     alert("Punch Out Successful");

//   } catch (error) {

//     console.error(error);
//     alert("Punch Out Failed");

//   }

// };

// const totalHours =
//   attendance?.PunchIn && attendance?.PunchOut
//     ? (
//         (
//           (
//             (attendance.PunchOut.toDate
//               ? attendance.PunchOut.toDate()
//               : new Date(attendance.PunchOut))
//             -
//             (attendance.PunchIn.toDate
//               ? attendance.PunchIn.toDate()
//               : new Date(attendance.PunchIn))
//           ) /
//           (1000 * 60 * 60)
//         ).toFixed(2)
//       )
//     : "--";

// return (
//   <div
//     style={{
//       maxWidth: "1400px",
//       margin: "40px auto",
//       padding: "30px",
//     }}
//   >
//     <h1>📅 Attendance Dashboard</h1>

//     <p
//       style={{
//         color: "#64748b",
//         marginBottom: "30px",
//       }}
//     >
//       Track your attendance, working hours and attendance history.
//     </p>

//     {/* Summary Cards */}

//     <div
//       style={{
//         display: "grid",
//         gridTemplateColumns: "repeat(4,1fr)",
//         gap: "20px",
//         marginBottom: "30px",
//       }}
//     >

//       <div style={cardStyle}>
//         <h3>Present Days</h3>
//         <h1>{presentDays}</h1>
//       </div>

//       <div style={cardStyle}>
//         <h3>Absent Days</h3>
//         <h1>{absentDays}</h1>
//       </div>

//       <div style={cardStyle}>
//         <h3>Late Days</h3>
//         <h1>{lateDays}</h1>
//       </div>

//       <div style={cardStyle}>
//         <h3>Working Hours</h3>
//         <h1>{workingHours} hrs</h1>
//       </div>

//     </div>

//     {/* Today's Attendance */}

//     <div
//       style={{
//         background: "#fff",
//         padding: "30px",
//         borderRadius: "15px",
//         boxShadow: "0 10px 25px rgba(0,0,0,.08)",
//       }}
//     >

//       <h2>🟢 Today's Attendance</h2>

//       <p>
//         <b>Employee :</b> {currentUser?.displayName || currentUser?.email}
//       </p>

//       <p>
//         <b>Date :</b> {today}
//       </p>

//       <p>
//         <b>Status :</b> {attendance?.status || "Not Punched In"}
//       </p>

//       <p>
//         <b>Punch In :</b>{" "}
//         {attendance?.PunchIn
//           ? (attendance.PunchIn.toDate
//               ? attendance.PunchIn.toDate()
//               : new Date(attendance.PunchIn)
//             ).toLocaleTimeString()
//           : "--"}
//       </p>

//       <p>
//         <b>Punch Out :</b>{" "}
//         {attendance?.PunchOut
//           ? (attendance.PunchOut.toDate
//               ? attendance.PunchOut.toDate()
//               : new Date(attendance.PunchOut)
//             ).toLocaleTimeString()
//           : "--"}
//       </p>

//       <p>
//         <b>Total Hours :</b> {totalHours} {totalHours !== "--" && "hrs"}
//       </p>

//       <div
//         style={{
//           display: "flex",
//           gap: "15px",
//           marginTop: "20px",
//         }}
//       >

//         <button
//           onClick={PunchIn}
//           style={greenBtn}
//           disabled={attendance && !attendance?.PunchOut}
//         >
//           Punch In
//         </button>

//         <button
//           onClick={PunchOut}
//           style={redBtn}
//           disabled={!attendance || attendance?.PunchOut}
//         >
//           Punch Out
//         </button>

//       </div>

//     </div>
// {/* Attendance History */}
//   <div
//     style={{
//       background: "#fff",
//       padding: "25px",
//       borderRadius: "15px",
//       boxShadow:
//         "0 5px 20px rgba(0,0,0,0.08)",
//       marginBottom: "30px",
//     }}
//   >
//     <h2>📅 Attendance History</h2>

//     <table
//       style={{
//         width: "100%",
//         marginTop: "20px",
//         borderCollapse: "collapse",
//       }}
//     >
//       <thead>
//         <tr>
//           <th style={thStyle}>Date</th>
//           <th style={thStyle}>Punch In</th>
//           <th style={thStyle}>Punch Out</th>
//         </tr>
//       </thead>

//       <tbody>
//         {myAttendance.map((item) => (
//           <tr key={item.id}>
//             <td style={tdStyle}>{item.date}</td>

//             <td style={tdStyle}>
//               {item.PunchIn
//                 ? item.PunchIn
//                     .toDate()
//                     .toLocaleTimeString()
//                 : "-"}
//             </td>

//             <td style={tdStyle}>
//               {item.PunchOut
//                 ? item.PunchOut
//                     .toDate()
//                     .toLocaleTimeString()
//                 : "-"}
//             </td>
//           </tr>
//         ))}
//       </tbody>
//     </table>
//   </div>

 
//   </div>
// );
// }


// const thStyle = {
// borderBottom: "1px solid #ddd",
// padding: "12px",
// textAlign: "left",
// background: "#f8fafc",
// };

// const tdStyle = {
// borderBottom: "1px solid #eee",
// padding: "12px",
// }; 
// const cardStyle = {
//   background: "#fff",
//   padding: "25px",
//   borderRadius: "15px",
//   textAlign: "center",
//   boxShadow: "0 10px 20px rgba(0,0,0,.08)",
// };

// const greenBtn = {
//   background: "#22c55e",
//   color: "#fff",
//   padding: "12px 24px",
//   border: "none",
//   borderRadius: "10px",
//   cursor: "pointer",
//   fontWeight: "bold",
// };

// const redBtn = {
//   background: "#ef4444",
//   color: "#fff",
//   padding: "12px 24px",
//   border: "none",
//   borderRadius: "10px",
//   cursor: "pointer",
//   fontWeight: "bold",
// };
