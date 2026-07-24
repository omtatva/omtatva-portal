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


import toast from "react-hot-toast";


import LetterOfIntent from "../components/LetterOfIntent";



export default function EmployeePage(){



const {id}=useParams();



const [employee,setEmployee]=useState(null);


const [loading,setLoading]=useState(true);


const [editMode,setEditMode]=useState(false);


const [showLOI,setShowLOI]=useState(false);


const [showPreview,setShowPreview]=useState(false);



const [joiningDate,setJoiningDate]=useState("");


const [designation,setDesignation]=useState("");


const [performance,setPerformance]=useState("");



const currentDate =
new Date().toLocaleDateString("en-IN");






// ================= FETCH EMPLOYEE =================



useEffect(()=>{


if(id){

loadEmployee();

}


},[id]);







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


department:
employee.department || "",


designation:
employee.designation || "",


role:
employee.role || "employee",


status:
employee.status || "active",


updatedAt:
serverTimestamp()


},


{
merge:true
}


);





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
    }}
  >
    <img
      src={employee.profilePhoto || "/profile.png"}
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
            background:
              employee.status === "active"
                ? "#16a34a"
                : "#dc2626",
            padding: "8px 16px",
            borderRadius: "25px",
            fontSize: "14px",
            fontWeight: "600",
          }}
        >
          {employee.status === "active"
            ? "🟢 Active"
            : "🔴 Inactive"}
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

    <div
      style={{
        textAlign: "right",
        fontSize: "14px",
        opacity: ".95",
      }}
    >
      <div>📧 {employee.email}</div>
      <div>📱 {employee.phone || "-"}</div>
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
v
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


<div style={sectionCard}>


<h2>
📁 Documents & Verification
</h2>



<div style={grid}>


<Field

label="Resume"

value={employee.resume ? "Uploaded" : "Not Uploaded"}

edit={false}

/>



<Field

label="Aadhaar Card"

value={
employee.aadhaar
?
"Uploaded"
:
"Not Uploaded"
}

edit={false}

/>



<Field

label="PAN Card"

value={
employee.pan
?
"Uploaded"
:
"Not Uploaded"
}

edit={false}

/>



<Field

label="Education Certificate"

value={
employee.education
?
"Uploaded"
:
"Not Uploaded"
}

edit={false}

/>



<Field

label="Experience Letter"

value={
employee.experience
?
"Uploaded"
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
employee.resume &&

<a

href={employee.resume}

target="_blank"

style={documentBtn}

>

📄 View Resume

</a>

}



{
employee.aadhaar &&

<a

href={employee.aadhaar}

target="_blank"

style={documentBtn}

>

🪪 View Aadhaar

</a>

}



{
employee.pan &&

<a

href={employee.pan}

target="_blank"

style={documentBtn}

>

💳 View PAN

</a>

}


</div>


</div>









{/* HR MANAGEMENT */}



<div style={sectionCard}>


<h2>
🧑‍💼 HR Management
</h2>



<div style={grid}>


<Field

label="Performance Rating"

value={performance}

edit={editMode}

onChange={(v)=>

setPerformance(v)

}

/>



<Field

label="Verification Status"

value={
employee.verificationStatus
}

edit={editMode}

onChange={(v)=>

updateField(
"verificationStatus",
v
)

}

/>



<Field

label="Employee Status"

value={
employee.status
}

edit={editMode}

onChange={(v)=>

updateField(
"status",
v
)

}

/>



<Field

label="HR Approved"

value={
employee.hrApproved
?
"Yes"
:
"No"
}

edit={editMode}

onChange={(v)=>

updateField(
"hrApproved",
v==="Yes"
)

}

/>


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

value={
employee.hrNotes || ""
}

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

onChange

}){

return (

<div>

<label>
{label}
</label>


<input

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

fontSize:"16px"

};



const textareaStyle={

width:"100%",

height:"150px",

padding:"15px",

border:
"1px solid #d1d5db",

borderRadius:"10px",

fontSize:"16px"

};



const buttonBlue={

background:"#2563eb",

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

background:"#2563eb",

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

zIndex:9999

};



const modalBox={

background:"#fff",

padding:"30px",

borderRadius:"15px",

width:"450px"

};



// "use client";
// import LetterOfIntent from "../components/LetterOfIntent";

// import { useEffect, useState } from "react";
// import { useParams } from "next/navigation";
// import {
//   doc,
//   getDoc,
//   updateDoc,
// } from "firebase/firestore";
// import { db } from "../../../../lib/firebase";

// export default function EmployeePage() {

// const { id } = useParams();

// const [user,setUser] = useState(null);
// const [editMode, setEditMode] = useState(false);
// const [showLOI, setShowLOI] = useState(false);
// const [showPreview, setShowPreview] = useState(false);
// const [joiningDate, setJoiningDate] = useState("");
// const [designation, setDesignation] = useState("");
// const [performanceBand, setPerformanceBand] = useState("");
// const currentDate = new Date().toLocaleDateString("en-IN");
// useEffect(() => {
// loadUser();
// }, []);

// const loadUser = async () => {
//   try {
//     const userSnap = await getDoc(doc(db, "users", id));
//     const profileSnap = await getDoc(doc(db, "employeeProfiles", id));

//     if (userSnap.exists()) {
//       const userData = userSnap.data();

//       const profileData = profileSnap.exists()
//         ? profileSnap.data()
//         : {};
//        console.log("USER DATA", userData);
//   console.log("PROFILE DATA", profileData);
//       setUser({
//         ...userData,
//         ...profileData,
//       });
      
//       setPerformanceBand(userData.performance || " ");
//     }

//   } catch (error) {
//     console.error("Error loading user:", error);
//   }
// };

// const saveUser = async () => {

//   await updateDoc(doc(db, "users", id), user);

//   alert("Employee Updated Successfully");

//   setEditMode(false);

// };
// const handleResumeUpload = async (e) => {
//   const file = e.target.files[0];
//   if (!file) return;

//   const { getStorage, ref, uploadBytes, getDownloadURL } =
//     await import("firebase/storage");

//   const storage = getStorage();

//   const storageRef = ref(
//     storage,
//     `resumes/${id}/${file.name}`
//   );
  
// console.log("URL ID:", id);
// console.log("User UID:", user.uid);
//   await uploadBytes(storageRef, file);

//   const url = await getDownloadURL(storageRef);

//   await updateDoc(doc(db, "users", id), {
//     resume: url,
//   });

//   setUser({
//     ...user,
//     resume: url,
//   });

//   alert("Resume Updated");
// };

// const updatePerformance = async () => {
//   try {
//     await updateDoc(doc(db, "users", id), {
//       performance: performanceBand,
//       performanceUpdatedAt: new Date(),
//     });

//     await loadUser();

//     alert("Performance Updated Successfully");
//   } catch (err) {
//     console.log(err);
//     alert("Failed");
//   }
// };

// if(!user){

// return <h2 style={{padding:40}}>Loading...</h2>

// }
// const generatePDF = async () => {
//   const html2pdf = (await import("html2pdf.js")).default;

//   const element = document.getElementById("loi-document");

//   html2pdf()
//     .set({
//       margin: 0.5,
//       filename: `LOI_${user.firstName}_${user.lastName}.pdf`,
//       image: {
//         type: "jpeg",
//         quality: 1,
//       },
//       html2canvas: {
//         scale: 2,
//       },
//       jsPDF: {
//         unit: "in",
//         format: "a4",
//         orientation: "portrait",
//       },
//     })
//     .from(element)
//     .save();
// };
// const generateProfilePDF = async () => {

// const html2pdf =
// (await import("html2pdf.js")).default;


// const element =
// document.getElementById(
// "employee-profile"
// );


// html2pdf()
// .set({

// margin:0.5,

// filename:
// `${user.firstName}_${user.lastName}_Profile.pdf`,

// html2canvas:{
// scale:2
// },

// jsPDF:{
// unit:"in",
// format:"a4",
// orientation:"portrait"
// }

// })
// .from(element)
// .save();

// };


// return (

// <div
// id="employee-profile"
// style={{
// width:"90%",
// maxWidth:"1200px",
// margin:"30px auto",
// padding:"35px",
// background:"#ffffff",
// borderRadius:"18px",
// fontSize:"16px",
// boxSizing:"border-box",
// boxShadow:"0 5px 25px rgba(0,0,0,.08)"
// }}
// >

//   <div
// style={{
// display:"flex",
// gap:15
// }}
// >

// <button
// onClick={()=>window.location.href="/admin/users"}
// style={{
// padding:"15px 28px",
// fontSize:"15px",
// borderRadius:12,
// border:"none",
// background:"#111827",
// color:"#fff",
// fontWeight:700,
// cursor:"pointer"
// }}
// >
// ← Dashboard
// </button>

// </div>

// <div
//   style={{
//     display: "flex",
//     gap: "25px",
//     alignItems: "center",
//     marginBottom: "30px",
//   }}
// >
//   <img 
//  src={`${user.profilePhoto}?v=${Date.now()}` || "/profile.png"}
//  alt="Profile"
//  style={{
//    width:140,
//    height:140,
//    borderRadius:"50%",
//    objectFit:"cover",
//    border:"5px solid #2563eb"
//  }}
// />

//   <div style={{ flex: 1 }}>
//     <h1 style={{ marginBottom: 5 }}>
//       {user.firstName} {user.lastName}
//     </h1>

//     <h3
//       style={{
//         marginTop: 0,
//         color: "#64748b",
//       }}
//     >
//       {user.designation || "Employee"}
//     </h3>

//     <p>
//       <b>Department:</b> {user.department || "-"}
//     </p>

//     <p>
//       <b>Employee ID:</b> {user.employeeId || "-"}
//     </p>

//     <p>
//   <b>Email:</b> {user.email || "-"}
// </p>

//     <span
//       style={{
//         display: "inline-block",
//         marginTop: 10,
//         padding: "8px 18px",
//         borderRadius: 20,
//         background:
//           user.status === "active"
//             ? "#dcfce7"
//             : "#fee2e2",
//         color:
//           user.status === "active"
//             ? "#15803d"
//             : "#dc2626",
//         fontWeight: 700,
//       }}
//     >
//       {user.status || "Active"}
//     </span>
//   </div>
// </div>

// <div
//   style={{
//     marginTop: 20,
//     marginBottom: 30,
//     display: "flex",
//     gap: 15,
//   }}
// >
//   <button
//     onClick={() => setEditMode(!editMode)}
//     style={{
//       padding: "10px 20px",
//       background: "#2563eb",
//       color: "#fff",
//       border: "none",
//       borderRadius: 8,
//       cursor: "pointer",
//     }}
//   >
//     {editMode ? "Cancel" : "Edit Employee"}
//   </button>

//   {editMode && (
//     <button
//       onClick={saveUser}
//       style={{
//         padding: "10px 20px",
//         background: "#16a34a",
//         color: "#fff",
//         border: "none",
//         borderRadius: 8,
//         cursor: "pointer",
//       }}
//     >
//       Save Changes
//     </button>
//   )}
// </div>


// <div
//   style={{
//     display: "grid",
//     gridTemplateColumns:
// "repeat(auto-fit,minmax(280px,1fr))",
//     gap: "20px",
//     marginBottom: "40px",
//   }}
// >

// <div style={cardStyle}>
// <h3>Attendance</h3>
// <h1>{user.attendanceCount || 0}</h1>
// <p>This Month</p>
// </div>

// <div style={cardStyle}>
// <h3>Timesheets</h3>
// <h1>{user.timesheetCount || 0}</h1>
// <p>Submitted</p>
// </div>

// <div style={cardStyle}>
// <h3>Total Hours</h3>
// <h1>{user.totalHours || 0}</h1>
// <p>Working Hours</p>
// </div>

// <div style={cardStyle}>

//   <h3>⭐ Performance</h3>

//   <select
//     value={performanceBand}
//     onChange={(e) => setPerformanceBand(e.target.value)}
//     style={{
//       width: "100%",
//       padding: "12px",
//       marginTop: "15px",
//       borderRadius: "10px",
//       fontSize: "18px",
//       border: "1px solid #d1d5db",
//     }}
//   >

//     <option value="Outstanding">Outstanding</option>
// <option value="Excellent">Excellent</option>
// <option value="Very Good">Very Good</option>
// <option value="Good">Good</option>
// <option value="Average">Average</option>
// <option value="Needs Improvement">Needs Improvement</option>

//   </select>

//   <button
//     onClick={updatePerformance}
//     style={{
//       marginTop: "20px",
//       width: "100%",
//       padding: "12px",
//       background: "#3d6fa8",
//       color: "#fff",
//       border: "none",
//       borderRadius: "10px",
//       cursor: "pointer",
//       fontWeight: "700",
//       fontSize: "16px",
//     }}
//   >
//     Update Rating
//   </button>

// </div>

// </div>
// <h2 style={{ marginBottom: "20px" }}>
// ⚡ HR Quick Actions
// </h2>

// <div
// style={{
// display:"flex",
// gap:"15px",
// flexWrap:"wrap",
// marginBottom:"40px",

// }}
// >

// <button
// style={blueBtn}
// onClick={() =>
// window.location.href = `/admin/attendance?employee=${id}`
// }
// >
// Attendance
// </button>

// <button
// style={greenBtn}
// onClick={() =>
// window.location.href = `/admin/leave?employee=${id}`
// }
// >
// Leave History
// </button>

// <button
// style={orangeBtn}
// onClick={() =>
// window.location.href = `/admin/payroll?employee=${id}`
// }
// >
// Payroll
// </button>

// <button
// style={purpleBtn}
// onClick={() =>
// window.location.href = `/admin/timesheets?employee=${id}`
// }
// >
// Timesheets
// </button>

// <button
//   style={greenBtn}
//   onClick={() => {
//     setDesignation(user.designation || "");
//     setJoiningDate(user.joiningDate || "");
//     setShowLOI(true);
//   }}
// >
//   📄 Generate LOI
// </button>

// <button
// style={redBtn}
// onClick={async () => {

// const confirmDeactivate = window.confirm(
// "Deactivate this employee?"
// );

// if (!confirmDeactivate) return;

// await updateDoc(
// doc(db, "users", id),
// {
// status: "inactive",
// }
// );

// alert("Employee Deactivated");

// loadUser();

// }}
// >
// Deactivate
// </button>

// <button
// style={blueBtn}
// onClick={generateProfilePDF}
// >
// 📄 Download Profile
// </button>
// </div>

// <div style={sectionCard}>

// <h2 style={{
// marginBottom:"25px",
// fontSize:"22px",
// color:"#111827"
// }}>
// 👤 Basic Information
// </h2>


// <div style={{ marginBottom: 20 }}>
//   <label>First Name</label>

//   <input
//     disabled={!editMode}
//     value={user.firstName || ""}
//     onChange={(e) =>
//       setUser({
//         ...user,
//         firstName: e.target.value,
//       })
//     }
//     style={inputStyle}
//   />
// </div>
// <div style={{ marginBottom: 20 }}>
//   <label>Last Name</label>

//   <input
//     disabled={!editMode}
//     value={user.lastName || ""}
//     onChange={(e) =>
//       setUser({
//         ...user,
//         lastName: e.target.value,
//       })
//     }
//     style={inputStyle}
//   />
// </div>
// <div style={{ marginBottom: 20 }}>
//   <label>Employee ID</label>

//   <input
//     disabled={!editMode}
//     value={user.employeeId || ""}
//     onChange={(e) =>
//       setUser({
//         ...user,
//         employeeId: e.target.value,
//       })
//     }
//     style={inputStyle}
//   />
// </div>

// <p><b>Email:</b> {user.email}</p>

// <div style={{ marginBottom: 20 }}>
//   <label>Phone</label>

//   <input
//     disabled={!editMode}
//     value={user.phone || ""}
//     onChange={(e) =>
//       setUser({
//         ...user,
//         phone: e.target.value,
//       })
//     }
//     style={inputStyle}
//   />
// </div>

// <p><b>DOB:</b> {user.dob}</p>

// <p><b>Gender:</b> {user.gender}</p>

// <p><b>Blood Group:</b> {user.bloodGroup}</p>


// </div>
// <div style={sectionCard}>

// <h2 style={{
// marginBottom:"25px",
// fontSize:"22px",
// color:"#111827"
// }}>
// 💼 Job Information</h2>

// <div></div>
// <div
//   style={{
//   display: "grid",
//   gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
//   columnGap: "40px",
//   rowGap: "25px",
//   marginTop: "20px",
// }}
// >

// <div>
// <label>Department</label>

// <select
// disabled={!editMode}
// value={user.department || ""}
// onChange={(e)=>
// setUser({
// ...user,
// department:e.target.value
// })
// }
// style={inputStyle}
// >

// <option>Production</option>
// <option>Editing</option>
// <option>VFX</option>
// <option>Animation</option>
// <option>Marketing</option>
// <option>HR</option>
// <option>Accounts</option>
// <option>IT</option>

// </select>

// </div>

// <div>

// <label>Designation</label>

// <input
// disabled={!editMode}
// value={user.designation || ""}
// onChange={(e)=>
// setUser({
// ...user,
// designation:e.target.value
// })
// }
// style={inputStyle}
// />

// </div>

// <div>

// <label>Joining Date</label>

// <input
// type="date"
// disabled={!editMode}
// value={user.joiningDate || ""}
// onChange={(e)=>
// setUser({
// ...user,
// joiningDate:e.target.value
// })
// }
// style={inputStyle}
// />

// </div>

// <div>

// <label>Role</label>

// <select
// disabled={!editMode}
// value={user.role || ""}
// onChange={(e)=>
// setUser({
// ...user,
// role:e.target.value
// })
// }
// style={inputStyle}
// >

// <option>employee</option>
// <option>head</option>
// <option>owner</option>
// <option>admin</option>

// </select>

// </div>

// <div>

// <label>Status</label>

// <select
// disabled={!editMode}
// value={user.status || ""}
// onChange={(e)=>
// setUser({
// ...user,
// status:e.target.value
// })
// }
// style={inputStyle}
// >

// <option>active</option>

// <option>inactive</option>

// </select>

// </div>

// </div>

// </div>
// <div style={sectionCard}>

// <h2 style={{
// marginBottom:"25px",
// fontSize:"22px",
// color:"#111827"
// }}>💻 Company Access</h2>

// <div
//   style={{
//   display: "grid",
//   gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
//   columnGap: "40px",
//   rowGap: "25px",
//   marginTop: "20px",
// }}
// >

// <div>
// <label>Slack ID</label>

// <input
// disabled={!editMode}
// value={user.slackId || ""}
// onChange={(e)=>
// setUser({
// ...user,
// slackId:e.target.value
// })
// }
// style={inputStyle}
// />
// </div>

// <div>
// <label>Google Workspace Email</label>

// <input
// disabled={!editMode}
// value={user.email || ""}
// style={inputStyle}
// />
// </div>

// <div>
// <label>Frame.io Email</label>

// <input
// disabled={!editMode}
// value={user.frameioEmail || ""}
// onChange={(e)=>
// setUser({
// ...user,
// frameioEmail:e.target.value
// })
// }
// style={inputStyle}
// />
// </div>

// <div>
// <label>Manager</label>

// <input
// disabled={!editMode}
// value={user.manager || ""}
// onChange={(e)=>
// setUser({
// ...user,
// manager:e.target.value
// })
// }
// style={inputStyle}
// />
// </div>

// <div>
// <label>Employment Type</label>

// <select
// disabled={!editMode}
// value={user.employmentType || ""}
// onChange={(e)=>
// setUser({
// ...user,
// employmentType:e.target.value
// })
// }
// style={inputStyle}
// >

// <option value="">Select</option>
// <option>Full Time</option>
// <option>Intern</option>
// <option>Contract</option>
// <option>Freelancer</option>

// </select>

// </div>

// <div>
// <label>Work Location</label>

// <select
// disabled={!editMode}
// value={user.workLocation || ""}
// onChange={(e)=>
// setUser({
// ...user,
// workLocation:e.target.value
// })
// }
// style={inputStyle}
// >

// <option value="">Select</option>
// <option>Office</option>
// <option>Remote</option>
// <option>Hybrid</option>

// </select>

// </div>

// </div>


// </div>
// <div style={sectionCard}>

// <h2 style={{
// marginBottom:"25px",
// fontSize:"22px",
// color:"#111827"
// }}>🚨 Emergency Contact</h2>

// <div
//   style={{
//   display: "grid",
//   gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
//   columnGap: "40px",
//   rowGap: "25px",
//   marginTop: "20px",
// }}
// >

//   <div>
//     <label>Emergency Contact</label>

//     <input
//       disabled={!editMode}
//       value={user.emergencyContact || ""}
//       onChange={(e) =>
//         setUser({
//           ...user,
//           emergencyContact: e.target.value,
//         })
//       }
//       style={inputStyle}
//     />
//   </div>

//   <div>
//     <label>Emergency Phone</label>

//     <input
//       disabled={!editMode}
//       value={user.emergencyPhone || ""}
//       onChange={(e) =>
//         setUser({
//           ...user,
//           emergencyPhone: e.target.value,
//         })
//       }
//       style={inputStyle}
//     />
//   </div>

// </div>

// </div>


// <div style={sectionCard}>

// <h2 style={{
// marginBottom:"25px",
// fontSize:"22px",
// color:"#111827"
// }}>🏠 Address</h2>

// <div
//   style={{
//   display: "grid",
//   gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
//   columnGap: "40px",
//   rowGap: "25px",
//   marginTop: "20px",
// }}
// >

//   <div style={{ gridColumn: "1 / span 2" }}>
//     <label>Street Address</label>

//     <input
//       disabled={!editMode}
//       value={user.address || ""}
//       onChange={(e) =>
//         setUser({
//           ...user,
//           address: e.target.value,
//         })
//       }
//       style={inputStyle}
//     />
//   </div>

//     <div>
//     <label>City</label>

//     <input
//       disabled={!editMode}
//       value={user.city || ""}
//       onChange={(e) =>
//         setUser({
//           ...user,
//           city: e.target.value,
//         })
//       }
//       style={inputStyle}
//     />
//   </div>

//   <div>
//     <label>State</label>

//     <input
//       disabled={!editMode}
//       value={user.state || ""}
//       onChange={(e) =>
//         setUser({
//           ...user,
//           state: e.target.value,
//         })
//       }
//       style={inputStyle}
//     />
//   </div>
// <div>
//   <label>Country</label>

//   <input
//     disabled={!editMode}
//     value={user.country || ""}
//     onChange={(e) =>
//       setUser({
//         ...user,
//         country: e.target.value,
//       })
//     }
//     style={inputStyle}
//   />
// </div>
// </div>  {/* CLOSE ADDRESS GRID */}

// </div>  {/* CLOSE ADDRESS sectionCard */}


// <div style={sectionCard}>

// <h2 style={{
// marginBottom:"25px",
// fontSize:"22px",
// color:"#111827"
// }}>📁 Documents & Assets</h2>

// <div
//   style={{
//   display: "grid",
//   gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
//   columnGap: "40px",
//   rowGap: "25px",
//   marginTop: "20px",
// }}
// >

// <div>
//   <label>Resume</label>

//   {user.resume ? (
//     <div
//       style={{
//         display: "flex",
//         alignItems: "center",
//         gap: "12px",
//         marginTop: "10px",
//       }}
//     >
//       <a
//         href={user.resume}
//         target="_blank"
//         rel="noopener noreferrer"
//         style={{
//           background: "#2563eb",
//           color: "#fff",
//           padding: "10px 18px",
//           borderRadius: "10px",
//           textDecoration: "none",
//           fontWeight: 600,
//         }}
//       >
//         📄 View Resume
//       </a>

//       <a
//         href={user.resume}
//         download
//         style={{
//           background: "#16a34a",
//           color: "#fff",
//           padding: "10px 18px",
//           borderRadius: "10px",
//           textDecoration: "none",
//           fontWeight: 600,
//         }}
//       >
//         ⬇ Download
//       </a>
//     </div>
//   ) : (
//     <p
//       style={{
//         color: "#64748b",
//         marginTop: "12px",
//       }}
//     >
//       No resume uploaded.
//     </p>
//   )}


// {/* Only show when HR/Admin clicks Edit Employee */}

//   {editMode && (
//     <div style={{ marginTop: "15px" }}>
//       <input
//         type="file"
//         accept=".pdf,.doc,.docx"
//         onChange={handleResumeUpload}
//       />
//     </div>
//   )}
// </div>

// <div>

// <label>Offer Letter URL</label>

// <input
// disabled={!editMode}
// value={user.offerLetter || ""}
// onChange={(e)=>
// setUser({
// ...user,
// offerLetter:e.target.value
// })
// }
// style={inputStyle}
// />

// </div>

// <div>

// <label>ID Proof URL</label>

// <input
// disabled={!editMode}
// value={user.idProof || ""}
// onChange={(e)=>
// setUser({
// ...user,
// idProof:e.target.value
// })
// }
// style={inputStyle}
// />

// </div>

// <div>

// <label>Bank Account</label>

// <input
// disabled={!editMode}
// value={user.bankAccount || ""}
// onChange={(e)=>
// setUser({
// ...user,
// bankAccount:e.target.value
// })
// }
// style={inputStyle}
// />

// </div>

// <div>

// <label>Laptop Assigned</label>

// <input
// disabled={!editMode}
// value={user.laptop || ""}
// onChange={(e)=>
// setUser({
// ...user,
// laptop:e.target.value
// })
// }
// style={inputStyle}
// />

// </div>

// <div>

// <label>Laptop Serial No.</label>

// <input
// disabled={!editMode}
// value={user.laptopSerial || ""}
// onChange={(e)=>
// setUser({
// ...user,
// laptopSerial:e.target.value
// })
// }
// style={inputStyle}
// />

// </div>

// </div>

// </div>


// <div style={sectionCard}>

// <h2 style={{
// marginBottom:"25px",
// fontSize:"22px",
// color:"#111827"
// }}>📝 HR Notes</h2>

// <textarea
// disabled={!editMode}
// value={user.hrNotes || ""}
// onChange={(e)=>
// setUser({
// ...user,
// hrNotes:e.target.value
// })
// }
// style={{
// width:"90%",
// height:"180px",
// padding:"15px",
// marginTop:"20px",
// borderRadius:"10px",
// border:"1px solid #d1d5db",
// fontSize:"19px"
// }}
// placeholder="Private HR Notes..."
// />
// </div>
// <h2 style={{ marginTop: "40px" }}>
// 📅 Employee Timeline
// </h2>

// <div
// style={{
// background:"#f8fafc",
// padding:"25px",
// borderRadius:"15px",
// marginTop:"20px"
// }}
// >

// <p>✅ Joined Company : {user.joiningDate || "-"}</p>

// <p>👤 Profile Completed</p>

// <p>💼 Department Assigned</p>

// <p>🖥 Laptop Assigned</p>

// <p>📄 Offer Letter Uploaded</p>

// <p>
//   🎉 Last Updated :{" "}
//   {user.updatedAt?.toDate?.().toLocaleDateString() || "-"}
// </p>

// </div>
// {showLOI && (
//   <div
//     style={{
//       position: "fixed",
//       inset: 0,
//       background: "rgba(0,0,0,.6)",
//       display: "flex",
//       justifyContent: "center",
//       alignItems: "center",
//       zIndex: 9999,
//     }}
//   >
//     <div
//       style={{
//         width: "500px",
//         background: "#fff",
//         padding: "30px",
//         borderRadius: "12px",
//       }}
//     >
//       <h2>Generate Letter of Intent</h2>

//       <p>
//         <b>Employee</b>
//       </p>

//       <input
//         value={`${user.firstName} ${user.lastName}`}
//         disabled
//         style={inputStyle}
//       />

//       <p>Email</p>

//       <input
//   value={user.email || ""}
//   disabled
//   style={inputStyle}
// />

//       <p>Designation</p>

//       <input
//         value={designation}
//         onChange={(e) => setDesignation(e.target.value)}
//         style={inputStyle}
//       />

//       <p>Joining Date</p>

//       <input
//         type="date"
//         value={joiningDate}
//         onChange={(e) => setJoiningDate(e.target.value)}
//         style={inputStyle}
//       />

//       <div
//         style={{
//           display: "flex",
//           gap: "15px",
//           marginTop: "25px",
//         }}
//       >
//         <button
//   style={greenBtn}
//   onClick={() => {
//     setShowLOI(false);
//     setShowPreview(true);
//   }}
// >
//   Generate
// </button>

//         <button
//           style={redBtn}
//           onClick={() => setShowLOI(false)}
//         >
//           Cancel
//         </button>
//       </div>
//     </div>
//   </div>
// )}
// {showPreview && (
//   <div
//     style={{
//       position: "fixed",
//       inset: 0,
//       background: "rgba(0,0,0,.7)",
//       overflow: "auto",
//       zIndex: 9999,
//       padding: "40px",
//     }}
//   >
//     <div
//       style={{
//         maxWidth: "900px",
//         margin: "auto",
//         background: "#fff",
//         borderRadius: "10px",
//         overflow: "hidden",
//       }}
//     >
//       <div id="loi-document">
//         <LetterOfIntent
//           employeeName={`${user.firstName} ${user.lastName}`}
//           designation={designation}
//           joiningDate={joiningDate}
//           currentDate={currentDate}
//         />
//       </div>

//       <div
//         style={{
//           display: "flex",
//           justifyContent: "center",
//           gap: "20px",
//           padding: "20px",
//           borderTop: "1px solid #eee",
//         }}
//       >
//         <button
//           style={greenBtn}
//           onClick={generatePDF}
//         >
//           📄 Download PDF
//         </button>

//         {/* <button
//           style={greenBtn}
//           onClick={sendLOI}
//         >
//           📧 Send LOI
//         </button> */}

//         <button
//           style={redBtn}
//           onClick={() => setShowPreview(false)}
//         >
//           Close
//         </button>

//       </div>
//     </div>
//   </div>
// )}
// </div>

// );
// }

// const inputStyle = {
//   width: "90%",
//   padding: "14px 16px",
//   marginTop: "8px",
//   marginBottom: "15px",
//   border: "1px solid #d1d5db",
//   borderRadius: "10px",
//   fontSize: "19px",
//   boxSizing: "border-box",
// };

// const sectionDivider = {
//   margin: "30px 0",
//   border: "none",
//   borderTop: "1px solid #e5e7eb",
// };

// const cardStyle = {
//   background: "#f8fafc",
//   padding: "25px",
//   borderRadius: "15px",
//   textAlign: "center",
//   boxShadow: "0 4px 15px rgba(0,0,0,.06)",
// };

// const purpleBtn = {
//   background: "#7c3aed",
//   color: "#fff",
//   border: "none",
//   padding: "12px 20px",
//   borderRadius: "8px",
//   cursor: "pointer",
//    fontSize: "19px",
// };

// const blueBtn = {
//   background: "#3d6fa8",
//   color: "#fff",
//   border: "none",
//   padding: "10px 18px",
//   borderRadius: "8px",
//   cursor: "pointer",
//    fontSize: "19px",
// };
// const greenBtn = {
//   background: "#16a34a",
//   color: "#fff",
//   border: "none",
//   padding: "10px 18px",
//   borderRadius: "8px",
//   cursor: "pointer",
//   fontWeight: "600",
//    fontSize: "19px",
// };
// const redBtn = {
//   background: "#dc2626",
//   color: "#fff",
//   border: "none",
//   padding: "10px 18px",
//   borderRadius: "8px",
//   cursor: "pointer",
//   fontWeight: "600",
//    fontSize: "19px",
// };

// const orangeBtn = {
//   background: "#f59e0b",
//   color: "#fff",
//   border: "none",
//   padding: "10px 18px",
//   borderRadius: "8px",
//   cursor: "pointer",
//   fontWeight: "600",
//    fontSize: "19px",
// };

// const grayBtn = {
//   background: "#64748b",
//   color: "#fff",
//   border: "none",
//   padding: "10px 18px",
//   borderRadius: "8px",
//   cursor: "pointer",
//   fontWeight: "600",
//    fontSize: "19px",
// };
// const sectionCard = {
//   background:"#ffffff",
//   padding:"30px",
//   borderRadius:"16px",
//   marginBottom:"25px",
//   border:"1px solid #e5e7eb",
//   boxShadow:"0 4px 12px rgba(0,0,0,0.04)",
// };