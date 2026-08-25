"use client";

import {useEffect,useState} from "react";

import {
doc,
getDoc,
setDoc
} from "firebase/firestore";

import {db} from "../../../lib/firebase";
import {usePermission} from "../../../lib/usePermission";

export default function AttendanceSettings(){

const {canEdit} = usePermission("attendanceSettings");
const [loading,setLoading]=useState(true);

const [saving,setSaving]=useState(false);

const [settings,setSettings]=useState({

officeLatitude:"",

officeLongitude:"",

officeRadius:100,

officeStartTime:"09:30",

officeEndTime:"18:30",

graceMinutes:15,

extraBufferMinutes:60,

minimumHours:8,

halfDayHours:4,

maximumHours:12,

gpsRequired:true,

restrictOutsideOffice:true,

allowRemotePunch:false,

autoLate:true,

autoCalculateHours:true,

allowOutsidePunchOut:true,

workingDays:[
"Monday",
"Tuesday",
"Wednesday",
"Thursday",
"Friday",
"Saturday"
],

// Optional named shifts (e.g. "Morning 10-7", "Afternoon 12-9") an
// employee can be assigned to from Admin -> Users, instead of everyone
// being held to the single officeStartTime/officeEndTime above. Any
// employee with no shift assigned keeps using the office timing above.
shifts:[]

});

const [newShiftName,setNewShiftName]=useState("");
const [newShiftStart,setNewShiftStart]=useState("10:00");
const [newShiftEnd,setNewShiftEnd]=useState("19:00");

useEffect(()=>{

loadSettings();

},[]);

async function loadSettings(){

try{

const snap=await getDoc(
doc(db,"settings","attendanceRules")
);

if(snap.exists()){

setSettings(prev=>({
...prev,
...snap.data()
}));

}

}catch(error){

console.log(error);

}

setLoading(false);

}

async function saveSettings(){

setSaving(true);

try{

await setDoc(

doc(db,"settings","attendanceRules"),

settings

);

alert("Attendance Settings Saved");

}catch(error){

console.log(error);

alert("Error Saving Settings");

}

setSaving(false);

}

function handleInput(name,value){

setSettings(prev=>({

...prev,

[name]:value

}));

}

function addShift(){

if(!newShiftName.trim()){
alert("Enter a shift name");
return;
}

const shift={
id: `${Date.now()}`,
name: newShiftName.trim(),
startTime: newShiftStart,
endTime: newShiftEnd,
};

handleInput("shifts",[...(settings.shifts||[]),shift]);

setNewShiftName("");
setNewShiftStart("10:00");
setNewShiftEnd("19:00");

}

function removeShift(id){

handleInput(
"shifts",
(settings.shifts||[]).filter(s=>s.id!==id)
);

}

function toggleDay(day){

const exists=settings.workingDays.includes(day);

if(exists){

handleInput(

"workingDays",

settings.workingDays.filter(d=>d!==day)

);

}else{

handleInput(

"workingDays",

[...settings.workingDays,day]

);

}

}

if(loading){

return(

<div className="min-h-screen flex items-center justify-center">

Loading...

</div>

);

}

return(

<div className="min-h-screen bg-white">

<main className="max-w-[1300px] mx-auto px-5 py-8">

<section className="bg-[#eaf3ff] rounded-3xl border border-[#66a8e0] p-7 mb-7">

<div className="flex justify-between items-center">

<div>

<h1 className="text-3xl font-bold text-[#111]">

Attendance Settings

</h1>

<p className="text-[#444] mt-2">

Configure attendance rules for all employees

</p>

</div>

<button

onClick={()=>window.location.href="/admin/attendance"}

className="bg-[#3d6fa8] text-white px-5 py-3 rounded-xl font-semibold"

>

← Dashboard

</button>

</div>

</section>
{/* OFFICE LOCATION */}

<div className="grid lg:grid-cols-2 gap-6 mb-7">

<div className="bg-white rounded-3xl border border-[#eaf3ff] shadow-sm p-7">

<h2 className="text-xl font-bold text-[#111] mb-6">

🏢 Office Location

</h2>

<div className="space-y-5">

<div>

<label className="block text-sm text-[#444] mb-2">
Office Latitude
</label>

<input
type="number"
step="0.000001"
value={settings.officeLatitude}
onChange={(e)=>
handleInput("officeLatitude",e.target.value)
}
className="w-full border border-[#dbeafe] rounded-xl p-3 outline-none focus:border-[#3d6fa8]"
/>

</div>

<div>

<label className="block text-sm text-[#444] mb-2">
Office Longitude
</label>

<input
type="number"
step="0.000001"
value={settings.officeLongitude}
onChange={(e)=>
handleInput("officeLongitude",e.target.value)
}
className="w-full border border-[#dbeafe] rounded-xl p-3 outline-none focus:border-[#3d6fa8]"
/>

</div>

<div>

<label className="block text-sm text-[#444] mb-2">
Office Radius (Meters)
</label>

<input
type="number"
value={settings.officeRadius}
onChange={(e)=>
handleInput("officeRadius",Number(e.target.value))
}
className="w-full border border-[#dbeafe] rounded-xl p-3 outline-none focus:border-[#3d6fa8]"
/>

</div>

</div>

</div>

{/* OFFICE TIMING */}

<div className="bg-white rounded-3xl border border-[#eaf3ff] shadow-sm p-7">

<h2 className="text-xl font-bold text-[#111] mb-6">

⏰ Office Timing

</h2>

<div className="grid grid-cols-2 gap-5">

<div>

<label className="block text-sm text-[#444] mb-2">
Office In Time
</label>

<input
type="time"
value={settings.officeStartTime}
onChange={(e)=>
handleInput("officeStartTime",e.target.value)
}
className="w-full border border-[#dbeafe] rounded-xl p-3"
/>

</div>

<div>

<label className="block text-sm text-[#444] mb-2">
Office Out Time
</label>

<input
type="time"
value={settings.officeEndTime}
onChange={(e)=>
handleInput("officeEndTime",e.target.value)
}
className="w-full border border-[#dbeafe] rounded-xl p-3"
/>

</div>

<div>

<label className="block text-sm text-[#444] mb-2">
Grace Time (Minutes)
</label>

<input
type="number"
value={settings.graceMinutes}
onChange={(e)=>
handleInput("graceMinutes",Number(e.target.value))
}
className="w-full border border-[#dbeafe] rounded-xl p-3"
/>

<p className="text-xs text-[#888] mt-1">
Punch-in allowed this many minutes after Office In Time before being marked Late.
</p>

</div>

<div>

<label className="block text-sm text-[#444] mb-2">
Extra Hours Buffer (Minutes)
</label>

<input
type="number"
value={settings.extraBufferMinutes}
onChange={(e)=>
handleInput("extraBufferMinutes",Number(e.target.value))
}
className="w-full border border-[#dbeafe] rounded-xl p-3"
/>

<p className="text-xs text-[#888] mt-1">
Punch-out allowed this many minutes after Office Out Time before Extra Hours start counting.
</p>

</div>

<div>

<label className="block text-sm text-[#444] mb-2">
Minimum Working Hours
</label>

<input
type="number"
value={settings.minimumHours}
onChange={(e)=>
handleInput("minimumHours",Number(e.target.value))
}
className="w-full border border-[#dbeafe] rounded-xl p-3"
/>

</div>

<div>

<label className="block text-sm text-[#444] mb-2">
Half Day Hours
</label>

<input
type="number"
value={settings.halfDayHours}
onChange={(e)=>
handleInput("halfDayHours",Number(e.target.value))
}
className="w-full border border-[#dbeafe] rounded-xl p-3"
/>

</div>

<div>

<label className="block text-sm text-[#444] mb-2">
Maximum Working Hours
</label>

<input
type="number"
value={settings.maximumHours}
onChange={(e)=>
handleInput("maximumHours",Number(e.target.value))
}
className="w-full border border-[#dbeafe] rounded-xl p-3"
/>

</div>

</div>

</div>

</div>

{/* SHIFTS */}

<div className="bg-white rounded-3xl border border-[#eaf3ff] shadow-sm p-7 mb-7">

<h2 className="text-xl font-bold text-[#111] mb-2">
🕐 Shifts
</h2>

<p className="text-sm text-[#666] mb-6">
Employees with different working hours than the office default above can be assigned one
of these shifts from Admin → Users. Late-marking and hours are then calculated against
their own shift instead of the office timing.
</p>

<div className="grid sm:grid-cols-[1fr_140px_140px_auto] gap-3 items-end mb-6">

<div>
<label className="block text-sm text-[#444] mb-2">Shift Name</label>
<input
type="text"
placeholder="e.g. Afternoon"
value={newShiftName}
onChange={(e)=>setNewShiftName(e.target.value)}
className="w-full border border-[#dbeafe] rounded-xl p-3"
/>
</div>

<div>
<label className="block text-sm text-[#444] mb-2">Start Time</label>
<input
type="time"
value={newShiftStart}
onChange={(e)=>setNewShiftStart(e.target.value)}
className="w-full border border-[#dbeafe] rounded-xl p-3"
/>
</div>

<div>
<label className="block text-sm text-[#444] mb-2">End Time</label>
<input
type="time"
value={newShiftEnd}
onChange={(e)=>setNewShiftEnd(e.target.value)}
className="w-full border border-[#dbeafe] rounded-xl p-3"
/>
</div>

<button
onClick={addShift}
className="bg-[#3d6fa8] hover:bg-[#325d8d] text-white px-6 py-3 rounded-xl font-semibold"
>
+ Add Shift
</button>

</div>

{(settings.shifts||[]).length===0 ? (
<p className="text-sm text-[#888]">No custom shifts yet — everyone uses the office timing above.</p>
) : (
<div className="space-y-3">
{(settings.shifts||[]).map((shift)=>(
<div
key={shift.id}
className="flex justify-between items-center bg-[#f8fafc] rounded-xl px-5 py-3"
>
<div>
<b className="text-[#111]">{shift.name}</b>
<span className="text-sm text-[#666] ml-3">{shift.startTime} – {shift.endTime}</span>
</div>
<button
onClick={()=>removeShift(shift.id)}
className="text-red-600 font-semibold text-sm"
>
Remove
</button>
</div>
))}
</div>
)}

</div>


{/* WORKING DAYS + ATTENDANCE RULES */}

<div className="grid lg:grid-cols-2 gap-6 mb-7">

{/* Working Days */}

<div className="bg-white rounded-3xl border border-[#eaf3ff] shadow-sm p-7">

<h2 className="text-xl font-bold text-[#111] mb-6">
📅 Working Days
</h2>

<div className="grid grid-cols-2 gap-4">

{[
"Monday",
"Tuesday",
"Wednesday",
"Thursday",
"Friday",
"Saturday",
"Sunday"
].map((day)=>(

<label
key={day}
className="flex items-center gap-3 cursor-pointer"
>

<input
type="checkbox"
checked={settings.workingDays.includes(day)}
onChange={()=>toggleDay(day)}
className="w-5 h-5 accent-[#3d6fa8]"
/>

<span>{day}</span>

</label>

))}

</div>

</div>

{/* Attendance Rules */}

<div className="bg-white rounded-3xl border border-[#eaf3ff] shadow-sm p-7">

<h2 className="text-xl font-bold text-[#111] mb-6">
⚙ Attendance Rules
</h2>

<div className="space-y-5">

<div className="flex justify-between items-center">

<span>GPS Verification Required</span>

<input
type="checkbox"
checked={settings.gpsRequired}
onChange={(e)=>
handleInput(
"gpsRequired",
e.target.checked
)
}
className="w-5 h-5 accent-[#3d6fa8]"
/>

</div>

<div className="flex justify-between items-center">

<span>Restrict Outside Office</span>

<input
type="checkbox"
checked={settings.restrictOutsideOffice}
onChange={(e)=>
handleInput(
"restrictOutsideOffice",
e.target.checked
)
}
className="w-5 h-5 accent-[#3d6fa8]"
/>

</div>

<div className="flex justify-between items-center">

<span>Allow Remote Punch</span>

<input
type="checkbox"
checked={settings.allowRemotePunch}
onChange={(e)=>
handleInput(
"allowRemotePunch",
e.target.checked
)
}
className="w-5 h-5 accent-[#3d6fa8]"
/>

</div>

<div className="flex justify-between items-center">

<span>Auto Mark Late</span>

<input
type="checkbox"
checked={settings.autoLate}
onChange={(e)=>
handleInput(
"autoLate",
e.target.checked
)
}
className="w-5 h-5 accent-[#3d6fa8]"
/>

</div>

<div className="flex justify-between items-center">

<span>Auto Calculate Working Hours</span>

<input
type="checkbox"
checked={settings.autoCalculateHours}
onChange={(e)=>
handleInput(
"autoCalculateHours",
e.target.checked
)
}
className="w-5 h-5 accent-[#3d6fa8]"
/>

</div>

<div className="flex justify-between items-center">

<span>Allow Outside Office Punch Out</span>

<input
type="checkbox"
checked={settings.allowOutsidePunchOut}
onChange={(e)=>
handleInput(
"allowOutsidePunchOut",
e.target.checked
)
}
className="w-5 h-5 accent-[#3d6fa8]"
/>

</div>

</div>

</div>

</div>

{/* SAVE */}

<div className="bg-white rounded-3xl border border-[#eaf3ff] shadow-sm p-7">

<div className="flex justify-end">

<button

onClick={saveSettings}

disabled={saving || !canEdit}

title={canEdit ? undefined : "View only — you don't have edit access for Attendance Settings"}

className="
bg-[#3d6fa8]
hover:bg-[#325d8d]
text-white
px-8
py-3
rounded-xl
font-semibold
disabled:opacity-50
"

>

{
saving
?
"Saving..."
:
"Save Attendance Settings"
}

</button>

</div>

</div>

</main>

</div>

);

}