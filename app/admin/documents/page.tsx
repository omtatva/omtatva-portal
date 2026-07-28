"use client";

import { useEffect, useState } from "react";

import {
  collection,
  getDocs,
  addDoc,
  query,
  where,
} from "firebase/firestore";

import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

import { db, storage } from "../../../lib/firebase";

type Employee = {
  id: string;
  firstName?: string;
  lastName?: string;
  employeeId?: string;
  department?: string;
  resume?: string;
  status?: string;
};

type CommonDoc = {
  id: string;
  fileName?: string;
  url?: string;
  uploadedAt?: any;
  category?: string;
};

const CATEGORY_OPTIONS = [
  { key: "Payroll", label: "💰 Payroll" },
  { key: "Creative Script", label: "🎬 Script Documents" },
  { key: "Office Documents", label: "🏢 Office Documents" },
  { key: "Offer Letter", label: "✉️ Offer Letter" },
];

export default function DocumentsPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [commonDocs, setCommonDocs] = useState<CommonDoc[]>([]);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState(CATEGORY_OPTIONS[2].key);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    loadEmployees();
    loadCommonDocs();
  }, []);

  const loadEmployees = async () => {
    const snapshot = await getDocs(collection(db, "users"));

    const list = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Employee[];

    setEmployees(list);
  };

  const loadCommonDocs = async () => {
    const q = query(
      collection(db, "documents"),
      where("employeeEmail", "==", "all")
    );
    const snapshot = await getDocs(q);

    const list = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as CommonDoc[];

    setCommonDocs(list);
  };

  const uploadCommonDocument = async (file?: File) => {
    if (!file) {
      alert("Please select a file");
      return;
    }

    try {
      setUploading(true);

      const storageRef = ref(
        storage,
        `commonDocuments/${Date.now()}_${file.name}`
      );

      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      await addDoc(collection(db, "documents"), {
        fileName: file.name,
        url: url,
        uploadedAt: new Date(),
        uploadedBy: "HR",
        employeeEmail: "all",
        category: uploadCategory,
      });

      await loadCommonDocs();
    } catch (error: any) {
      console.error("UPLOAD ERROR:", error);
      alert(error.message || "Upload Failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (url?: string, fileName?: string, id?: string) => {
    if (!url) return;
    try {
      setDownloadingId(id || null);
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName || "document";
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("DOWNLOAD ERROR:", error);
      alert("Could not download file");
    } finally {
      setDownloadingId(null);
    }
  };

  const filtered = employees.filter((emp) => {
    const keyword = search.toLowerCase();

    return (
      (emp.firstName || "").toLowerCase().includes(keyword) ||
      (emp.lastName || "").toLowerCase().includes(keyword) ||
      (emp.employeeId || "").toLowerCase().includes(keyword)
    );
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f7fb",
        padding: "40px 24px 60px",
      }}
    >
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        {/* HEADER */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
            marginBottom: 32,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 38,
                fontWeight: 800,
                margin: 0,
                color: "#0f172a",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              📁 Employee Documents
            </h1>
            <p style={{ color: "#64748b", fontSize: 16, marginTop: 6 }}>
              Manage employee documents and HR files.
            </p>
          </div>

          <button
            onClick={() => (window.location.href = "/admin")}
            style={{
              padding: "13px 24px",
              background: "#3d6fa8",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 14.5,
              cursor: "pointer",
            }}
          >
            ← Dashboard
          </button>
        </div>

        {/* COMMON DOCUMENTS */}
        <div
          style={{
            background: "#fff",
            padding: 28,
            borderRadius: 16,
            marginBottom: 32,
            boxShadow: "0 4px 16px rgba(0,0,0,.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 16,
              marginBottom: 22,
            }}
          >
            <h2
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: "#0f172a",
                margin: 0,
              }}
            >
              📂 Common Documents
            </h2>

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <select
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value)}
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#334155",
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>

              <label
                style={{
                  display: "inline-block",
                  background: uploading ? "#93c5fd" : "#2563eb",
                  color: "#fff",
                  padding: "12px 22px",
                  borderRadius: 10,
                  cursor: uploading ? "default" : "pointer",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                {uploading ? "Uploading..." : "+ Upload Document"}
                <input
                  type="file"
                  disabled={uploading}
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadCommonDocument(file);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>

          {commonDocs.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "36px 0",
                color: "#94a3b8",
                fontSize: 14.5,
              }}
            >
              No common documents uploaded yet.
            </div>
          ) : (
            <div>
              {commonDocs.map((file) => (
                <div
                  key={file.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "16px 4px",
                    borderBottom: "1px solid #f1f5f9",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 9,
                        background: "#eff6ff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 18,
                        flexShrink: 0,
                      }}
                    >
                      📄
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 15,
                          color: "#0f172a",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: 420,
                        }}
                        title={file.fileName}
                      >
                        {file.fileName}
                      </div>
                      {file.category && (
                        <div style={{ fontSize: 12.5, color: "#94a3b8", marginTop: 2 }}>
                          {file.category}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 18, flexShrink: 0 }}>
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "#2563eb", fontWeight: 600, fontSize: 14 }}
                    >
                      View
                    </a>

                    <button
                      onClick={() => handleDownload(file.url, file.fileName, file.id)}
                      disabled={downloadingId === file.id}
                      style={{
                        color: "#16a34a",
                        fontWeight: 600,
                        fontSize: 14,
                        background: "none",
                        border: "none",
                        cursor: downloadingId === file.id ? "default" : "pointer",
                        padding: 0,
                      }}
                    >
                      {downloadingId === file.id ? "Downloading..." : "Download"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SEARCH */}
        <input
          placeholder="🔍 Search Employee..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            padding: "15px 18px",
            fontSize: 15.5,
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            marginBottom: 24,
            background: "#fff",
            outline: "none",
            boxSizing: "border-box",
          }}
        />

        {/* EMPLOYEE TABLE */}
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: "0 4px 16px rgba(0,0,0,.06)",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <th style={th}>Employee</th>
                <th style={th}>Employee ID</th>
                <th style={th}>Department</th>
                <th style={th}>Resume</th>
                <th style={th}>Status</th>
                <th style={th}>Action</th>
              </tr>
            </thead>

            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ ...td, textAlign: "center", color: "#94a3b8" }}>
                    No employees found.
                  </td>
                </tr>
              ) : (
                filtered.map((emp) => (
                  <tr key={emp.id}>
                    <td style={td}>
                      {emp.firstName} {emp.lastName}
                    </td>
                    <td style={td}>{emp.employeeId || "-"}</td>
                    <td style={td}>{emp.department || "-"}</td>
                    <td style={td}>
                      {emp.resume ? (
                        <span style={{ color: "#16a34a", fontWeight: 600 }}>✅ Uploaded</span>
                      ) : (
                        <span style={{ color: "#dc2626", fontWeight: 600 }}>❌ Missing</span>
                      )}
                    </td>
                    <td style={td}>
                      <span
                        style={{
                          padding: "5px 12px",
                          borderRadius: 999,
                          fontSize: 12.5,
                          fontWeight: 700,
                          background:
                            (emp.status || "Active").toLowerCase() === "active"
                              ? "#dcfce7"
                              : "#fee2e2",
                          color:
                            (emp.status || "Active").toLowerCase() === "active"
                              ? "#166534"
                              : "#991b1b",
                        }}
                      >
                        {emp.status || "Active"}
                      </span>
                    </td>
                    <td style={td}>
                      <button
                        onClick={() => {
                          window.location.href = `/admin/documents/${emp.id}`;
                        }}
                        style={{
                          background: "#3d6fa8",
                          color: "#fff",
                          border: "none",
                          padding: "10px 20px",
                          borderRadius: 10,
                          cursor: "pointer",
                          fontWeight: 600,
                          fontSize: 13.5,
                        }}
                      >
                        View Documents
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "16px 18px",
  fontSize: 14,
  fontWeight: 700,
  color: "#475569",
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

const td: React.CSSProperties = {
  padding: "16px 18px",
  fontSize: 15,
  borderTop: "1px solid #f1f5f9",
  color: "#1e293b",
};



// "use client";

// import { useEffect, useState } from "react";

// import {
//   collection,
//   getDocs,
//   addDoc,
// } from "firebase/firestore";

// import {
//   ref,
//   uploadBytes,
//   getDownloadURL,
// } from "firebase/storage";

// import { db, storage } from "../../../lib/firebase";


// export default function DocumentsPage() {

//   const [employees,setEmployees] = useState<any[]>([]);
//   const [commonDocs,setCommonDocs] = useState<any[]>([]);
//   const [search,setSearch] = useState("");
// const [uploading,setUploading] = useState(false);

//   useEffect(()=>{

//     loadEmployees();
//     loadCommonDocs();

//   },[]);



//   const loadEmployees = async()=>{

//     const snapshot = await getDocs(
//       collection(db,"users")
//     );


//     const list = snapshot.docs.map((doc)=>({

//       id:doc.id,
//       ...doc.data()

//     }));


//     setEmployees(list);

//   };




//   const loadCommonDocs = async()=>{

//     const snapshot = await getDocs(
//       collection(db,"commonDocuments")
//     );


//     const list = snapshot.docs.map((doc)=>({

//       id:doc.id,
//       ...doc.data()

//     }));


//     setCommonDocs(list);

//   };


// const uploadCommonDocument = async (file?: File) => {
//   if (!file) {
//     alert("Please select file");
//     return;
//   }

//   try {
//     setUploading(true);

//     const storageRef = ref(
//       storage,
//       `commonDocuments/${Date.now()}_${file.name}`
//     );

//     await uploadBytes(storageRef, file);
//     const url = await getDownloadURL(storageRef);

//     // Write to the SAME collection the employee page reads from
//     await addDoc(collection(db, "documents"), {
//       fileName: file.name,
//       url: url,
//       uploadedAt: new Date(),
//       uploadedBy: "HR",
//       employeeEmail: "all",           // <-- visible to every employee
//       category: "Script Documents",   // <-- pick whichever section it should land in
//     });

//     alert("✅ Upload Complete");
//     loadCommonDocs();
//   } catch (error: any) {
//     console.error("UPLOAD ERROR:", error);
//     alert(error.message || "Upload Failed");
//   } finally {
//     setUploading(false);
//   }
// };



//   const filtered =
//   employees.filter((emp)=>{


//     const keyword =
//     search.toLowerCase();



//     return (

//       (emp.firstName || "")
//       .toLowerCase()
//       .includes(keyword)


//       ||

//       (emp.lastName || "")
//       .toLowerCase()
//       .includes(keyword)


//       ||

//       (emp.employeeId || "")
//       .toLowerCase()
//       .includes(keyword)

//     );


//   });




// return (

// <div

// style={{

// width:"96%",
// maxWidth:"1700px",
// margin:"40px auto"

// }}

// >



// {/* HEADER */}

// <div

// style={{

// display:"flex",
// justifyContent:"space-between",
// alignItems:"center",
// marginBottom:35

// }}

// >


// <div>


// <h1

// style={{

// fontSize:46,
// fontWeight:800,
// margin:0

// }}

// >

// 📁 Employee Documents

// </h1>


// <p

// style={{

// color:"#64748b",
// fontSize:18

// }}

// >

// Manage employee documents and HR files.

// </p>


// </div>




// <button

// onClick={()=>
// window.location.href="/admin"
// }

// style={{

// padding:"15px 28px",
// background:"#3d6fa8",
// color:"#fff",
// border:"none",
// borderRadius:12,
// fontWeight:700,
// cursor:"pointer"

// }}

// >

// ← Dashboard

// </button>



// </div>






// {/* COMMON DOCUMENTS */}


// <div

// style={{

// background:"#fff",
// padding:25,
// borderRadius:15,
// marginBottom:35,
// boxShadow:"0 5px 20px rgba(0,0,0,.08)"

// }}

// >


// <h2>

// 📂 Common Documents

// </h2>



// <label

// style={{

// display:"inline-block",
// background:"#2563eb",
// color:"#fff",
// padding:"12px 22px",
// borderRadius:10,
// cursor:"pointer",
// fontWeight:600

// }}

// >

// {uploading 
// ? "Uploading..."
// : "+ Upload Document"
// }


// <input

// type="file"

// style={{
// display:"none"
// }}

// onChange={(e) => {

// const file = e.target.files?.[0];

// if(file){
//   uploadCommonDocument(file);
// }

// }}


// />


// </label>





// <div

// style={{

// marginTop:25

// }}

// >


// {

// commonDocs.map((file)=>(


// <div

// key={file.id}

// style={{

// display:"flex",
// justifyContent:"space-between",
// alignItems:"center",
// padding:"12px 0",
// borderBottom:"1px solid #eee"

// }}

// >


// <span>

// 📄 {file.name}

// </span>



// <a

// href={file.url}

// target="_blank"

// style={{

// color:"#3d6fa8",
// fontWeight:600

// }}

// >

// View

// </a>


    
//       href={file.url}
//       download={file.name}
//       style={{
//         color:"#16a34a",
//         fontWeight:600
//       }}
//     <a>
//       Download
//     </a>
//   </div>
// // </div>



// ))


// }


// </div>


// </div>








// {/* SEARCH */}


// <input

// placeholder="Search Employee..."

// value={search}

// onChange={(e)=>
// setSearch(e.target.value)
// }


// style={{

// width:"100%",
// padding:"16px",
// fontSize:18,
// borderRadius:12,
// border:"1px solid #d1d5db",
// marginBottom:25

// }}

// />







// {/* EMPLOYEE TABLE */}


// <div

// style={{

// background:"#fff",
// borderRadius:15,
// overflow:"hidden",
// boxShadow:"0 5px 20px rgba(0,0,0,.08)"

// }}

// >


// <table

// style={{

// width:"100%",
// borderCollapse:"collapse"

// }}

// >


// <thead>

// <tr
// style={{
// background:"#f8fafc"
// }}
// >

// <th style={th}>
// Employee
// </th>

// <th style={th}>
// Employee ID
// </th>

// <th style={th}>
// Department
// </th>

// <th style={th}>
// Resume
// </th>

// <th style={th}>
// Status
// </th>

// <th style={th}>
// Action
// </th>

// </tr>

// </thead>





// <tbody>


// {

// filtered.map((emp)=>(


// <tr key={emp.id}>


// <td style={td}>

// {emp.firstName} {emp.lastName}

// </td>


// <td style={td}>

// {emp.employeeId || "-"}

// </td>


// <td style={td}>

// {emp.department || "-"}

// </td>


// <td style={td}>

// {emp.resume ? "✅ Uploaded":"❌ Missing"}

// </td>


// <td style={td}>

// {emp.status || "Active"}

// </td>


// <td style={td}>


// <button

// onClick={()=>{

// window.location.href =
// `/admin/documents/${emp.id}`

// }}


// style={{

// background:"#2563eb",
// color:"#fff",
// border:"none",
// padding:"10px 20px",
// borderRadius:10,
// cursor:"pointer",
// fontWeight:600

// }}

// >

// View Documents

// </button>


// </td>


// </tr>


// ))


// }


// </tbody>


// </table>


// </div>



// </div>

// );


// }



// const th: React.CSSProperties = {

// textAlign:"left",
// padding:"18px",
// fontSize:"18px"

// };


// const td: React.CSSProperties = {

// padding:"18px",
// fontSize:"17px",
// borderTop:"1px solid #eee"

// };




// // "use client";

// // import { useEffect, useState } from "react";
// // import { collection, getDocs } from "firebase/firestore";
// // import { db } from "../../../lib/firebase";

// // export default function DocumentsPage() {
// //   const [employees, setEmployees] = useState([]);
// //   const [search, setSearch] = useState("");

// //   useEffect(() => {
// //     loadEmployees();
// //   }, []);

// //   const loadEmployees = async () => {
// //     const snapshot = await getDocs(collection(db, "users"));

// //     const list = snapshot.docs.map((doc) => ({
// //       id: doc.id,
// //       ...doc.data(),
// //     }));

// //     setEmployees(list);
// //   };

// //   const filtered = employees.filter((emp) => {
// //     const keyword = search.toLowerCase();

// //     return (
// //       (emp.firstName || "").toLowerCase().includes(keyword) ||
// //       (emp.lastName || "").toLowerCase().includes(keyword) ||
// //       (emp.employeeId || "").toLowerCase().includes(keyword)
// //     );
// //   });

// // return (
// // <div
// //   style={{
// //     width: "96%",
// //     maxWidth: "1700px",
// //     margin: "40px auto",
// //   }}
// // >


// // {/* Header */}

// // <div
// //   style={{
// //     width:"100%",
// //     display:"flex",
// //     justifyContent:"space-between",
// //     alignItems:"center",
// //     marginBottom:"35px",
// //     flexWrap:"wrap",
// //     gap:"20px",
// //   }}
// // >


// // <div>

// // <h1
// // style={{
// // fontSize:46,
// // fontWeight:800,
// // margin:0,
// // color:"#111"
// // }}
// // >
// // 📁 Employee Documents
// // </h1>


// // <p
// // style={{
// // marginTop:10,
// // color:"#64748b",
// // fontSize:18
// // }}
// // >
// // Manage employee documents and upload HR files.
// // </p>


// // </div>



// // <button
// // onClick={()=>window.location.href="/admin"}
// // style={{
// // padding:"15px 28px",
// // fontSize:"16px",
// // borderRadius:12,
// // border:"none",
// // background:"#3d6fa8",
// // color:"#fff",
// // fontWeight:700,
// // cursor:"pointer",
// // whiteSpace:"nowrap",
// // }}
// // >
// // ← Dashboard
// // </button>



// // </div>

// //       <input
// //         placeholder="Search Employee..."
// //         value={search}
// //         onChange={(e) => setSearch(e.target.value)}
// //         style={{
// //           width: "100%",
// //           padding: "16px",
// //           fontSize: 18,
// //           borderRadius: 12,
// //           border: "1px solid #d1d5db",
// //           marginBottom: 25,
// //         }}
// //       />

// //       <div
// //         style={{
// //           background: "#fff",
// //           borderRadius: 15,
// //           overflow: "hidden",
// //           boxShadow: "0 5px 20px rgba(0,0,0,.08)",
// //         }}
// //       >
// //         <table
// //           style={{
// //             width: "100%",
// //             borderCollapse: "collapse",
// //           }}
// //         >
// //           <thead>
// //             <tr
// //               style={{
// //                 background: "#f8fafc",
// //               }}
// //             >
// //               <th style={th}>Employee</th>
// //               <th style={th}>Employee ID</th>
// //               <th style={th}>Department</th>
// //               <th style={th}>Resume</th>
// //               <th style={th}>Status</th>
// //               <th style={th}>Action</th>
// //             </tr>
// //           </thead>

// //           <tbody>
// //             {filtered.map((emp) => (
// //               <tr key={emp.id}>
// //                 <td style={td}>
// //                   {emp.firstName} {emp.lastName}
// //                 </td>

// //                 <td style={td}>
// //                   {emp.employeeId || "-"}
// //                 </td>

// //                 <td style={td}>
// //                   {emp.department || "-"}
// //                 </td>

// //                 <td style={td}>
// //                   {emp.resume ? "✅ Uploaded" : "❌ Missing"}
// //                 </td>

// //                 <td style={td}>
// //                   {emp.status || "Active"}
// //                 </td>

// //                 <td style={td}>
// //                   <button
// //                     onClick={() =>
// //                       (window.location.href = `/admin/documents/${emp.id}`)
// //                     }
// //                     style={{
// //                       background: "#2563eb",
// //                       color: "#fff",
// //                       border: "none",
// //                       padding: "10px 20px",
// //                       borderRadius: 10,
// //                       cursor: "pointer",
// //                       fontWeight: 600,
// //                     }}
// //                   >
// //                     View Documents
// //                   </button>
// //                 </td>
// //               </tr>
// //             ))}
// //           </tbody>
// //         </table>
        
// //       </div>
// //     </div>
// //   );
// // }

// // const th = {
// //   textAlign: "left",
// //   padding: "18px",
// //   fontSize: 18,
// // };

// // const td = {
// //   padding: "18px",
// //   fontSize: 17,
// //   borderTop: "1px solid #eee",
// // };