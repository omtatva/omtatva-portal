"use client";

import { useEffect, useState } from "react";

import {
  collection,
  getDocs,
  addDoc,
} from "firebase/firestore";

import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

import { db, storage } from "../../../lib/firebase";


export default function DocumentsPage() {

  const [employees,setEmployees] = useState<any[]>([]);
  const [commonDocs,setCommonDocs] = useState<any[]>([]);
  const [search,setSearch] = useState("");
const [uploading,setUploading] = useState(false);

  useEffect(()=>{

    loadEmployees();
    loadCommonDocs();

  },[]);



  const loadEmployees = async()=>{

    const snapshot = await getDocs(
      collection(db,"users")
    );


    const list = snapshot.docs.map((doc)=>({

      id:doc.id,
      ...doc.data()

    }));


    setEmployees(list);

  };




  const loadCommonDocs = async()=>{

    const snapshot = await getDocs(
      collection(db,"commonDocuments")
    );


    const list = snapshot.docs.map((doc)=>({

      id:doc.id,
      ...doc.data()

    }));


    setCommonDocs(list);

  };


const uploadCommonDocument = async(file?: File)=>{

  if(!file){
    alert("Please select file");
    return;
  }

  try{

    setUploading(true);

    console.log("Selected file:", file.name);


    const storageRef = ref(
      storage,
      `commonDocuments/${Date.now()}_${file.name}`
    );


    console.log("Starting upload");


    const uploadTask = await uploadBytes(
      storageRef,
      file
    );


    console.log("Upload done", uploadTask);


    const url = await getDownloadURL(storageRef);


    console.log("Download URL:", url);



    await addDoc(
      collection(db,"commonDocuments"),
      {
        name:file.name,
        url:url,
        uploadedAt:new Date()
      }
    );


    alert("✅ Upload Complete");


    loadCommonDocs();


  }
  catch(error:any){

    console.log("UPLOAD ERROR:",error);

    alert(
      error.message || "Upload Failed"
    );

  }
  finally{

    setUploading(false);

  }

};



  const filtered =
  employees.filter((emp)=>{


    const keyword =
    search.toLowerCase();



    return (

      (emp.firstName || "")
      .toLowerCase()
      .includes(keyword)


      ||

      (emp.lastName || "")
      .toLowerCase()
      .includes(keyword)


      ||

      (emp.employeeId || "")
      .toLowerCase()
      .includes(keyword)

    );


  });




return (

<div

style={{

width:"96%",
maxWidth:"1700px",
margin:"40px auto"

}}

>



{/* HEADER */}

<div

style={{

display:"flex",
justifyContent:"space-between",
alignItems:"center",
marginBottom:35

}}

>


<div>


<h1

style={{

fontSize:46,
fontWeight:800,
margin:0

}}

>

📁 Employee Documents

</h1>


<p

style={{

color:"#64748b",
fontSize:18

}}

>

Manage employee documents and HR files.

</p>


</div>




<button

onClick={()=>
window.location.href="/admin"
}

style={{

padding:"15px 28px",
background:"#3d6fa8",
color:"#fff",
border:"none",
borderRadius:12,
fontWeight:700,
cursor:"pointer"

}}

>

← Dashboard

</button>



</div>






{/* COMMON DOCUMENTS */}


<div

style={{

background:"#fff",
padding:25,
borderRadius:15,
marginBottom:35,
boxShadow:"0 5px 20px rgba(0,0,0,.08)"

}}

>


<h2>

📂 Common Documents

</h2>



<label

style={{

display:"inline-block",
background:"#2563eb",
color:"#fff",
padding:"12px 22px",
borderRadius:10,
cursor:"pointer",
fontWeight:600

}}

>

{uploading 
? "Uploading..."
: "+ Upload Document"
}


<input

type="file"

style={{
display:"none"
}}

onChange={(e) => {

const file = e.target.files?.[0];

if(file){
  uploadCommonDocument(file);
}

}}


/>


</label>





<div

style={{

marginTop:25

}}

>


{

commonDocs.map((file)=>(


<div

key={file.id}

style={{

display:"flex",
justifyContent:"space-between",
alignItems:"center",
padding:"12px 0",
borderBottom:"1px solid #eee"

}}

>


<span>

📄 {file.name}

</span>



<a

href={file.url}

target="_blank"

style={{

color:"#2563eb",
fontWeight:600

}}

>

View

</a>



</div>


))


}


</div>


</div>








{/* SEARCH */}


<input

placeholder="Search Employee..."

value={search}

onChange={(e)=>
setSearch(e.target.value)
}


style={{

width:"100%",
padding:"16px",
fontSize:18,
borderRadius:12,
border:"1px solid #d1d5db",
marginBottom:25

}}

/>







{/* EMPLOYEE TABLE */}


<div

style={{

background:"#fff",
borderRadius:15,
overflow:"hidden",
boxShadow:"0 5px 20px rgba(0,0,0,.08)"

}}

>


<table

style={{

width:"100%",
borderCollapse:"collapse"

}}

>


<thead>

<tr
style={{
background:"#f8fafc"
}}
>

<th style={th}>
Employee
</th>

<th style={th}>
Employee ID
</th>

<th style={th}>
Department
</th>

<th style={th}>
Resume
</th>

<th style={th}>
Status
</th>

<th style={th}>
Action
</th>

</tr>

</thead>





<tbody>


{

filtered.map((emp)=>(


<tr key={emp.id}>


<td style={td}>

{emp.firstName} {emp.lastName}

</td>


<td style={td}>

{emp.employeeId || "-"}

</td>


<td style={td}>

{emp.department || "-"}

</td>


<td style={td}>

{emp.resume ? "✅ Uploaded":"❌ Missing"}

</td>


<td style={td}>

{emp.status || "Active"}

</td>


<td style={td}>


<button

onClick={()=>{

window.location.href =
`/admin/documents/${emp.id}`

}}


style={{

background:"#2563eb",
color:"#fff",
border:"none",
padding:"10px 20px",
borderRadius:10,
cursor:"pointer",
fontWeight:600

}}

>

View Documents

</button>


</td>


</tr>


))


}


</tbody>


</table>


</div>



</div>

);


}



const th: React.CSSProperties = {

textAlign:"left",
padding:"18px",
fontSize:"18px"

};


const td: React.CSSProperties = {

padding:"18px",
fontSize:"17px",
borderTop:"1px solid #eee"

};




// "use client";

// import { useEffect, useState } from "react";
// import { collection, getDocs } from "firebase/firestore";
// import { db } from "../../../lib/firebase";

// export default function DocumentsPage() {
//   const [employees, setEmployees] = useState([]);
//   const [search, setSearch] = useState("");

//   useEffect(() => {
//     loadEmployees();
//   }, []);

//   const loadEmployees = async () => {
//     const snapshot = await getDocs(collection(db, "users"));

//     const list = snapshot.docs.map((doc) => ({
//       id: doc.id,
//       ...doc.data(),
//     }));

//     setEmployees(list);
//   };

//   const filtered = employees.filter((emp) => {
//     const keyword = search.toLowerCase();

//     return (
//       (emp.firstName || "").toLowerCase().includes(keyword) ||
//       (emp.lastName || "").toLowerCase().includes(keyword) ||
//       (emp.employeeId || "").toLowerCase().includes(keyword)
//     );
//   });

// return (
// <div
//   style={{
//     width: "96%",
//     maxWidth: "1700px",
//     margin: "40px auto",
//   }}
// >


// {/* Header */}

// <div
//   style={{
//     width:"100%",
//     display:"flex",
//     justifyContent:"space-between",
//     alignItems:"center",
//     marginBottom:"35px",
//     flexWrap:"wrap",
//     gap:"20px",
//   }}
// >


// <div>

// <h1
// style={{
// fontSize:46,
// fontWeight:800,
// margin:0,
// color:"#111"
// }}
// >
// 📁 Employee Documents
// </h1>


// <p
// style={{
// marginTop:10,
// color:"#64748b",
// fontSize:18
// }}
// >
// Manage employee documents and upload HR files.
// </p>


// </div>



// <button
// onClick={()=>window.location.href="/admin"}
// style={{
// padding:"15px 28px",
// fontSize:"16px",
// borderRadius:12,
// border:"none",
// background:"#3d6fa8",
// color:"#fff",
// fontWeight:700,
// cursor:"pointer",
// whiteSpace:"nowrap",
// }}
// >
// ← Dashboard
// </button>



// </div>

//       <input
//         placeholder="Search Employee..."
//         value={search}
//         onChange={(e) => setSearch(e.target.value)}
//         style={{
//           width: "100%",
//           padding: "16px",
//           fontSize: 18,
//           borderRadius: 12,
//           border: "1px solid #d1d5db",
//           marginBottom: 25,
//         }}
//       />

//       <div
//         style={{
//           background: "#fff",
//           borderRadius: 15,
//           overflow: "hidden",
//           boxShadow: "0 5px 20px rgba(0,0,0,.08)",
//         }}
//       >
//         <table
//           style={{
//             width: "100%",
//             borderCollapse: "collapse",
//           }}
//         >
//           <thead>
//             <tr
//               style={{
//                 background: "#f8fafc",
//               }}
//             >
//               <th style={th}>Employee</th>
//               <th style={th}>Employee ID</th>
//               <th style={th}>Department</th>
//               <th style={th}>Resume</th>
//               <th style={th}>Status</th>
//               <th style={th}>Action</th>
//             </tr>
//           </thead>

//           <tbody>
//             {filtered.map((emp) => (
//               <tr key={emp.id}>
//                 <td style={td}>
//                   {emp.firstName} {emp.lastName}
//                 </td>

//                 <td style={td}>
//                   {emp.employeeId || "-"}
//                 </td>

//                 <td style={td}>
//                   {emp.department || "-"}
//                 </td>

//                 <td style={td}>
//                   {emp.resume ? "✅ Uploaded" : "❌ Missing"}
//                 </td>

//                 <td style={td}>
//                   {emp.status || "Active"}
//                 </td>

//                 <td style={td}>
//                   <button
//                     onClick={() =>
//                       (window.location.href = `/admin/documents/${emp.id}`)
//                     }
//                     style={{
//                       background: "#2563eb",
//                       color: "#fff",
//                       border: "none",
//                       padding: "10px 20px",
//                       borderRadius: 10,
//                       cursor: "pointer",
//                       fontWeight: 600,
//                     }}
//                   >
//                     View Documents
//                   </button>
//                 </td>
//               </tr>
//             ))}
//           </tbody>
//         </table>
        
//       </div>
//     </div>
//   );
// }

// const th = {
//   textAlign: "left",
//   padding: "18px",
//   fontSize: 18,
// };

// const td = {
//   padding: "18px",
//   fontSize: 17,
//   borderTop: "1px solid #eee",
// };