"use client";

import {
useEffect,
useState
} from "react";
import { useRouter } from "next/navigation";
import AttendanceMap from "../../../components/attendanceMap";

import {
collection,
getDocs,
doc,
deleteDoc
} from "firebase/firestore";


import * as XLSX from "xlsx";


import {
db
} from "../../../lib/firebase";



export default function AttendancePage(){

const router = useRouter();
const [attendance,setAttendance]=useState([]);


const [loading,setLoading]=useState(true);


const [search,setSearch]=useState("");


const [statusFilter,setStatusFilter]=useState("");

const [gpsFilter,setGpsFilter]=useState("");

const [sourceFilter,setSourceFilter]=useState("");

const [view,setView]=useState("table");



const [calendarDate,setCalendarDate]=useState(
new Date()
);



const [selected,setSelected]=useState(null);
const [showMap,setShowMap]=useState(false);
useEffect(() => {
  loadAttendance();
}, []);

async function loadAttendance() {
  try {
    // Attendance records
    const attendanceSnap = await getDocs(
      collection(db, "attendance")
    );

    // Users
    const usersSnap = await getDocs(
      collection(db, "users")
    );

    // Create UID -> User map
    const usersMap = {};

    usersSnap.forEach((doc) => {
      usersMap[doc.id] = doc.data();
    });

    // Merge user details into attendance
    const list = attendanceSnap.docs.map((doc) => {
      const attendance = doc.data();
      const employee = usersMap[attendance.userId] || {};

      return {
        id: doc.id,
        ...attendance,
        employeeId: employee.employeeId || "--",
        employeeName:
          employee.employeeName ||
          attendance.employeeName ||
          "",
        email:
          employee.email ||
          attendance.email ||
          "--",
      };
    });

    setAttendance(list);

  } catch (error) {
    console.log(error);
  } finally {
    setLoading(false);
  }
}


async function deleteAttendance(id){


const confirmDelete=
window.confirm(
"Delete this attendance record?"
);



if(!confirmDelete)
return;



await deleteDoc(
doc(
db,
"attendance",
id
)
);



loadAttendance();


}






function formatTime(value){


if(!value)
return "--";



if(value.toDate){

return value
.toDate()
.toLocaleTimeString([],{
hour:"2-digit",
minute:"2-digit"
});

}


return value;


}







const filteredAttendance =
attendance.filter(item=>{


const name =
item.employeeName ||
item.email ||
"";



const searchMatch =
name
.toLowerCase()
.includes(
search.toLowerCase()
);



const statusMatch =
statusFilter===""
||
item.status===statusFilter;


const gpsMatch =
gpsFilter===""
||
item.gpsStatus===gpsFilter;


const sourceMatch =
sourceFilter===""
||
item.attendanceSource===sourceFilter;


return(
searchMatch &&
statusMatch &&
gpsMatch &&
sourceMatch
);


});





function changeMonth(value){


const d =
new Date(calendarDate);


d.setMonth(
d.getMonth()+value
);



setCalendarDate(d);


}





function daysInMonth(){


return new Date(

calendarDate.getFullYear(),

calendarDate.getMonth()+1,

0

).getDate();


}





function firstDay(){


return new Date(

calendarDate.getFullYear(),

calendarDate.getMonth(),

1

).getDay();


}





function getRecord(day){


const date =

`${calendarDate.getFullYear()}-${String(calendarDate.getMonth()+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;



return attendance.find(

item=>

item.date===date

);


}





function exportExcel(){


const data =
filteredAttendance.map(item=>({

Employee:
item.employeeName || item.email,

Date:
item.date,

PunchIn:
formatTime(item.PunchIn),

PunchOut:
formatTime(item.PunchOut),

Hours:
item.totalHours || 0,

Status:
item.status

}));



const worksheet =
XLSX.utils.json_to_sheet(data);



const workbook =
XLSX.utils.book_new();



XLSX.utils.book_append_sheet(

workbook,

worksheet,

"Attendance"

);



XLSX.writeFile(

workbook,

"attendance-report.xlsx"

);


}

return (

<div className="
min-h-screen
bg-white
">


<main className="
max-w-[1280px]
mx-auto
px-5
py-8
">



{/* HEADER */}

<section className="
bg-[#eaf3ff]
rounded-3xl
p-7
mb-7
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

📅 Attendance Management

</h1>


<p className="
text-[#444]
mt-2
">

Manage employee attendance records

</p>


</div>




<button

onClick={()=>
window.location.href="/admin"
}

className="
bg-[#3d6fa8]
text-white
px-5
py-3
rounded-xl
font-semibold
"

>

← Dashboard

</button>


</div>


</section>






{/* SUMMARY CARDS */}


<div className="
grid
grid-cols-1
sm:grid-cols-2
xl:grid-cols-4
gap-5
mb-7
">


<StatCard

icon="📋"

title="Total Records"

value={attendance.length}

/>



<StatCard

icon="🟢"

title="Present"

value={
attendance.filter(
x=>x.status==="Present"
).length
}

/>



<StatCard

icon="🔴"

title="Absent"

value={
attendance.filter(
x=>x.status==="Absent"
).length
}

/>



<StatCard

icon="🟡"

title="Leave"

value={
attendance.filter(
x=>x.status==="Leave"
).length
}

/>


</div>







{/* FILTER AREA */}


<div className="
bg-white
border
border-[#eaf3ff]
rounded-3xl
p-6
shadow-sm
mb-7
">


<div className="
flex
flex-col
lg:flex-row
gap-4
">


<input

placeholder="Search employee..."

value={search}

onChange={(e)=>
setSearch(e.target.value)
}

className="
flex-1
border
border-[#eaf3ff]
rounded-xl
px-4
py-3
outline-none
"

/>




<select

value={statusFilter}

onChange={(e)=>
setStatusFilter(e.target.value)
}

className="
border
border-[#eaf3ff]
rounded-xl
px-4
py-3
"

>


<option value="">
All Status
</option>


<option value="Present">
Present
</option>


<option value="Absent">
Absent
</option>


<option value="Leave">
Leave
</option>


</select>
<select

value={gpsFilter}

onChange={(e)=>
setGpsFilter(e.target.value)
}

className="
border
border-[#eaf3ff]
rounded-xl
px-4
py-3
"

>

<option value="">
All GPS Status
</option>

<option value="Inside Office">
Inside Office
</option>

<option value="Outside Office">
Outside Office
</option>

</select>

<select

value={sourceFilter}

onChange={(e)=>
setSourceFilter(e.target.value)
}

className="
border
border-[#eaf3ff]
rounded-xl
px-4
py-3
"

>

<option value="">
All Sources
</option>

<option value="Mobile">
Mobile
</option>

<option value="Web">
Web
</option>

<option value="Biometric">
Biometric
</option>

<option value="System">
System
</option>

</select>


<button

onClick={exportExcel}

className="
bg-[#3d6fa8]
text-white
px-5
py-3
rounded-xl
font-semibold
"

>

⬇ Export Excel

</button>


</div>


</div>





{/* VIEW SWITCH */}



<div className="
flex
gap-3
mb-6
">


<button

onClick={()=>setView("table")}

className={`

px-5
py-3
rounded-xl
font-semibold


${
view==="table"

?

"bg-[#3d6fa8] text-white"

:

"bg-[#eaf3ff] text-[#3d6fa8]"

}

`}

>

📋 Table View

</button>





<button

onClick={()=>setView("calendar")}

className={`

px-5
py-3
rounded-xl
font-semibold


${
view==="calendar"

?

"bg-[#3d6fa8] text-white"

:

"bg-[#eaf3ff] text-[#3d6fa8]"

}

`}

>

📅 Calendar View

</button>

<button
onClick={() => router.push("/admin/attendance-settings")}
className="bg-[#3d6fa8] text-white px-5 py-3 rounded-xl"
>
⚙ Attendance Settings
</button>




</div>

{/* TABLE VIEW */}

{
view==="table" && (

<div className="
bg-white
rounded-3xl
border
border-[#eaf3ff]
shadow-sm
p-6
">


<h2 className="
text-xl
font-bold
mb-5
text-[#111]
">

Attendance Records

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


<th className="py-4">Employee ID</th>
<th>Employee</th>


<th>
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

<th>
GPS Status
</th>

<th>
Distance
</th>

<th>
Source
</th>

<th>
Action
</th>

</tr>

</thead>





<tbody>


{
filteredAttendance.length===0

?

<tr>

<td

colSpan="7"

className="
text-center
py-10
text-[#444]
"

>

No Attendance Found

</td>

</tr>


:


filteredAttendance.map(item=>(


<tr

key={item.id}

className="
border-b
hover:bg-[#eaf3ff]
transition
"

>


<td>{item.employeeId || "-"}</td>

<td className="py-4 font-semibold">
  {item.employeeName || item.email || "Employee"}
</td>



<td>

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


<span

className={`

px-3
py-1
rounded-full
text-sm
font-semibold


${
item.status==="Present"

?

"bg-green-100 text-green-700"


:

item.status==="Absent"


?

"bg-red-100 text-red-700"


:

"bg-yellow-100 text-yellow-700"

}

`}

>


{
item.status || "Present"
}


</span>


</td>
<td>

<span
className={`
px-3
py-1
rounded-full
text-sm
font-semibold

${
item.gpsStatus==="Inside Office"

?

"bg-green-100 text-green-700"

:

"bg-red-100 text-red-700"

}

`}
>

{
item.gpsStatus || "--"
}

</span>

</td>


<td>

{
item.distanceFromOffice
?
`${Math.round(item.distanceFromOffice)} m`
:
"--"
}

</td>


<td>

<span
className="
bg-[#eaf3ff]
text-[#3d6fa8]
px-3
py-1
rounded-full
text-sm
font-semibold
"
>

{
item.attendanceSource || "System"
}

</span>

</td>







<td className="flex gap-2">

<button

onClick={()=>
setSelected(item)
}

className="
bg-[#3d6fa8]
text-white
px-4
py-2
rounded-lg
font-semibold
"

>

View

</button>


<button

onClick={()=>
deleteAttendance(item.id)
}

className="
bg-red-500
text-white
px-4
py-2
rounded-lg
font-semibold
"

>

Delete

</button>

</td>




</tr>


))


}


</tbody>


</table>


</div>


</div>

)

}
{/* CALENDAR VIEW */}

{
view==="calendar" && (

<div className="
bg-white
rounded-3xl
border
border-[#eaf3ff]
shadow-sm
p-6
">


{/* CALENDAR HEADER */}

<div className="
flex
items-center
justify-between
mb-6
">


<button

onClick={()=>changeMonth(-12)}

className="
text-[#3d6fa8]
text-xl
font-bold
"

>

&lt;&lt;

</button>



<button

onClick={()=>changeMonth(-1)}

className="
text-[#3d6fa8]
text-xl
font-bold
"

>

&lt;

</button>






<select

value={
calendarDate.getMonth()
}

onChange={(e)=>{

const d=new Date(calendarDate);

d.setMonth(
Number(e.target.value)
);

setCalendarDate(d);

}}

className="
text-xl
font-bold
text-[#111]
bg-transparent
outline-none
cursor-pointer
"

>


{
Array.from(
{length:12},
(_,i)=>(


<option

key={i}

value={i}

>

{
new Date(
2026,
i,
1
)
.toLocaleString(
"default",
{
month:"long"
}
)
}


</option>


))

}


</select>





<select

value={
calendarDate.getFullYear()
}

onChange={(e)=>{


const d=new Date(calendarDate);


d.setFullYear(
Number(e.target.value)
);


setCalendarDate(d);


}}

className="
text-xl
font-bold
text-[#111]
bg-transparent
outline-none
cursor-pointer
"

>


{
Array.from(
{
length:10
},
(_,i)=>2022+i
)
.map(year=>(


<option

key={year}

value={year}

>

{year}

</option>


))

}


</select>






<button

onClick={()=>changeMonth(1)}

className="
text-[#3d6fa8]
text-xl
font-bold
"

>

&gt;

</button>





<button

onClick={()=>changeMonth(12)}

className="
text-[#3d6fa8]
text-xl
font-bold
"

>

&gt;&gt;

</button>


</div>







{/* WEEK DAYS */}


<div className="
grid
grid-cols-7
gap-3
mb-3
text-center
font-semibold
text-[#444]
">


{
[
"Sun",
"Mon",
"Tue",
"Wed",
"Thu",
"Fri",
"Sat"
]

.map(day=>(


<div key={day}>

{day}

</div>


))

}


</div>








{/* DAYS */}



<div className="
grid
grid-cols-7
gap-3
">


{

Array.from(
{
length:firstDay()
}
)

.map((_,i)=>(


<div key={i}></div>


))


}







{

Array.from(
{
length:daysInMonth()
},

(_,i)=>i+1

)

.map(day=>{


const record=
getRecord(day);



return(


<div

key={day}

onClick={()=>setSelected(record)}

className={`

h-12
rounded-xl
flex
items-center
justify-center
font-semibold
cursor-pointer
transition



${
record?.status==="Present"

?

"bg-green-100 text-green-700"


:

record?.status==="Late"


?

"bg-yellow-100 text-yellow-700"


:

record?.status==="Absent"


?

"bg-red-100 text-red-700"


:

"bg-[#eaf3ff] text-[#3d6fa8]"

}


hover:scale-105

`}

>

{day}


</div>


)


})


}


</div>









{/* LEGEND */}


<div className="
flex
gap-5
mt-6
text-sm
">


<div>

<span className="
inline-block
w-3
h-3
rounded-full
bg-green-500
mr-2
"></span>

Present

</div>



<div>

<span className="
inline-block
w-3
h-3
rounded-full
bg-yellow-400
mr-2
"></span>

Late

</div>




<div>

<span className="
inline-block
w-3
h-3
rounded-full
bg-red-500
mr-2
"></span>

Absent

</div>


</div>





</div>


)

}

</main>
</div>
);

{
selected && (

<div className="
fixed
inset-0
bg-black/30
flex
items-center
justify-center
z-50
">


<div className="
bg-white
rounded-3xl
p-7
w-[350px]
shadow-xl
">


<div className="
flex
justify-between
items-center
mb-5
">


<h2 className="
text-xl
font-bold
text-[#111]
">

Attendance Details

</h2>


<button

onClick={()=>
setSelected(null)
}

className="
text-[#444]
text-xl
"

>

✕

</button>


</div>




<p className="mb-3">

<b>Date:</b>

{" "}

{selected.date}

</p>




<p className="mb-3">

<b>Employee:</b>

{" "}

{
selected.employeeName ||
selected.email
}

</p>




<p className="mb-3">

<b>Punch In:</b>

{" "}

{
formatTime(
selected.PunchIn
)
}

</p>




<p className="mb-3">

<b>Punch Out:</b>

{" "}

{
formatTime(
selected.PunchOut
)
}

</p>




<p className="mb-3">

<b>Total Hours:</b>

{" "}

{
selected.totalHours || 0
}

 hrs

</p>

<p className="mb-3">

<b>GPS Status:</b>

{" "}

{
selected.gpsStatus || "--"
}

</p>


<p className="mb-3">

<b>Distance:</b>

{" "}

{
selected.distanceFromOffice
?
`${Math.round(selected.distanceFromOffice)} m`
:
"--"
}

</p>


<p className="mb-3">

<b>Source:</b>

{" "}

{
selected.attendanceSource || "System"
}

</p>


<span className="
bg-[#eaf3ff]
text-[#3d6fa8]
px-4
py-2
rounded-full
font-semibold
">

{
selected.status
}


</span>


</div>


</div>

)

}

}
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
text-[#444]
mt-4
text-sm
">

{title}

</p>



<h2 className="
text-3xl
font-bold
text-[#111]
mt-2
">

{value}

</h2>



</div>

);

}




// "use client";

// import { useEffect, useState } from "react";

// import {
//   collection,
//   getDocs,
//   doc,
//   deleteDoc,
// } from "firebase/firestore";

// import { db } from "../../../lib/firebase";

// export default function AttendancePage() {
//     const [attendance, setAttendance] = useState([]);

// const [search, setSearch] = useState("");

// const [statusFilter, setStatusFilter] = useState("");

// const [loading, setLoading] = useState(true);


// useEffect(() => {

//   loadAttendance();

// }, []);

// const loadAttendance = async () => {

//   try {

//     const snapshot = await getDocs(
//       collection(db, "attendance")
//     );

//     const list = snapshot.docs.map((doc) => ({
//       id: doc.id,
//       ...doc.data(),
//     }));

//     setAttendance(list);

//   } catch (error) {

//     console.log(error);

//   } finally {

//     setLoading(false);

//   }

// };

// const deleteAttendance = async (id) => {

//   const confirmDelete = window.confirm(
//     "Delete this attendance record?"
//   );

//   if (!confirmDelete) return;

//   await deleteDoc(
//     doc(db, "attendance", id)
//   );

//   loadAttendance();

// };
// const filteredAttendance = attendance.filter((item) => {

//   const matchSearch =
//     item.employeeName
//       ?.toLowerCase()
//       .includes(search.toLowerCase());

//   const matchStatus =
//     statusFilter === "" ||
//     item.status === statusFilter;

//   return (
//     matchSearch &&
//     matchStatus
//   );

// });

// if (loading) {

//   return (

//     <div style={{ padding: 40 }}>

//       Loading Attendance...

//     </div>

//   );

// }
// return (

// <div
// style={{
// maxWidth:"1400px",
// margin:"40px auto",
// padding:"30px"
// }}
// >

// <h1
// style={{
// fontSize:"36px",
// marginBottom:"10px"
// }}
// >
// 📅 Attendance Management
// </h1>
// <button
//         onClick={() => (window.location.href = "/admin")}
//         style={{
//           background: "#2563eb",
//           color: "#fff",
//           border: "none",
//           padding: "10px 20px",
//           borderRadius: "10px",
//           cursor: "pointer",
//           fontWeight: "600",
//         }}
//       >
//         ← Dashboard
//       </button>
// <p
// style={{
// color:"#64748b",
// marginBottom:"30px"
// }}
// >
// View, search and manage employee attendance.
// </p>

// <div
// style={{
// display:"grid",
// gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",
// gap:20,
// marginBottom:30
// }}
// >

// <div style={card}>
// <h3>Total Records</h3>
// <h1>{attendance.length}</h1>
// </div>

// <div style={card}>
// <h3>Present</h3>
// <h1>
// {
// attendance.filter(
// a=>a.status==="Present"
// ).length
// }
// </h1>
// </div>

// <div style={card}>
// <h3>Absent</h3>
// <h1>
// {
// attendance.filter(
// a=>a.status==="Absent"
// ).length
// }
// </h1>
// </div>

// <div style={card}>
// <h3>Leave</h3>
// <h1>
// {
// attendance.filter(
// a=>a.status==="Leave"
// ).length
// }
// </h1>
// </div>

// </div>
// <div
// style={{
// background:"#fff",
// borderRadius:"15px",
// padding:"25px",
// boxShadow:"0 8px 20px rgba(0,0,0,.08)"
// }}
// >

// <h2
// style={{
// marginBottom:"20px"
// }}
// >
// Attendance Records
// </h2>

// <table
// style={{
// width:"100%",
// borderCollapse:"collapse"
// }}
// >

// <thead>

// <tr>

// <th style={th}>Employee</th>

// <th style={th}>Date</th>

// <th style={th}>Check In</th>

// <th style={th}>Check Out</th>

// <th style={th}>Hours</th>

// <th style={th}>Status</th>

// <th style={th}>Actions</th>

// </tr>

// </thead>

// <tbody>

// {filteredAttendance.length===0 ? (

// <tr>

// <td
// colSpan="7"
// style={{
// padding:"30px",
// textAlign:"center"
// }}
// >

// No Attendance Records

// </td>

// </tr>

// ) : (

// filteredAttendance.map((item)=>(

// <tr key={item.id}>

// <td style={td}>
// {item.employeeName}
// </td>

// <td style={td}>
// {item.date}
// </td>

// <td style={td}>
// {item.checkIn}
// </td>

// <td style={td}>
// {item.checkOut}
// </td>

// <td style={td}>
// {item.totalHours}
// </td>

// <td style={td}>

// <span
// style={{
// padding:"6px 12px",
// borderRadius:"20px",
// background:
// item.status==="Present"
// ? "#dcfce7"
// : item.status==="Absent"
// ? "#fee2e2"
// : "#fef9c3",
// color:
// item.status==="Present"
// ? "#15803d"
// : item.status==="Absent"
// ? "#dc2626"
// : "#ca8a04",
// fontWeight:"600"
// }}
// >

// {item.status}

// </span>

// </td>

// <td style={td}>

// <button
// style={redBtn}
// onClick={()=>
// deleteAttendance(item.id)
// }
// >

// Delete

// </button>

// </td>

// </tr>

// ))

// )}

// </tbody>

// </table>

// </div>
// </div>

// );
// }

// const card = {
//   background: "#fff",
//   padding: "20px",
//   borderRadius: "15px",
//   textAlign: "center",
//   boxShadow: "0 8px 20px rgba(0,0,0,.08)",
// };

// const inputStyle = {
//   padding: "12px",
//   border: "1px solid #ddd",
//   borderRadius: "8px",
//   width: "250px",
// };

// const th = {
//   background: "#f8fafc",
//   padding: "15px",
//   textAlign: "left",
//   borderBottom: "1px solid #e5e7eb",
// };

// const td = {
//   padding: "15px",
//   borderBottom: "1px solid #f1f5f9",
// };

// const redBtn = {
//   background: "#dc2626",
//   color: "#fff",
//   border: "none",
//   padding: "8px 15px",
//   borderRadius: "8px",
//   cursor: "pointer",
// };
