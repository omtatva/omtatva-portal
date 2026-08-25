"use client";

import { 
useEffect,
useState
} from "react";

import {
useParams
} from "next/navigation";


import {
doc,
getDoc,
updateDoc,
setDoc,
serverTimestamp
} from "firebase/firestore";


import {
db
} from "../../../../lib/firebase";

import { ROLES } from "../../../../lib/roles";
import { logActivity } from "../../../../lib/activityLog";


import toast from "react-hot-toast";


import LetterOfIntent from "../components/LetterOfIntent";



export default function EmployeePage(){



const {id}=useParams();



const [employee,setEmployee]=useState(null);


const [loading,setLoading]=useState(true);


const [editMode,setEditMode]=useState(false);


const [saving,setSaving]=useState(false);


const [showLOI,setShowLOI]=useState(false);


const [showPreview,setShowPreview]=useState(false);



const [joiningDate,setJoiningDate]=useState("");


const [designation,setDesignation]=useState("");


const [performance,setPerformance]=useState("");


const [shifts,setShifts]=useState([]);



const currentDate =
new Date().toLocaleDateString("en-IN");





// ================= FETCH EMPLOYEE =================



useEffect(()=>{


if(id){

loadEmployee();

}


},[id]);


useEffect(()=>{

getDoc(doc(db,"settings","attendanceRules")).then((snap)=>{
if(snap.exists()){
setShifts(snap.data().shifts||[]);
}
});

},[]);







const loadEmployee=async()=>{


try{


setLoading(true);



const userRef =
doc(
db,
"users",
id
);


const profileRef =
doc(
db,
"employeeProfiles",
id 
);



const employeeRef =
doc(
db,
"employees",
id
);




const [
userSnap,
profileSnap,
employeeSnap
]=await Promise.all([


getDoc(userRef),

getDoc(profileRef),

getDoc(employeeRef)


]);





const userData =
userSnap.exists()
?
userSnap.data()
:{};



const profileData =
profileSnap.exists()
?
profileSnap.data()
:{};



const employeeData =
employeeSnap.exists()
?
employeeSnap.data()
:{};






const finalEmployee={


...userData,

...profileData,

...employeeData


};





setEmployee(finalEmployee);



setPerformance(
finalEmployee.performance || ""
);



}
catch(error){


console.log(error);


toast.error(
"Employee load failed"
);


}
finally{


setLoading(false);


}


};









// ================= UPDATE FIELD =================



const updateField=(

field,

value

)=>{
setEmployee((prev)=>({

...prev,

[field]:value

}));

};

// ================= HR SAVE =================



const saveEmployee=async()=>{


try{


setSaving(true);


await setDoc(

doc(
db,
"employees",
id
),


{


...employee,


performance,


updatedAt:
serverTimestamp()


},


{
merge:true
}


);





await setDoc(

doc(
db,
"users",
id
),


{


firstName:
employee.firstName || "",


lastName:
employee.lastName || "",


phone:
employee.mobile || "",


department:
employee.department || "",


designation:
employee.designation || "",


officialEmail:
employee.officialEmail || "",


role:
employee.role || "employee",


shiftId:
employee.shiftId || "",


status:
employee.status || "inactive",          // ⬅ changed default

hrApprovalStatus:                          // ⬅ NEW
employee.hrApprovalStatus || "Pending",

performance: performance,
updatedAt:
serverTimestamp()


},


{
merge:true
}


);





// NOTE: "Role" here is just a title/designation shown on the employee's
// record — it intentionally does NOT grant admin dashboard access.
// Real access is granted only from Settings -> Access Management, by
// email, so setting someone's title to "Head" here can't silently make
// them an admin.

await logActivity({
  employeeName: `${employee.firstName || ""} ${employee.lastName || ""}`.trim(),
  employeeEmail: employee.email,
  uid: id,
  activity: "Employee Profile Updated",
  module: "Users",
  description: `Role: ${employee.role || "employee"}, Status: ${employee.status || "inactive"}`,
});

toast.success(
"Employee updated"
);



setEditMode(false);



loadEmployee();



}

catch(error){


console.log(error);


toast.error(
"Update failed"
);


}
finally{


setSaving(false);


}


};



if(loading){

return (

<h2
style={{
padding:"40px"
}}
>
Loading Employee...
</h2>

);

}


if(!employee){

return (

<h2
style={{
padding:"40px"
}}
>
Employee Not Found
</h2>

);

}



return (

<div>


<div
style={{
background: "linear-gradient(135deg,  #1b5291,#3d6fa8)",
borderRadius: "20px",
padding: "30px",
color: "#fff",
display: "flex",
justifyContent: "space-between",
alignItems: "center",
marginBottom: "30px",
boxShadow: "0 10px 30px rgba(37,99,235,.25)",
flexWrap: "wrap",
gap: "20px",
}}
>
{/* Left Side */}
<div
style={{
display: "flex",
alignItems: "center",
gap: "25px",
flexWrap: "wrap",
}}
>
<img
  src={
    employee.profilePhoto ||
    employee.photoURL ||
    employee.documents?.photo ||
    "/profile.png"
  }
  alt="Profile"
style={{
width: "110px",
height: "110px",
borderRadius: "50%",
objectFit: "cover",
border: "5px solid rgba(255,255,255,.9)",
background: "#fff",
}}
/>

<div>
<h1
style={{
margin: 0,
fontSize: "34px",
fontWeight: "700",
}}
>
{employee.firstName} {employee.lastName}
</h1>

<p
style={{
margin: "8px 0",
fontSize: "18px",
opacity: ".95",
}}
>
{employee.designation || "Employee"}
</p>

<div
style={{
display: "flex",
gap: "10px",
flexWrap: "wrap",
marginTop: "12px",
}}
>
<span
style={{
background: "rgba(255,255,255,.15)",
padding: "8px 14px",
borderRadius: "25px",
fontSize: "14px",
}}
>
🆔 {employee.employeeId || "-"}
</span>

<span
style={{
background: "rgba(255,255,255,.15)",
padding: "8px 14px",
borderRadius: "25px",
fontSize: "14px",
}}
>
🏢 {employee.department || "-"}
</span>

<span
  style={{
    padding: "8px 16px",
    borderRadius: "25px",
    fontSize: "14px",
    fontWeight: "600",
    background:
      (employee.hrApprovalStatus || "Pending") === "Approved"
        ? "#16a34a"
        : (employee.hrApprovalStatus || "Pending") === "Rejected"
        ? "#dc2626"
        : "#f59e0b",
    color: "#fff",
  }}
>
  {(employee.hrApprovalStatus || "Pending") === "Approved"
    ? "🟢 Approved"
    : (employee.hrApprovalStatus || "Pending") === "Rejected"
    ? "🔴 Rejected"
    : "🟡 Pending"}
</span>
</div>
</div>
</div>

{/* Right Side */}
<div
style={{
display: "flex",
flexDirection: "column",
alignItems: "flex-end",
gap: "12px",
}}
>

<div
style={{
display:"flex",
gap:"10px",
flexWrap:"wrap",
justifyContent:"flex-end"
}}
>

<button
onClick={()=>window.location.href="/admin/users"}
style={{
padding:"15px 28px",
fontSize:"15px",
borderRadius:12,
border:"none",
background:"#111827",
color:"#fff",
fontWeight:700,
cursor:"pointer"
}}
>
← Dashboard
</button>

{!editMode && (
<button
onClick={()=>setEditMode(true)}
style={{
padding:"15px 28px",
fontSize:"15px",
borderRadius:12,
border:"none",
background:"#16a34a",
color:"#fff",
fontWeight:700,
cursor:"pointer"
}}
>
✏️ Edit Employee
</button>
)}

{editMode && (
<>
<button
onClick={saveEmployee}
disabled={saving}
style={{
padding:"15px 28px",
fontSize:"15px",
borderRadius:12,
border:"none",
background: saving ? "#93c5fd" : "#16a34a",
color:"#fff",
fontWeight:700,
cursor: saving ? "default" : "pointer"
}}
>
{saving ? "Saving..." : "💾 Save Changes"}
</button>

<button
onClick={()=>{
setEditMode(false);
loadEmployee();
}}
style={{
padding:"15px 28px",
fontSize:"15px",
borderRadius:12,
border:"none",
background:"#dc2626",
color:"#fff",
fontWeight:700,
cursor:"pointer"
}}
>
Cancel
</button>
</>
)}

</div>

<div
style={{
textAlign: "right",
fontSize: "14px",
opacity: ".95",
}}
>
<div>📧 {employee.email}</div>
<div>📱 {employee.mobile || "-"}</div>
</div>
</div>
</div>


{/* PERSONAL INFORMATION */}

<div style={sectionCard}>

<h2>
👤 Personal Information
</h2>

<div style={grid}>

<Field
label="First Name"
value={employee.firstName || ""}
edit={editMode}
onChange={(v)=>
updateField(
"firstName",
v
)
}
/>

<Field
label="Last Name"
value={employee.lastName || ""}
edit={editMode}
onChange={(v)=>
updateField(
"lastName",
v
)
}
/>

<Field
label="Personal Email"
value={employee.email || ""}
edit={false}
/>

<Field
label="Phone"
value={employee.mobile || ""}
edit={editMode}
onChange={(v)=>
updateField(
"phone",
v
)
}
/>

<Field
label="Date of Birth"
type="date"
value={employee.dob || ""}
edit={editMode}
onChange={(v)=>
updateField(
"dob",
v
)
}
/>

<div>

<label>
Gender
</label>

<select

disabled={!editMode}

style={input}

value={
employee.gender || ""
}

onChange={(e)=>

updateField(
"gender",
e.target.value
)

}

>

<option value="">
Select
</option>

<option>
Male
</option>

<option>
Female
</option>

<option>
Other
</option>

</select>

</div>

<Field
label="Blood Group"
value={employee.bloodGroup || ""}
edit={editMode}
onChange={(v)=>
updateField(
"bloodGroup",
v
)
}
/>

</div>

</div>



{/* EMPLOYMENT DETAILS */}

<div style={sectionCard}>

<h2>
💼 Employment Details
</h2>



<div style={grid}>




<div>

<label>
Department
</label>


<select

disabled={!editMode}

style={input}

value={
employee.department || ""
}

onChange={(e)=>

updateField(
"department",
e.target.value
)

}

>



<option value="">
Select
</option>

<option>
Production
</option>

<option>
IT
</option>
<option>
HR
</option>

<option>
Marketing
</option>

<option>
Management
</option>

<option>
Operations
</option>

<option>
Creative
</option>


</select>

</div>






<div>

<label>
Designation
</label>


<input

disabled={!editMode}

style={input}

value={
employee.designation || ""
}

onChange={(e)=>

updateField(
"designation",
e.target.value
)

}

/>


</div>



<div>

<label>
Role
</label>


<select

disabled={!editMode}

style={input}

value={
employee.role || "employee"
}

onChange={(e)=>

updateField(
"role",
e.target.value
)

}

>


{ROLES.map((r) => (
<option key={r.value} value={r.value}>
{r.label}
</option>
))}


</select>


</div>

<div>

<label>
Shift
</label>


<select

disabled={!editMode}

style={input}

value={
employee.shiftId || ""
}

onChange={(e)=>

updateField(
"shiftId",
e.target.value
)

}

>

<option value="">Default (office timing)</option>
{shifts.map((s) => (
<option key={s.id} value={s.id}>
{s.name} ({s.startTime}–{s.endTime})
</option>
))}

</select>

</div>





<div>

<label>
Reporting Manager
</label>


<input

disabled={!editMode}

style={input}

value={
employee.reportingManager || ""
}

onChange={(e)=>

updateField(
"reportingManager",
e.target.value
)

}

/>


</div>







<div>

<label>
Employment Type
</label>


<select

disabled={!editMode}

style={input}

value={
employee.employmentType || ""
}

onChange={(e)=>

updateField(
"employmentType",
e.target.value
)

}

>


<option value="">
Select
</option>


<option>
Permanent
</option>

<option>
Contract
</option>

<option>
Intern
</option>

<option>
Freelancer
</option>


</select>


</div>






<div>

<label>
Work Mode
</label>


<select

disabled={!editMode}

style={input}

value={
employee.workMode || ""
}

onChange={(e)=>

updateField(
"workMode",
e.target.value
)

}

>


<option>
Office
</option>

<option>
Hybrid
</option>

<option>
Remote
</option>


</select>


</div>








<div>

<label>
Office Location
</label>


<input

disabled={!editMode}

style={input}

value={
employee.officeLocation || ""
}

onChange={(e)=>

updateField(
"officeLocation",
e.target.value
)

}

/>


</div>






<div>

<label>
Joining Date
</label>


<input

type="date"

disabled={!editMode}

style={input}

value={
employee.joiningDate || ""
}

onChange={(e)=>

updateField(
"joiningDate",
e.target.value
)

}

/>


</div>







<div>

<label>
Notice Period
</label>


<select

disabled={!editMode}

style={input}

value={
employee.noticePeriod || ""
}

onChange={(e)=>

updateField(
"noticePeriod",
e.target.value
)

}

>
<option>
NA
</option>

<option>
15 Days
</option>

<option>
30 Days
</option>

<option>
60 Days
</option>

<option>
90 Days
</option>


</select>


</div>








<div>

<label>
Official Email
</label>


<input

type="email"

disabled={!editMode}

style={input}

value={
employee.officialEmail || ""
}

onChange={(e)=>

updateField(
"officialEmail",
e.target.value
)

}

placeholder="name@omtatvadigitals.com"

/>


</div>
</div>
</div>


{/* ADDRESS INFORMATION */}

<div style={sectionCard}>


<h2>
🏠 Address Information
</h2>



<div style={grid}>


<Field
label="Current Address Line 1"
value={employee.currentAddressLine1 || ""}
edit={editMode}
onChange={(v)=>
updateField(
"currentAddressLine1",
)
}
/>



<Field
label="Current Address Line 2"
value={employee.currentAddressLine2 || ""}
edit={editMode}
onChange={(v)=>
updateField(
"currentAddressLine2",
v
)
}
/>



<Field
label="Current City"
value={employee.currentCity || ""}
edit={editMode}
onChange={(v)=>
updateField(
"currentCity",
v
)
}
/>



<Field
label="Current State"
value={employee.currentState || ""}
edit={editMode}
onChange={(v)=>
updateField(
"currentState",
v
)
}
/>



<Field
label="Current Country"
value={employee.currentCountry || ""}
edit={editMode}
onChange={(v)=>
updateField(
"currentCountry",
v
)
}
/>



<Field
label="Current PIN Code"
value={employee.currentPincode || ""}
edit={editMode}
onChange={(v)=>
updateField(
"currentPincode",
v
)
}
/>



<Field
label="Permanent Address Line 1"
value={employee.permanentAddressLine1 || ""}
edit={editMode}
onChange={(v)=>
updateField(
"permanentAddressLine1",
v
)
}
/>



<Field
label="Permanent Address Line 2"
value={employee.permanentAddressLine2 || ""}
edit={editMode}
onChange={(v)=>
updateField(
"permanentAddressLine2",
v
)
}
/>



<Field
label="Permanent City"
value={employee.permanentCity || ""}
edit={editMode}
onChange={(v)=>
updateField(
"permanentCity",
v
)
}
/>



<Field
label="Permanent State"
value={employee.permanentState || ""}
edit={editMode}
onChange={(v)=>
updateField(
"permanentState",
v
)
}
/>



<Field
label="Permanent Country"
value={employee.permanentCountry || ""}
edit={editMode}
onChange={(v)=>
updateField(
"permanentCountry",
v
)
}
/>



<Field
label="Permanent PIN Code"
value={employee.permanentPincode || ""}
edit={editMode}
onChange={(v)=>
updateField(
"permanentPincode",
v
)
}
/>



</div>


</div>

{/* EMERGENCY CONTACT */}


<div style={sectionCard}>


<h2>
🚨 Emergency Contact
</h2>



<div style={grid}>


<Field

label="Emergency Name"

value={employee.emergencyName}

edit={editMode}

onChange={(v)=>
updateField(
"emergencyName",
v
)
}

/>



<Field

label="Relationship"

value={employee.emergencyRelation}

edit={editMode}

onChange={(v)=>
updateField(
"emergencyRelation",
v
)
}

/>



<Field

label="Country Code"

value={employee.emergencyCountryCode}

edit={editMode}

onChange={(v)=>
updateField(
"emergencyCountryCode",
v
)
}

/>



<Field

label="Emergency Phone"

value={employee.emergencyPhone}

edit={editMode}

onChange={(v)=>
updateField(
"emergencyPhone",
v
)
}

/>



<Field

label="Alternate Phone"

value={employee.emergencyAlternatePhone}

edit={editMode}

onChange={(v)=>
updateField(
"emergencyAlternatePhone",
v
)
}

/>



<Field

label="Emergency Email"

value={employee.emergencyEmail}

edit={editMode}

onChange={(v)=>
updateField(
"emergencyEmail",
v
)
}

/>



<Field

label="Occupation"

value={employee.emergencyOccupation}

edit={editMode}

onChange={(v)=>
updateField(
"emergencyOccupation",
v
)
}

/>



</div>


</div>



{/* BANK DETAILS */}



<div style={sectionCard}>


<h2>
🏦 Bank Details
</h2>



<div style={grid}>


<Field

label="Account Holder"

value={employee.accountHolder}

edit={editMode}

onChange={(v)=>
updateField(
"accountHolder",
v
)
}

/>



<Field

label="Bank Name"

value={employee.bankName}

edit={editMode}

onChange={(v)=>
updateField(
"bankName",
v
)
}

/>



<Field

label="Account Number"

value={employee.accountNumber}

edit={editMode}

onChange={(v)=>
updateField(
"accountNumber",
v
)
}

/>



<Field

label="IFSC Code"

value={employee.ifsc}

edit={editMode}

onChange={(v)=>
updateField(
"ifsc",
v
)
}

/>



<Field

label="Branch"

value={employee.branch}

edit={editMode}

onChange={(v)=>
updateField(
"branch",
v
)
}

/>



<Field

label="UPI ID"

value={employee.upi}

edit={editMode}

onChange={(v)=>
updateField(
"upi",
v
)
}

/>



<Field

label="PF Number"

value={employee.pf}

edit={editMode}

onChange={(v)=>
updateField(
"pf",
v
)
}

/>



<Field

label="ESIC Number"

value={employee.esic}

edit={editMode}

onChange={(v)=>
updateField(
"esic",
v
)
}

/>



<Field

label="UAN Number"

value={employee.uan}

edit={editMode}

onChange={(v)=>
updateField(
"uan",
v
)
}

/>



</div>


</div>
{/* DOCUMENTS */}
{/* This card used to check top-level fields like employee.resume /
    employee.aadhaar, which don't exist — real uploads live nested at
    employee.documents.resume / employee.documents.aadhaar (aadhaar,
    pan, education and experience are arrays of files, not a single
    URL), so every row always showed "Not Uploaded" regardless of
    what was actually uploaded. Fixed to read the real shape below,
    and the full multi-file view/download/upload UI (which this card
    doesn't attempt to duplicate) lives at /admin/documents/[id]. */}

<div style={sectionCard}>


<h2>
📁 Documents & Verification
</h2>



<div style={grid}>


<Field

label="Resume"

value={employee.documents?.resume ? "Uploaded" : "Not Uploaded"}

edit={false}

/>



<Field

label="Aadhaar Card"

value={
(employee.documents?.aadhaar?.length || 0) > 0
?
`Uploaded (${employee.documents.aadhaar.length})`
:
"Not Uploaded"
}

edit={false}

/>



<Field

label="PAN Card"

value={
(employee.documents?.pan?.length || 0) > 0
?
`Uploaded (${employee.documents.pan.length})`
:
"Not Uploaded"
}

edit={false}

/>



<Field

label="Education Certificate"

value={
(employee.documents?.education?.length || 0) > 0
?
`Uploaded (${employee.documents.education.length})`
:
"Not Uploaded"
}

edit={false}

/>



<Field

label="Experience Letter"

value={
(employee.documents?.experienceLetter?.length || 0) > 0
?
`Uploaded (${employee.documents.experienceLetter.length})`
:
"Not Uploaded"
}

edit={false}

/>



</div>





<div
style={{
display:"flex",
gap:"15px",
flexWrap:"wrap",
marginTop:"25px"
}}
>


{
employee.documents?.resume &&

<a

href={employee.documents.resume}

target="_blank"

style={documentBtn}

>

📄 View Resume

</a>

}


<a

href={`/admin/documents/${id}`}

style={documentBtn}

>

📁 View / Upload All Documents →

</a>


</div>


</div>








{/* HR MANAGEMENT */}

<div style={sectionCard}>

<h2>
🧑‍💼 HR Management
</h2>

<div style={grid}>

<div>

<label>
HR Approval Status
</label>

<select
disabled={!editMode}
style={input}
value={employee.hrApprovalStatus || "Pending"}
onChange={(e)=>{

const newStatus = e.target.value;

updateField("hrApprovalStatus", newStatus);

if(newStatus === "Approved"){

updateField("verificationStatus","Verified");
updateField("status","active");

}

else if(newStatus === "Rejected"){

updateField("verificationStatus","Rejected");
updateField("status","inactive");

}

else{

updateField("verificationStatus","Pending");
updateField("status","inactive");

}

}}
>

<option value="Pending">
🟡 Pending
</option>

<option value="Approved">
🟢 Approved
</option>

<option value="Rejected">
🔴 Rejected
</option>

</select>

</div>

<div>

<label>
Verification Status
</label>

<input
style={{
...input,
background:"#f3f4f6"
}}
value={employee.verificationStatus || "Pending"}
disabled
/>

</div>

<div>

<label>
Employee Status
</label>

<input
style={{
...input,
background:"#f3f4f6",
color:
employee.status === "active"
? "#16a34a"
: "#dc2626",
fontWeight:"700"
}}
value={employee.status || "inactive"}
disabled
/>

</div>

</div>

<div
style={{
marginTop:"25px"
}}
>

<label>
HR Notes
</label>

<textarea
disabled={!editMode}
value={employee.hrNotes || ""}
onChange={(e)=>
updateField(
"hrNotes",
e.target.value
)
}
style={textareaStyle}
/>

</div>

</div>


{/* COMPANY ASSETS */}



<div style={sectionCard}>


<h2>
💻 Company Assets
</h2>




<div style={grid}>


<Field

label="Laptop Assigned"

value={
employee.laptop
}

edit={editMode}

onChange={(v)=>

updateField(
"laptop",
v
)

}

/>



<Field

label="Laptop Serial Number"

value={
employee.laptopSerial
}

edit={editMode}

onChange={(v)=>

updateField(
"laptopSerial",
v
)

}

/>



<Field

label="SIM Assigned"

value={
employee.sim
}

edit={editMode}

onChange={(v)=>

updateField(
"sim",
v
)

}

/>



<Field

label="Other Assets"

value={
employee.assets
}

edit={editMode}

onChange={(v)=>

updateField(
"assets",
v
)

}

/>


</div>


</div>


{/* TIMELINE */}



<div style={sectionCard}>


<h2>
📅 Employee Timeline
</h2>



<p>

✅ Profile Created :

{" "}

{
employee.createdAt?.toDate
?
employee.createdAt.toDate()
.toLocaleDateString()
:
"-"
}

</p>



<p>

✅ Profile Completed :

{" "}

{
employee.profileCompleted
?
"Yes"
:
"No"
}

</p>


<p>

✅ HR Verification :

{" "}

{
employee.verificationStatus || "-"
}

</p>




<p>

🔄 Last Updated :

{" "}

{
employee.updatedAt?.toDate
?
employee.updatedAt
.toDate()
.toLocaleDateString()
:
"-"
}

</p>


</div>

<div
  style={{
    background:"#fff",
    borderRadius:"18px",
    padding:"25px",
    marginBottom:"30px",
    boxShadow:"0 6px 18px rgba(0,0,0,.08)"
  }}
>

<h2 style={{marginBottom:"20px"}}>
⭐ Employee Performance
</h2>

<div
style={{
display:"flex",
justifyContent:"space-between",
alignItems:"center",
flexWrap:"wrap",
gap:"20px"
}}
>

<div>

<h1
style={{
margin:0,
fontSize:"34px",
color:
performance==="Excellent"
?"#16a34a"
:performance==="Very Good"
?"#15803d"
:performance==="Good"
?"#2563eb"
:performance==="Average"
?"#d97706"
:"#dc2626"
}}
>
{performance || "Not Rated"}
</h1>

<p style={{color:"#6b7280"}}>
Current Employee Performance
</p>

</div>

<div>

<select
disabled={!editMode}
style={{
padding:"12px 20px",
borderRadius:"10px",
fontSize:"16px",
border:"1px solid #ddd",
minWidth:"220px"
}}
value={performance}
onChange={(e)=>setPerformance(e.target.value)}
>

<option value="">Select Rating</option>
<option value="Excellent">🌟 Excellent</option>
<option value="Very Good">✅ Very Good</option>
<option value="Good">👍 Good</option>
<option value="Average">⚠️ Average</option>
<option value="Needs Improvement">
❌ Needs Improvement
</option>

</select>

</div>

</div>

</div>


{/* HR QUICK ACTIONS */}


<div style={sectionCard}>

<h2>
⚡ HR Quick Actions
</h2>


<div
style={{
display:"flex",
gap:"15px",
flexWrap:"wrap"
}}
>


<button

style={buttonGreen}

onClick={()=>{

setDesignation(
employee.designation || ""
);

setJoiningDate(
employee.joiningDate || ""
);

setShowLOI(true);

}}

>

📄 Generate LOI

</button>



<button

style={buttonBlue}

onClick={()=>
window.location.href=
`/admin/payroll?employee=${id}`
}

>

💰 Payroll

</button>



<button

style={buttonBlue}

onClick={()=>
window.location.href=
`/admin/attendance?employee=${id}`
}

>

📅 Attendance

</button>



<button

style={buttonBlue}

onClick={()=>
window.location.href=
`/admin/timesheets?employee=${id}`
}

>

⏱ Timesheet

</button>


</div>


</div>


{/* LOI MODAL */}



{
showLOI &&


<div

style={modalOverlay}

>


<div
style={modalBox}
>


<h2>

Generate Letter Of Intent

</h2>



<label>
Employee Name
</label>


<input

value={
`${employee.firstName || ""}
${employee.lastName || ""}`
}

disabled

style={inputStyle}

/>



<label>
Designation
</label>


<input

value={designation}

onChange={(e)=>
setDesignation(
e.target.value
)
}

style={inputStyle}

/>



<label>
Joining Date
</label>


<input

type="date"

value={joiningDate}

onChange={(e)=>
setJoiningDate(
e.target.value
)
}

style={inputStyle}

/>



<div
style={{
display:"flex",
gap:"15px",
marginTop:"20px"
}}
>


<button

style={buttonGreen}

onClick={()=>{

setShowLOI(false);

setShowPreview(true);

}}

>

Generate

</button>



<button

style={buttonRed}

onClick={()=>setShowLOI(false)}

>

Cancel

</button>



</div>


</div>

</div>

}



{/* LOI PREVIEW */}


{
showPreview && (
<div
style={modalOverlay}
>


<div
style={{
background:"#fff",
width:"900px",
maxWidth:"95vw",
padding:"30px",
borderRadius:"15px"
}}
>


<div id="loi-document">


<LetterOfIntent

employeeName={

`${employee.firstName}
${employee.lastName}`

}

designation={designation}

joiningDate={joiningDate}

currentDate={currentDate}

/>


</div>



<button

style={buttonGreen}

onClick={async()=>{

const html2pdf =
(await import("html2pdf.js"))
.default;


const element =
document.getElementById(
"loi-document"
);


html2pdf()

.set({

filename:
`LOI_${employee.firstName}.pdf`,

html2canvas:{
scale:2
},

jsPDF:{
format:"a4"
}

})

.from(element)

.save();


}}

>

📄 Download PDF

</button>



<button

style={buttonRed}

onClick={()=>setShowPreview(false)}

>

Close

</button>


</div>

</div>

)
}

</div>

);

} // EmployeePage close

function Field({

label,

value,

edit,

onChange,

type

}){

return (

<div>

<label>
{label}
</label>


<input

type={type || "text"}

disabled={!edit}

value={value || ""}

onChange={(e)=>

onChange &&
onChange(
e.target.value
)

}

style={inputStyle}

/>


</div>

);

}

const grid={

display:"grid",

gridTemplateColumns:
"repeat(2,minmax(0,1fr))",

gap:"25px"

};



const sectionCard={

background:"#fff",

padding:"30px",

borderRadius:"16px",

marginBottom:"30px",

border:
"1px solid #e5e7eb",

boxShadow:
"0 4px 15px rgba(0,0,0,.05)"

};



const inputStyle={

width:"100%",

padding:"12px",

marginTop:"8px",

border:
"1px solid #d1d5db",

borderRadius:"10px",

fontSize:"16px",

boxSizing:"border-box"

};


const input = inputStyle;



const textareaStyle={

width:"100%",

height:"150px",

padding:"15px",

border:
"1px solid #d1d5db",

borderRadius:"10px",

fontSize:"16px",

boxSizing:"border-box"

};



const buttonBlue={

background:"#3d6fa8",

color:"#fff",

border:"none",

padding:"12px 25px",

borderRadius:"10px",

cursor:"pointer",

fontWeight:700

};



const buttonGreen={

background:"#16a34a",

color:"#fff",

border:"none",

padding:"12px 25px",

borderRadius:"10px",

cursor:"pointer",

fontWeight:700

};



const buttonRed={

background:"#dc2626",

color:"#fff",

border:"none",

padding:"12px 25px",

borderRadius:"10px",

cursor:"pointer",

fontWeight:700

};



const documentBtn={

background:"#3d6fa8",

color:"#fff",

padding:"10px 20px",

borderRadius:"8px",

textDecoration:"none"

};



const modalOverlay={

position:"fixed",

inset:0,

background:"rgba(0,0,0,.6)",

display:"flex",

justifyContent:"center",

alignItems:"center",

zIndex:9999,

padding:"20px",

boxSizing:"border-box"

};



const modalBox={

background:"#fff",

padding:"30px",

borderRadius:"15px",

width:"450px",

maxWidth:"95vw"

};