"use client";

import {
useEffect,
useState
} from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const AttendanceMap = dynamic(
()=>import("../../../components/attendanceMap"),
{
 ssr:false
}
);

import {
collection,
getDocs,
doc,
getDoc,
deleteDoc,
updateDoc
} from "firebase/firestore";


import {
db
} from "../../../lib/firebase";

import { logActivity } from "../../../lib/activityLog";
import { computeDisplayStatus } from "../../../lib/attendanceRules";
import { usePermission } from "../../../lib/usePermission";



export default function AttendancePage(){

const router = useRouter();
const { canEdit } = usePermission("attendance");
const [attendance,setAttendance]=useState([]);


const [loading,setLoading]=useState(true);


const [search,setSearch]=useState("");


const [statusFilter,setStatusFilter]=useState("");

const [gpsFilter,setGpsFilter]=useState("");

const [sourceFilter,setSourceFilter]=useState("");

const [showOnlyRequests,setShowOnlyRequests]=useState(false);

const [view,setView]=useState("table");



const [calendarDate,setCalendarDate]=useState(
new Date()
);

const [selected,setSelected]=useState(null);
const [showMap,setShowMap]=useState(false);
const [mapRecord,setMapRecord]=useState(null);

// Punch In/Out correction popup — edits an existing record only,
// there is no "add new record" flow.
const [editRecord,setEditRecord]=useState(null);
const [editPunchIn,setEditPunchIn]=useState("");
const [editPunchOut,setEditPunchOut]=useState("");
const [savingEdit,setSavingEdit]=useState(false);

// Sorting
const [sortBy,setSortBy]=useState("date");
const [sortOrder,setSortOrder]=useState("desc");
const [currentPage,setCurrentPage]=useState(1);
const recordsPerPage=10;

const todayStr = new Date().toISOString().substring(0, 10);

useEffect(() => {
  loadAttendance();
}, []);

async function loadAttendance() {
  try {
    // Attendance rules (needed to compute Late status)
    const rulesSnap = await getDoc(doc(db, "settings", "attendanceRules"));
    const rules = rulesSnap.exists() ? rulesSnap.data() : null;

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

    // Merge user details into attendance + compute displayStatus
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
        displayStatus: computeDisplayStatus(attendance, rules, employee.shiftId, todayStr),
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


const record = attendance.find((item) => item.id === id);

await deleteDoc(
doc(
db,
"attendance",
id
)
);

if (record) {
  await logActivity({
    employeeName: record.employeeName,
    employeeEmail: record.email,
    uid: record.userId,
    activity: "Attendance Record Deleted",
    module: "Attendance",
    description: `${record.date || ""}`,
  });
}

loadAttendance();


}


// =======================
// PUNCH IN/OUT CORRECTION POPUP
// =======================

function toDateTimeLocalValue(value) {
  const d = value?.toDate ? value.toDate() : value ? new Date(value) : null;
  if (!d) return "";
  // datetime-local input needs "YYYY-MM-DDTHH:MM" in local time
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function openEditPopup(item) {
  setEditRecord(item);
  setEditPunchIn(toDateTimeLocalValue(item.PunchIn));

  // If the employee has already reported the time they left via the
  // "Report Missed Punch-Out" popup, pre-fill it here so Admin doesn't
  // have to ask them again — Admin still reviews and confirms by
  // hitting Save.
  const requested = item.correctionRequest?.status === "Pending"
    ? item.correctionRequest.requestedPunchOut
    : null;

  setEditPunchOut(toDateTimeLocalValue(requested || item.PunchOut));
}

function closeEditPopup() {
  setEditRecord(null);
  setEditPunchIn("");
  setEditPunchOut("");
}

async function saveEditPopup() {
  if (!editRecord) return;

  if (!editPunchIn) {
    alert("Punch In time is required.");
    return;
  }

  const start = new Date(editPunchIn);
  const end = editPunchOut ? new Date(editPunchOut) : null;

  if (end && end <= start) {
    alert("Punch Out must be after Punch In.");
    return;
  }

  try {
    setSavingEdit(true);

    const updates = {
      PunchIn: start,
      PunchOut: end,
      totalHours: end ? Number(((end - start) / (1000 * 60 * 60)).toFixed(2)) : 0,
      // A record auto-marked "Absent" (missed punch-in) stays "Absent"
      // forever otherwise — computeDisplayStatus() checks this field
      // FIRST and short-circuits before ever looking at the corrected
      // Punch In/Out time, so Present/Late never gets recalculated.
      // Setting it back to "Present" here lets that time-based
      // calculation actually run.
      status: "Present",
      correctedBy: "Admin",
      correctedAt: new Date(),
      correctionRequest: null,
    };

    await updateDoc(doc(db, "attendance", editRecord.id), updates);

    await logActivity({
      employeeName: editRecord.employeeName,
      employeeEmail: editRecord.email,
      uid: editRecord.userId,
      activity: "Attendance Corrected",
      module: "Attendance",
      description: `${editRecord.date}: Punch In/Out updated by admin`,
    });

    closeEditPopup();
    await loadAttendance();
  } catch (error) {
    console.log(error);
    alert("Could not save changes.");
  } finally {
    setSavingEdit(false);
  }
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



const filteredAttendance = attendance
.filter((item) => {

  const name =
    item.employeeName ||
    item.email ||
    "";

  const searchMatch =
    name
      .toLowerCase()
      .includes(search.toLowerCase());

  const statusMatch =
    !statusFilter ||
    item.displayStatus === statusFilter;

  const gpsMatch =
    !gpsFilter ||
    item.gpsStatus === gpsFilter;

  const sourceMatch =
    !sourceFilter ||
    item.attendanceSource === sourceFilter;

  const requestMatch =
    !showOnlyRequests ||
    item.correctionRequest?.status === "Pending";

  return (
    searchMatch &&
    statusMatch &&
    gpsMatch &&
    sourceMatch &&
    requestMatch
  );

})
.sort((a,b)=>{

  if(sortBy==="employee"){

    const x=(a.employeeName||"").toLowerCase();
    const y=(b.employeeName||"").toLowerCase();

    return sortOrder==="asc"
      ? x.localeCompare(y)
      : y.localeCompare(x);

  }

  if(sortBy==="hours"){

    return sortOrder==="asc"
      ? (a.totalHours||0)-(b.totalHours||0)
      : (b.totalHours||0)-(a.totalHours||0);

  }

  if(sortBy==="date"){

    return sortOrder==="asc"
      ? a.date.localeCompare(b.date)
      : b.date.localeCompare(a.date);

  }

  return 0;

});

const totalPages=Math.ceil(
filteredAttendance.length/recordsPerPage
);

const paginatedAttendance=
filteredAttendance.slice(

(currentPage-1)*recordsPerPage,

currentPage*recordsPerPage

);


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

let XLSX;

async function exportExcel(){

  const XLSX = await import("xlsx");

  const data = filteredAttendance.map((item) => ({
  "Employee ID": item.employeeId || "-",
  "Employee Name": item.employeeName || item.email,
  "Email": item.email || "-",

  "Date": item.date,

  "Punch In": formatTime(item.PunchIn),
  "Punch Out": formatTime(item.PunchOut),

  "Working Hours": item.totalHours || 0,

  "Extra Hours": item.extraHours || 0,

  "Status": item.displayStatus || "-",

  "GPS Status": item.gpsStatus || "-",

  "Distance From Office (m)": item.distanceFromOffice
    ? Math.round(item.distanceFromOffice)
    : "-",

  "Attendance Source": item.attendanceSource || "-",

  "Latitude": item.latitude || "-",

  "Longitude": item.longitude || "-",

  "GPS Accuracy (m)": item.accuracy
    ? Math.round(item.accuracy)
    : "-",

  "Punch Out GPS Status": item.punchOutGpsStatus || "-",

  "Punch Out Distance (m)": item.punchOutDistanceFromOffice
    ? Math.round(item.punchOutDistanceFromOffice)
    : "-",

  "Punch Out Latitude": item.punchOutLatitude || "-",

  "Punch Out Longitude": item.punchOutLongitude || "-",

  "Punch Out Accuracy (m)": item.punchOutAccuracy
    ? Math.round(item.punchOutAccuracy)
    : "-",
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
w-full
px-4
lg:px-8
py-6
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



{/* PENDING CORRECTION REQUESTS ALERT */}

{
attendance.filter(x=>x.correctionRequest?.status==="Pending").length > 0 && (

<section className="bg-orange-50 border border-orange-200 rounded-3xl p-6 mb-7 flex items-center justify-between flex-wrap gap-4">

<div className="flex items-center gap-3">

<span className="text-3xl">📩</span>

<div>

<p className="font-bold text-[#111] text-lg">

{attendance.filter(x=>x.correctionRequest?.status==="Pending").length}{" "}
punch-out request{attendance.filter(x=>x.correctionRequest?.status==="Pending").length>1?"s":""} waiting for review

</p>

<p className="text-sm text-[#666]">

Employees reported a missed punch-out time — review and confirm each one.

</p>

</div>

</div>

<button
onClick={()=>{
setShowOnlyRequests(true);
setView("table");
}}
className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-3 rounded-xl font-semibold"
>
Review Requests
</button>

</section>

)

}


{/* SUMMARY CARDS */}


<div className="
grid
grid-cols-1
sm:grid-cols-2
xl:grid-cols-5
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
x=>x.displayStatus==="Present"
).length
}

/>



<StatCard

icon="🟡"

title="Late"

value={
attendance.filter(
x=>x.displayStatus==="Late"
).length
}

/>



<StatCard

icon="⚠️"

title="Incomplete"

value={
attendance.filter(
x=>x.displayStatus==="Incomplete"
).length
}

/>



<StatCard

icon="🔴"

title="Absent"

value={
attendance.filter(
x=>x.displayStatus==="Absent"
).length
}

/>


</div>



{/* FILTER BAR */}

<div className="bg-white border border-[#eaf3ff] rounded-3xl p-6 shadow-sm mb-7">

<div className="grid lg:grid-cols-8 gap-4">

<input
placeholder="🔍 Search employee..."
value={search}
onChange={(e)=>setSearch(e.target.value)}
className="lg:col-span-2 border border-[#d7e8fb] rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#3d6fa8]"
/>

<select
value={statusFilter}
onChange={(e)=>setStatusFilter(e.target.value)}
className="border border-[#d7e8fb] rounded-xl px-4 py-3"
>
<option value="">Status</option>
<option value="Present">Present</option>
<option value="Late">Late</option>
<option value="Incomplete">Incomplete</option>
<option value="Absent">Absent</option>
</select>

<select
value={gpsFilter}
onChange={(e)=>setGpsFilter(e.target.value)}
className="border border-[#d7e8fb] rounded-xl px-4 py-3"
>
<option value="">GPS</option>
<option value="Inside Office">Inside Office</option>
<option value="Outside Office">Outside Office</option>
</select>

<select
value={sourceFilter}
onChange={(e)=>setSourceFilter(e.target.value)}
className="border border-[#d7e8fb] rounded-xl px-4 py-3"
>
<option value="">Source</option>
<option value="Laptop">Laptop</option>
<option value="Mobile">Mobile</option>
<option value="Web">Web</option>
<option value="Biometric">Biometric</option>
</select>

<select
value={sortBy}
onChange={(e)=>setSortBy(e.target.value)}
className="border border-[#d7e8fb] rounded-xl px-4 py-3"
>
<option value="date">Sort : Date</option>
<option value="employee">Sort : Employee</option>
<option value="hours">Sort : Hours</option>
</select>

<select
value={sortOrder}
onChange={(e)=>setSortOrder(e.target.value)}
className="border border-[#d7e8fb] rounded-xl px-4 py-3"
>
<option value="desc">Newest</option>
<option value="asc">Oldest</option>
</select>

<button
onClick={()=>setShowOnlyRequests(prev=>!prev)}
className={`rounded-xl px-4 py-3 font-semibold text-sm ${
showOnlyRequests
? "bg-orange-500 text-white"
: "bg-orange-50 text-orange-700 border border-orange-200"
}`}
>
📩 {showOnlyRequests ? "Showing Requests Only" : "Show Only Requests"}
</button>

<div className="flex gap-2">

<button
onClick={exportExcel}
className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold"
>
⬇ Excel
</button>



</div>

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
<div className="grid grid-cols-2 lg:grid-cols-5 gap-5 mb-6">

<div className="bg-green-50 border border-green-200 rounded-2xl p-5">

<p className="text-green-600 text-sm font-medium">
Present
</p>

<h2 className="text-3xl font-bold mt-2">

{
filteredAttendance.filter(
x=>x.displayStatus==="Present"
).length
}

</h2>

</div>

<div className="bg-red-50 border border-red-200 rounded-2xl p-5">

<p className="text-red-600 text-sm font-medium">
Absent
</p>

<h2 className="text-3xl font-bold mt-2">

{
filteredAttendance.filter(
x=>x.displayStatus==="Absent"
).length
}

</h2>

</div>

<div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5">

<p className="text-yellow-700 text-sm font-medium">
Late
</p>

<h2 className="text-3xl font-bold mt-2">

{
filteredAttendance.filter(
x=>x.displayStatus==="Late"
).length
}

</h2>

</div>

<div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">

<p className="text-blue-600 text-sm font-medium">
Inside Office
</p>

<h2 className="text-3xl font-bold mt-2">

{
filteredAttendance.filter(
x=>x.gpsStatus==="Inside Office"
).length
}

</h2>

</div>

<div className="bg-purple-50 border border-purple-200 rounded-2xl p-5">

<p className="text-purple-600 text-sm font-medium">
Remote
</p>

<h2 className="text-3xl font-bold mt-2">

{
filteredAttendance.filter(
x=>x.gpsStatus==="Outside Office"
).length
}

</h2>

</div>

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
w-full
overflow-x-auto
rounded-2xl
border
border-[#eaf3ff]
">

<table className="min-w-[1400px] w-full whitespace-nowrap">

<thead className="bg-[#f8fbff] sticky top-0 z-10">
<tr className="text-gray-700 uppercase text-xs tracking-wide">

<th className="px-4 py-4 text-left whitespace-nowrap">#</th>

<th className="px-4 py-4 text-left whitespace-nowrap">Employee</th>

<th className="px-4 py-4 text-left whitespace-nowrap">Employee ID</th>

<th className="px-4 py-4 text-left whitespace-nowrap">Date</th>

<th className="px-4 py-4 text-left whitespace-nowrap">Punch In</th>

<th className="px-4 py-4 text-left whitespace-nowrap">Punch Out</th>

<th className="px-4 py-4 text-center">Hours</th>

<th className="px-4 py-4 text-center">Extra</th>

<th className="px-4 py-4 text-left whitespace-nowrap">Status</th>

<th className="px-4 py-4 text-left whitespace-nowrap">GPS</th>

<th className="px-4 py-4 text-left whitespace-nowrap">Distance</th>

<th className="px-4 py-4 text-left whitespace-nowrap">Source</th>

<th className="px-4 py-4 text-center">Action</th>

</tr>

</thead>

<tbody>

{filteredAttendance.length===0 ? (

<tr>

<td
colSpan={13}
className="text-center py-16 text-gray-500"
>

No Attendance Records Found

</td>

</tr>

) : (

filteredAttendance.map((item,index)=>(

<tr
key={item.id}
className="border-b even:bg-[#fbfdff] hover:bg-[#eef7ff] transition-all duration-200"
>

<td className="px-4 py-4 font-semibold text-gray-500">
{index+1}
</td>

<td className="px-4 py-4">

<div className="flex items-center gap-3">

<div className="w-10 h-10 rounded-full bg-[#3d6fa8] text-white flex items-center justify-center font-bold">

{(item.employeeName||item.email||"E")
.charAt(0)
.toUpperCase()}

</div>

<div>

<p className="font-semibold text-[#111]">

{item.employeeName || "Employee"}

</p>

<p className="text-xs text-gray-500">

{item.email}

</p>

</div>

</div>

</td>

<td className="px-4 py-4">

<span className="font-medium">

{item.employeeId || "--"}

</span>

</td>

<td className="px-4 py-4">

{item.date}

</td>

<td className="px-4 py-4">

{formatTime(item.PunchIn)}

</td>

<td className="px-4 py-4">

{formatTime(item.PunchOut)}

</td>

<td className="px-4 py-4 text-center font-semibold">

{item.totalHours || 0} hrs

</td>

<td className="px-4 py-4 text-center font-semibold text-green-700">

{item.extraHours || 0} hrs

</td>

<td className="px-4 py-4">

<span
className={`px-3 py-1 rounded-full text-xs font-bold

${item.displayStatus==="Present"
?"bg-green-100 text-green-700"
:item.displayStatus==="Absent"
?"bg-red-100 text-red-700"
:item.displayStatus==="Incomplete"
?"bg-orange-100 text-orange-700"
:"bg-yellow-100 text-yellow-700"}
`}
>

{item.displayStatus}

</span>

</td>

<td className="px-4 py-4">

<span
className={`px-3 py-1 rounded-full text-xs font-bold

${item.gpsStatus==="Inside Office"
?"bg-green-100 text-green-700"
:"bg-red-100 text-red-700"}
`}
>

{item.gpsStatus || "--"}

</span>

</td>

<td className="px-4 py-4">

{item.distanceFromOffice
?`${Math.round(item.distanceFromOffice)} m`
:"--"}

</td>

<td className="px-4 py-4">

<span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold">

{item.attendanceSource || "System"}

</span>

</td>

<td className="px-4 py-4">

<div className="flex justify-center gap-2 items-center">

{item.correctionRequest?.status === "Pending" && (
  <span
    title={item.correctionRequest?.note || "Employee reported a missed punch-out time"}
    className="bg-orange-100 text-orange-700 px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap"
  >
    📩 Requested
  </span>
)}

{canEdit && (
<button
onClick={()=>openEditPopup(item)}
className="bg-[#3d6fa8] hover:bg-[#325d8d] text-white px-4 py-2 rounded-lg text-sm"
>
✏️ Update
</button>
)}

{canEdit && (
<button
onClick={()=>deleteAttendance(item.id)}
className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm"
>

🗑 Delete

</button>
)}

</div>

</td>

</tr>

))

)}

</tbody>

</table>
<div className="flex justify-between items-center mt-6">

<p className="text-gray-500">

Showing

{" "}

{Math.min(
(currentPage-1)*recordsPerPage+1,
filteredAttendance.length
)}

-

{Math.min(
currentPage*recordsPerPage,
filteredAttendance.length
)}

of

{filteredAttendance.length}

records

</p>

<div className="flex gap-2">

<button

disabled={currentPage===1}

onClick={()=>setCurrentPage(p=>p-1)}

className="px-4 py-2 rounded-lg border disabled:opacity-40"

>

Previous

</button>

<button

className="px-4 py-2 bg-[#3d6fa8] text-white rounded-lg"

>

{currentPage}

</button>

<button

disabled={currentPage===totalPages}

onClick={()=>setCurrentPage(p=>p+1)}

className="px-4 py-2 rounded-lg border disabled:opacity-40"

>

Next

</button>

</div>

</div>
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
record?.displayStatus==="Present"

?

"bg-green-100 text-green-700"


:

record?.displayStatus==="Late"


?

"bg-yellow-100 text-yellow-700"


:

record?.displayStatus==="Incomplete"

?

"bg-orange-100 text-orange-700"

:

record?.displayStatus==="Absent"


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
flex-wrap
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
bg-orange-400
mr-2
"></span>

Incomplete

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
{showMap && mapRecord && (

<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">

  <div className="bg-white rounded-3xl shadow-2xl w-[90%] max-w-5xl overflow-hidden">

    <div className="flex justify-between items-center px-6 py-5 border-b">

      <h2 className="text-2xl font-bold">
        Employee Location
      </h2>

      <button
        onClick={()=>{
          setShowMap(false);
          setMapRecord(null);
        }}
        className="text-2xl"
      >
        ✕
      </button>

    </div>

    <div className="h-[600px]">

      <AttendanceMap
        latitude={mapRecord.latitude}
        longitude={mapRecord.longitude}
      />

    </div>

  </div>

</div>

)}

{/* PUNCH IN/OUT UPDATE POPUP */}

{editRecord && (

<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">

  <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">

    <div className="flex justify-between items-center px-6 py-5 border-b">

      <div>
        <h2 className="text-xl font-bold">Update Attendance</h2>
        <p className="text-sm text-gray-500 mt-1">
          {editRecord.employeeName || editRecord.email} — {editRecord.date}
        </p>
      </div>

      <button
        onClick={closeEditPopup}
        className="text-2xl leading-none"
      >
        ✕
      </button>

    </div>

    <div className="p-6 flex flex-col gap-4">

      <div>
        <label className="text-sm font-semibold text-gray-600">
          Punch In
        </label>
        <input
          type="datetime-local"
          value={editPunchIn}
          onChange={(e)=>setEditPunchIn(e.target.value)}
          className="w-full border border-[#d7e8fb] rounded-xl px-4 py-3 mt-1"
        />
      </div>

      <div>
        <label className="text-sm font-semibold text-gray-600">
          Punch Out
        </label>
        <input
          type="datetime-local"
          value={editPunchOut}
          onChange={(e)=>setEditPunchOut(e.target.value)}
          className="w-full border border-[#d7e8fb] rounded-xl px-4 py-3 mt-1"
        />
        {editRecord.correctionRequest?.status === "Pending" && (
          <p className="text-xs text-orange-600 mt-1">
            📩 Employee reported this time
            {editRecord.correctionRequest?.note
              ? ` — "${editRecord.correctionRequest.note}"`
              : ""}
          </p>
        )}
      </div>

      <div className="flex gap-3 mt-2">

        <button
          onClick={saveEditPopup}
          disabled={savingEdit}
          className="flex-1 bg-[#3d6fa8] hover:bg-[#325d8d] text-white py-3 rounded-xl font-semibold disabled:bg-gray-300"
        >
          {savingEdit ? "Saving..." : "Save"}
        </button>

        <button
          onClick={closeEditPopup}
          className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold"
        >
          Cancel
        </button>

      </div>

    </div>

  </div>

</div>

)}
</main>
</div>
);

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

function Card({title,value}){

return(

<div className="bg-[#f8fbff] border border-[#eaf3ff] rounded-2xl p-5">

<p className="text-sm text-gray-500">

{title}

</p>

<h3 className="text-lg font-bold text-[#111] mt-2 break-all">

{value}

</h3>

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
//           background: "#3d6fa8",
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
