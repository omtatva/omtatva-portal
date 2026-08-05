"use client";

import React, {
useEffect,
useState
} from "react";

import {
auth,
db,
storage
} from "../../../lib/firebase";


import toast from "react-hot-toast";

import { useProfile } from "../ProfileContext";


import {
ref,
getDownloadURL,
uploadBytesResumable
}
from "firebase/storage";


import {
collection,
query,
where,
getDocs,
setDoc,
doc,
serverTimestamp,
arrayUnion
}
from "firebase/firestore";


// Document types that accept more than one file. Everything else
// (photo, resume, cheque, offer) stays a single-file upload where
// `documents[key]` is a plain URL string. For these keys,
// `documents[key]` is instead an array of { fileName, url }.
const MULTI_UPLOAD_TYPES = ["aadhaar", "pan", "education", "experience", "other"];

// Maps this component's field keys to the field names/shapes that
// `admin/documents/[id]` (a separate, HR-facing page reading from the
// `users` collection) expects. Keys with no mapping (photo, education,
// other) have no equivalent field there, so they're skipped — they'll
// still save normally to employeeDocuments/employeeProfiles above,
// just won't appear on that particular admin screen.
const ADMIN_DOCUMENTS_FIELD_MAP: Record<string, string> = {
  aadhaar: "aadhaar",
  pan: "pan",
  resume: "resume",
  experience: "experienceLetter",
  cheque: "bank",
  offer: "offerLetter",
};


export default function DocumentUpload({

back,
next

}:{

back:()=>void;
next:()=>void;

}){


const { profile, setProfile } = useProfile();

const [documents,setDocuments]=useState<any>({});

const [uploadProgress,setUploadProgress]=useState<any>({});




useEffect(()=>{

loadDocuments();

},[]);





const loadDocuments=async()=>{


const user=auth.currentUser;

if(!user)
return;


const q=query(

collection(db,"employeeDocuments"),

where(
"employeeId",
"==",
user.uid
)

);



const snap=await getDocs(q);



let data:any={};


snap.forEach((docSnap)=>{

const d=docSnap.data();

if(MULTI_UPLOAD_TYPES.includes(d.documentType)){

// Multi-type docs store their files array directly on the doc
data[d.documentType] = d.files || [];

}
else{

data[d.documentType]=d.downloadURL;

}


});



setDocuments(data);


// keep context in sync too, so sectionCompleted() sees it
setProfile((prev:any)=>({

...prev,

documents:{

...prev.documents,

...data

}

}));


};







const uploadFile=async(

file:File,

type:string

)=>{


const user=auth.currentUser;


if(!user)
return;


const isMulti = MULTI_UPLOAD_TYPES.includes(type);

// For multi-upload types, track progress per-file (keyed by file
// name) instead of overwriting a single progress value per type.
const progressKey = isMulti ? `${type}:${file.name}` : type;



try{


setUploadProgress((prev:any)=>({

...prev,

[progressKey]:0

}));



const storageRef=ref(

storage,

`employees/${user.uid}/documents/${type}/${file.name}`

);



const uploadTask=
uploadBytesResumable(
storageRef,
file
);



uploadTask.on(

"state_changed",

(snapshot)=>{


const progress=Math.round(

(snapshot.bytesTransferred /
snapshot.totalBytes)
*
100

);



setUploadProgress((prev:any)=>({

...prev,

[progressKey]:progress

}));

},


(error)=>{


console.log(error);

toast.error(
"Upload failed"
);


},


async()=>{


const url=
await getDownloadURL(
uploadTask.snapshot.ref
);



if(isMulti){


// 1) Save to employeeDocuments collection — append this file
//    to the doc's `files` array instead of overwriting.

await setDoc(

doc(
db,
"employeeDocuments",
`${user.uid}_${type}`
),


{

employeeId:user.uid,

employeeEmail:user.email,

documentType:type,

files: arrayUnion({
fileName:file.name,
url:url
}),

updatedAt:
serverTimestamp()

},


{
merge:true
}

);




// 2) Mirror into employeeProfiles/{uid}.documents so
//    admin/users/[id] page (which reads the profile doc)
//    shows the uploaded documents too.

const existingFiles =
(documents[type] as any[]) || [];

const updatedFiles = [
...existingFiles,
{ fileName:file.name, url:url }
];

await setDoc(

doc(
db,
"employeeProfiles",
user.uid
),

{

documents:{

...profile.documents,

[type]: updatedFiles

}

},

{
merge:true
}

);



setDocuments((prev:any)=>({

...prev,

[type]: [
...( (prev[type] as any[]) || [] ),
{ fileName:file.name, url:url }
]

}));



setProfile((prev:any)=>({

...prev,

documents:{

...prev.documents,

[type]: updatedFiles

}

}));



// 3) Mirror into users/{uid}.documents so the separate HR-facing
//    admin/documents/[id] page can see it too — using the field
//    name and { name, url } shape that page expects.

const adminField = ADMIN_DOCUMENTS_FIELD_MAP[type];

if(adminField){

await setDoc(

doc(
db,
"users",
user.uid
),

{

documents:{

[adminField]: arrayUnion({
name:file.name,
url:url
})

}

},

{
merge:true
}

);

}


}

else{


// 1) Save to employeeDocuments collection (existing behaviour)

await setDoc(

doc(
db,
"employeeDocuments",
`${user.uid}_${type}`
),


{

employeeId:user.uid,

employeeEmail:user.email,

documentType:type,

downloadURL:url,

fileName:file.name,

updatedAt:
serverTimestamp()

},


{
merge:true
}

);




// 2) Mirror into employeeProfiles/{uid}.documents so
//    admin/users/[id] page (which reads the profile doc)
//    shows the uploaded documents too.

await setDoc(

doc(
db,
"employeeProfiles",
user.uid
),

{

documents:{

...profile.documents,

[type]:url

}

},

{
merge:true
}

);




setDocuments((prev:any)=>({

...prev,

[type]:url

}));



setProfile((prev:any)=>({

...prev,

documents:{

...prev.documents,

[type]:url

}

}));


// 3) Mirror into users/{uid}.documents so the separate HR-facing
//    admin/documents/[id] page can see it too — using the field
//    name that page expects (e.g. "experience" -> "experienceLetter").

const adminField = ADMIN_DOCUMENTS_FIELD_MAP[type];

if(adminField){

await setDoc(

doc(
db,
"users",
user.uid
),

{

documents:{

[adminField]: url

}

},

{
merge:true
}

);

}


// 4) Profile photo is a special case — the admin header cards read
//    a top-level `profilePhoto` (EmployeePage.js) / `photoURL`
//    (AdminEmployeeDocumentsPage.js) field, not documents.photo, so
//    set both directly whenever this upload is the "photo" type.

if(type === "photo"){

await setDoc(

doc(
db,
"employeeProfiles",
user.uid
),

{
profilePhoto: url
},

{
merge:true
}

);

await setDoc(

doc(
db,
"users",
user.uid
),

{
photoURL: url,
profilePhoto: url
},

{
merge:true
}

);

}



}



toast.success(
`${file.name} uploaded`
);



}


);



}

catch(err){

console.log(err);

toast.error(
"Something went wrong"
);


}



};




const uploadMultipleFiles = (

fileList:FileList,

type:string

)=>{

Array.from(fileList).forEach((file)=>{

uploadFile(file, type);

});

};









const uploadCard=(

title:string,

key:string

)=>{

const isMulti = MULTI_UPLOAD_TYPES.includes(key);

const multiFiles: any[] = isMulti ? (documents[key] || []) : [];

const hasAny = isMulti ? multiFiles.length > 0 : Boolean(documents[key]);

return (


<div

style={{

border:"2px dashed #cbd5e1",

borderRadius:16,

padding:25,

textAlign:"center",

background:"#f8fafc"

}}

>


<h3

style={{

color:"#3d6fa8"

}}

>

{title}

</h3>




<input

id={key}

type="file"

multiple={isMulti}

style={{
display:"none"
}}

onChange={(e)=>{


const files=
e.target.files;


if(!files || files.length===0)
return;


if(isMulti){

uploadMultipleFiles(files, key);

}
else{

uploadFile(files[0], key);

}


// reset so the same file(s) can be re-selected later
e.target.value = "";


}}

/>




<label

htmlFor={key}

style={{

display:"inline-block",

marginTop:15,

background:
hasAny
?
"#16a34a"
:
"#3d6fa8",

color:"#fff",

padding:"10px 22px",

borderRadius:10,

cursor:"pointer",

fontWeight:600

}}

>


{
isMulti
?
(hasAny ? `✅ ${multiFiles.length} Uploaded / Add More` : "📤 Upload (multiple allowed)")
:
(hasAny ? "✅ Uploaded / Replace" : "📤 Upload")
}


</label>





{/* Per-file progress for multi-upload types */}

{

isMulti &&

Object.keys(uploadProgress)

.filter((k)=>k.startsWith(`${key}:`) && uploadProgress[k] < 100)

.map((k)=>(

<p key={k} style={{ fontSize:13, margin:"6px 0 0" }}>

Uploading {k.split(":")[1]}... {uploadProgress[k]}%

</p>

))

}


{/* Single-file progress */}

{

!isMulti &&

uploadProgress[key]!==undefined &&

uploadProgress[key]<100 &&


<p>

Uploading...

{uploadProgress[key]}%

</p>

}




{/* Multi-upload file list */}

{

isMulti && multiFiles.length > 0 &&

<div style={{ marginTop:15, textAlign:"left" }}>

{multiFiles.map((f, i)=>(

<a

key={i}

href={f.url}

target="_blank"

style={{

display:"flex",

justifyContent:"space-between",

gap:10,

padding:"8px 10px",

marginBottom:6,

background:"#fff",

border:"1px solid #e2e8f0",

borderRadius:8,

color:"#3d6fa8",

textDecoration:"none",

fontSize:13.5,

}}

>

<span style={{

overflow:"hidden",

textOverflow:"ellipsis",

whiteSpace:"nowrap",

}}>

📄 {f.fileName}

</span>

<span>View →</span>

</a>

))}

</div>

}




{/* Single-upload view link */}

{

!isMulti && documents[key] &&


<a

href={documents[key]}

target="_blank"

style={{

display:"block",

marginTop:15,

color:"#3d6fa8"

}}

>

View Document

</a>


}



</div>


);

};









return (

<div>


<h2

style={{

color:"#3d6fa8",

marginBottom:35

}}

>

📁 Document Upload

</h2>




<div

style={{

display:"grid",

gridTemplateColumns:

"repeat(auto-fit,minmax(260px,1fr))",

gap:25

}}

>


{uploadCard(
"📷 Profile Photo",
"photo"
)}


{uploadCard(
"🪪 Aadhaar Card",
"aadhaar"
)}


{uploadCard(
"💳 PAN Card",
"pan"
)}


{uploadCard(
"📄 Resume",
"resume"
)}


{uploadCard(
"🎓 Education Certificates",
"education"
)}


{uploadCard(
"💼 Experience Letter",
"experience"
)}


{uploadCard(
"🏦 Cancelled Cheque",
"cheque"
)}


{uploadCard(
"📃 Offer Letter",
"offer"
)}


{uploadCard(
"📂 Other Documents",
"other"
)}



</div>





<div

style={{

display:"flex",

justifyContent:"space-between",

marginTop:45

}}

>


<button

onClick={back}

style={{

background:"#64748b",

color:"#fff",

border:"none",

padding:"14px 30px",

borderRadius:12,

fontWeight:700,

cursor:"pointer"

}}

>

← Back

</button>





<button

onClick={next}

style={{

background:"#3d6fa8",

color:"#fff",

border:"none",

padding:"14px 30px",

borderRadius:12,

fontWeight:700,

cursor:"pointer"

}}

>

Save & Continue →

</button>




</div>



</div>


);


}


// "use client";

// import React, { useState } from "react";
// import { auth, db, storage } from "../../../lib/firebase";
// import toast from "react-hot-toast";
// import {
//   ref,
//   getDownloadURL,
//   uploadBytesResumable,
// } from "firebase/storage";

// import {
//   addDoc,
//   collection,
//   serverTimestamp,
// } from "firebase/firestore";
// export default function DocumentUpload({
//   back,
//   next,
// }: {
//   back: () => void;
//   next: () => void;
// }) {

//   const [documents, setDocuments] = useState<{
//     [key: string]: File | null;
//   }>({});

//   const [uploadProgress, setUploadProgress] = useState<{
//   [key: string]: number;
// }>({});

// const uploadFile = async (
//   file: File,
//   type: string
// ) => {
//   const user = auth.currentUser;

//   if (!user) {
//     toast.error("Please login first.");
//     return;
//   }

//   const storageRef = ref(
//     storage,
//     `employees/${user.uid}/${type}/${file.name}`
//   );

//   const uploadTask = uploadBytesResumable(
//     storageRef,
//     file
//   );

//   return new Promise<void>((resolve, reject) => {
//     uploadTask.on(
//       "state_changed",

//       (snapshot) => {
//         const progress = Math.round(
//           (snapshot.bytesTransferred /
//             snapshot.totalBytes) *
//             100
//         );

//         setUploadProgress((prev) => ({
//           ...prev,
//           [type]: progress,
//         }));
//       },

//       (error) => {
//         reject(error);
//       },

//       async () => {
//         try {
//           const url = await getDownloadURL(
//             uploadTask.snapshot.ref
//           );

//           await addDoc(
//             collection(db, "employeeDocuments"),
//             {
//               employeeId: user.uid,
//               employeeEmail: user.email,
//               fileName: file.name,
//               documentType: type,
//               downloadURL: url,
//               status: "Pending",
//               uploadedAt: serverTimestamp(),
//             }
//           );

//           setUploadProgress((prev) => ({
//             ...prev,
//             [type]: 100,
//           }));

//           resolve();
//         } catch (error) {
//           reject(error);
//         }
//       }
//     );
//   });
// };

//   const uploadCard = (title: string, key: string) => (
//     <div
//       style={{
//         border: "2px dashed #cbd5e1",
//         borderRadius: 16,
//         padding: 25,
//         textAlign: "center",
//         background: "#f8fafc",
//       }}
//     >
//       <h3
//         style={{
//           marginBottom: 15,
//           color: "#3d6fa8",
//         }}
//       >
//         {title}
//       </h3>

//       <input
//   id={key}
//   type="file"
//   style={{ display: "none" }}
//   onChange={async (e) => {
//     const file = e.target.files?.[0];

//     if (!file) return;

//     setDocuments({
//       ...documents,
//       [key]: file,
//     });

//     await uploadFile(file, key);
//   }}
// />

// <label
//   htmlFor={key}
//   style={{
//     display: "inline-block",
//     marginTop: 15,
//     background:
//       uploadProgress[key] === 100
//         ? "#16a34a"
//         : "#3d6fa8",
//     color: "#fff",
//     padding: "10px 22px",
//     borderRadius: 10,
//     cursor: "pointer",
//     fontWeight: 600,
//     fontSize: 14,
//   }}
// >
//   {uploadProgress[key] === 100
//     ? "✅ Replace File"
//     : "📤 Upload File"}
// </label>

// {uploadProgress[key] > 0 &&
// uploadProgress[key] < 100 && (
//  <>
//   <div
//     style={{
//       width: "100%",
//       height: 8,
//       background: "#e2e8f0",
//       borderRadius: 50,
//       marginTop: 15,
//       overflow: "hidden",
//     }}
//   >
//     <div
//       style={{
//         width: `${uploadProgress[key]}%`,
//         height: "100%",
//         background:
//           uploadProgress[key] === 100
//             ? "#16a34a"
//             : "#3d6fa8",
//         transition: "width .3s ease",
//       }}
//     />
//   </div>

//  <p
//   style={{
//     marginTop: 10,
//     fontWeight: 600,
//     fontSize: 14,
//     color:
//       uploadProgress[key] === 100
//         ? "#16a34a"
//         : "#3d6fa8",
//   }}
// >
//   {uploadProgress[key] === 100 ? (
//     <>✅ Uploaded Successfully</>
//   ) : uploadProgress[key] > 0 ? (
//     <>⏳ Uploading... {uploadProgress[key]}%</>
//   ) : (
//     <>📤 Ready to Upload</>
//   )}
// </p>
// </>
// )}
//       <p
//   style={{
//     marginTop: 15,
//     fontSize: 14,
//     color: documents[key] ? "#16a34a" : "#64748b",
//     fontWeight: 600,
//     minHeight: 20,
//   }}
// >
//   {documents[key]
//     ? `✅ ${documents[key]?.name}`
//     : "No file selected"}
// </p>
// <p
//   style={{
//     fontSize: 12,
//     color: "#94a3b8",
//     marginTop: 8,
//   }}
// >
//   PDF, JPG, PNG • Max 5 MB
// </p>
//     </div>
//   );

//   return (
//     <div>
//       <h2
//         style={{
//           color: "#3d6fa8",
//           marginBottom: 35,
//         }}
//       >
//         📁 Document Upload
//       </h2>

//       <div
//         style={{
//           display: "grid",
//           gridTemplateColumns:
//             "repeat(auto-fit,minmax(260px,1fr))",
//           gap: 25,
//         }}
//       >
//         {uploadCard("📷 Profile Photo", "photo")}
//         {uploadCard("🪪 Aadhaar Card", "aadhaar")}
//         {uploadCard("💳 PAN Card", "pan")}
//         {uploadCard("📄 Resume", "resume")}
//         {uploadCard("🎓 Education Certificates", "education")}
//         {uploadCard("💼 Experience Letter", "experience")}
//         {uploadCard("🏦 Cancelled Cheque", "cheque")}
//         {uploadCard("📃 Offer Letter", "offer")}
//         {uploadCard("📂 Other Documents", "other")}
//       </div>

//       <div
//         style={{
//           display: "flex",
//           justifyContent: "space-between",
//           marginTop: 45,
//         }}
//       >
//         <button
//           onClick={back}
//           style={{
//             background: "#64748b",
//             color: "#fff",
//             border: "none",
//             padding: "14px 30px",
//             borderRadius: 12,
//             cursor: "pointer",
//             fontWeight: 700,
//           }}
//         >
//           ← Back
//         </button>

//         <button
//           onClick={next}
//           style={{
//             background: "#3d6fa8",
//             color: "#fff",
//             border: "none",
//             padding: "14px 30px",
//             borderRadius: 12,
//             cursor: "pointer",
//             fontWeight: 700,
//           }}
//         >
//           Save & Continue →
//         </button>
//       </div>
//     </div>
//   );
// }