"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

import { db, storage } from "../../../../lib/firebase";

const DOCUMENT_TYPES = [
  { title: "📄 Resume", type: "resume" },
  { title: "✉️ Offer Letter", type: "offerLetter" },
  { title: "🖼 Passport", type: "passport" },
  { title: "💳 PAN Card", type: "pan" },
  { title: "🪪 Aadhaar Card", type: "aadhaar" },
  { title: "🏦 Cancelled Cheque", type: "bank" },
  { title: "💼 Experience Letter", type: "experienceLetter" },
  { title: "📄 Relieving Letter", type: "relievingLetter" },
  { title: "💰 Payslip", type: "salarySlip" },
  { title: "🏢 Office Compliance Document", type: "officeCompliance" },
  { title: "🎬 Script Documents", type: "scriptDocuments", multiple: true },
];

export default function EmployeeDocumentsPage() {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadingType, setUploadingType] = useState(null);
  const [downloadingKey, setDownloadingKey] = useState(null);

  useEffect(() => {
    loadEmployee();
  }, [id]);

  const loadEmployee = async () => {
    setLoading(true);
    const snap = await getDoc(doc(db, "users", id));
    if (snap.exists()) {
      setUser(snap.data());
    }
    setLoading(false);
  };

  const uploadDocument = async (type, file, multiple) => {
    if (!file) return;

    try {
      setUploadingType(type);

      const storageRef = ref(storage, `documents/${id}/${type}_${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      if (multiple) {
        const existing = user.documents?.[type] || [];
        await updateDoc(doc(db, "users", id), {
          [`documents.${type}`]: [...existing, { name: file.name, url }],
        });
      } else {
        await updateDoc(doc(db, "users", id), {
          [`documents.${type}`]: url,
        });
      }

      await loadEmployee();
    } catch (err) {
      console.error("UPLOAD ERROR:", err);
      alert("Upload Failed");
    } finally {
      setUploadingType(null);
    }
  };

  const handleDownload = async (url, fileName, key) => {
    if (!url) return;
    try {
      setDownloadingKey(key);
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
    } catch (err) {
      console.error("DOWNLOAD ERROR:", err);
      alert("Could not download file");
    } finally {
      setDownloadingKey(null);
    }
  };

  if (loading) {
    return <CenteredMessage text="Loading employee..." />;
  }

  if (!user) {
    return <CenteredMessage text="Employee not found." />;
  }

  const uploadedCount = DOCUMENT_TYPES.filter(({ type, multiple }) => {
    const data = user.documents?.[type];
    return multiple ? data?.length > 0 : Boolean(data);
  }).length;

  return (
    <div style={{ minHeight: "100vh", background: "#f5f7fb", padding: "36px 24px 60px" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        {/* BACK BUTTON */}
        <div style={{ marginBottom: 20 }}>
          <button
            onClick={() => (window.location.href = "/admin/documents")}
            style={{
              padding: "12px 22px",
              fontSize: 14,
              borderRadius: 10,
              border: "none",
              background: "#111827",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ← Dashboard
          </button>
        </div>

        {/* PROFILE HEADER CARD */}
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: 28,
            marginBottom: 28,
            boxShadow: "0 4px 16px rgba(0,0,0,.06)",
            display: "flex",
            alignItems: "center",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <img
            src={user.photoURL || "/profile.png"}
            alt="Profile"
            style={{
              width: 110,
              height: 110,
              borderRadius: "50%",
              objectFit: "cover",
              border: "4px solid #2563eb",
              flexShrink: 0,
            }}
          />

          <div style={{ flex: 1, minWidth: 200 }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", margin: 0 }}>
              {user.firstName} {user.lastName}
            </h1>
            <p style={{ color: "#64748b", fontSize: 15, margin: "6px 0 0" }}>
              {user.employeeId || "-"} &nbsp;•&nbsp; {user.department || "No department"}
            </p>
          </div>

          <div
            style={{
              background: "#eff6ff",
              borderRadius: 12,
              padding: "14px 22px",
              textAlign: "center",
              flexShrink: 0,
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 800, color: "#2563eb" }}>
              {uploadedCount}/{DOCUMENT_TYPES.length}
            </div>
            <div style={{ fontSize: 12.5, color: "#64748b", fontWeight: 600 }}>
              Documents Complete
            </div>
          </div>
        </div>

        {/* DOCUMENT LIST */}
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: "0 4px 16px rgba(0,0,0,.06)",
          }}
        >
          {DOCUMENT_TYPES.map(({ title, type, multiple }) => (
            <DocumentRow
              key={type}
              title={title}
              type={type}
              multiple={multiple}
              data={user.documents?.[type]}
              isUploading={uploadingType === type}
              downloadingKey={downloadingKey}
              onUpload={(file) => uploadDocument(type, file, multiple)}
              onDownload={handleDownload}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function DocumentRow({
  title,
  type,
  multiple,
  data,
  isUploading,
  downloadingKey,
  onUpload,
  onDownload,
}) {
  const hasData = multiple ? data?.length > 0 : Boolean(data);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "20px 24px",
        borderBottom: "1px solid #f1f5f9",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div style={{ minWidth: 180 }}>
        <h3 style={{ fontSize: 15.5, fontWeight: 700, color: "#0f172a", margin: 0 }}>
          {title}
        </h3>

        {hasData ? (
          <span style={{ color: "#16a34a", fontWeight: 600, fontSize: 13.5 }}>
            {multiple ? `${data.length} File${data.length > 1 ? "s" : ""} Uploaded` : "Uploaded"}
          </span>
        ) : (
          <span style={{ color: "#dc2626", fontWeight: 600, fontSize: 13.5 }}>
            Not Uploaded
          </span>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        {multiple &&
          data?.map((file, index) => {
            const key = `${type}-${index}`;
            return (
              <div key={key} style={{ display: "flex", gap: 8 }}>
                <a href={file.url} target="_blank" rel="noreferrer" style={btnStyle("#3d6fa8")}>
                  View {index + 1}
                </a>
                <button
                  onClick={() => onDownload(file.url, file.name, key)}
                  disabled={downloadingKey === key}
                  style={{ ...btnStyle("#16a34a"), border: "none", cursor: "pointer" }}
                >
                  {downloadingKey === key ? "..." : "Download"}
                </button>
              </div>
            );
          })}

        {!multiple && data && (
          <>
            <a href={data} target="_blank" rel="noreferrer" style={btnStyle("#3d6fa8")}>
              View
            </a>
            <button
              onClick={() => onDownload(data, `${type}`, type)}
              disabled={downloadingKey === type}
              style={{ ...btnStyle("#16a34a"), border: "none", cursor: "pointer" }}
            >
              {downloadingKey === type ? "..." : "Download"}
            </button>
          </>
        )}

        <label
          style={{
            ...btnStyle(isUploading ? "#fbbf24" : "#f59e0b"),
            cursor: isUploading ? "default" : "pointer",
          }}
        >
          {isUploading ? "Uploading..." : "Upload"}
          <input
            hidden
            type="file"
            disabled={isUploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
              e.target.value = "";
            }}
          />
        </label>
      </div>
    </div>
  );
}

function CenteredMessage({ text }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f5f7fb",
      }}
    >
      <h2 style={{ color: "#64748b", fontWeight: 600 }}>{text}</h2>
    </div>
  );
}

function btnStyle(bg) {
  return {
    background: bg,
    color: "#fff",
    padding: "9px 16px",
    borderRadius: 8,
    textDecoration: "none",
    fontWeight: 600,
    fontSize: 13.5,
  };
}



// "use client";

// import { useEffect, useState } from "react";
// import { useParams } from "next/navigation";
// import { doc, getDoc, updateDoc } from "firebase/firestore";
// import {
//   ref,
//   uploadBytes,
//   getDownloadURL,
// } from "firebase/storage";

// import { db, storage } from "../../../../lib/firebase";

// export default function EmployeeDocumentsPage() {
//   const { id } = useParams();
// const [documents,setDocuments]=useState([]);
//   const [user, setUser] = useState(null);

//   useEffect(() => {
//     loadEmployee();
//   }, []);

//   const loadEmployee = async () => {
//     const snap = await getDoc(doc(db, "users", id));

//     if (snap.exists()) {
//       setUser(snap.data());
//     }
//   };

//   if (!user) {
//     return <h2 style={{ padding: 40 }}>Loading...</h2>;
//   }

//   const uploadDocument = async (type, file) => {
//   if (!file) return;

//   try {
//     const storageRef = ref(
//       storage,
//       `documents/${id}/${type}_${file.name}`
//     );

//     await uploadBytes(storageRef, file);

//     const url = await getDownloadURL(storageRef);

//     if(type === "scriptDocuments"){

// const oldScripts =
// user.documents?.scriptDocuments || [];


// await updateDoc(
// doc(db,"users",id),
// {
// "documents.scriptDocuments":[
// ...oldScripts,
// {
// name:file.name,
// url:url
// }
// ]
// }
// );


// }
// else{


// await updateDoc(
// doc(db,"users",id),
// {
// [`documents.${type}`]:url
// }
// );


// }

//     loadEmployee();

//     alert(`${type} uploaded successfully`);
//   } catch (err) {
//     console.log(err);
//     alert("Upload Failed");
//   }
// };

// const DocumentRow = ({ title, type }) => {

// const isMultiple = type === "scriptDocuments";

// const documentData = user.documents?.[type];


// return (

// <div
// style={{
// display:"flex",
// justifyContent:"space-between",
// alignItems:"center",
// padding:"20px",
// borderBottom:"1px solid #eee",
// }}
// >

// <div>

// <h3>{title}</h3>


// {
// isMultiple ? (

// documentData?.length > 0 ?

// <span
// style={{
// color:"#16a34a",
// fontWeight:600
// }}
// >
// {documentData.length} Files Uploaded
// </span>

// :

// <span style={{color:"#dc2626"}}>
// Not Uploaded
// </span>


// )

// :

// documentData ?

// <span
// style={{
// color:"#16a34a",
// fontWeight:600
// }}
// >
// Uploaded
// </span>

// :

// <span style={{color:"#dc2626"}}>
// Not Uploaded
// </span>

// }


// </div>



// <div
// style={{
// display:"flex",
// gap:"12px",
// alignItems:"center"
// }}
// >


// {
// isMultiple && documentData?.map((file,index)=>(

// <div key={index}>

// <a
// href={file.url}
// target="_blank"
// style={blueBtn}
// >
// View {index+1}
// </a>


// <a
// href={file.url}
// download
// style={greenBtn}
// >
// Download
// </a>

// </div>

// ))

// }



// {
// !isMultiple && documentData && (

// <>

// <a
// href={documentData}
// target="_blank"
// style={blueBtn}
// >
// View
// </a>


// <a
// href={documentData}
// download
// style={greenBtn}
// >
// Download
// </a>

// </>

// )

// }



// <label style={orangeBtn}>

// Upload

// <input
// hidden
// type="file"
// onChange={(e)=>
// uploadDocument(type,e.target.files[0])
// }
// />

// </label>


// </div>


// </div>

// )

// }

// return (
// <div
//   style={{
//     width: "96%",
//     maxWidth: "1700px",
//     margin: "40px auto",
//   }}
// >
//     <div
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
//     {/* <div
//       style={{
//         display: "flex",
//         gap: "25px",
//         alignItems: "center",
//         marginBottom: "30px",
//       }}
//     > */}
//       <img
//         src={user.photoURL || "/profile.png"}
//         style={{
//           width: 140,
//           height: 140,
//           borderRadius: "50%",
//           objectFit: "cover",
//           border: "5px solid #2563eb",
//         }}
//       />

// <button
// onClick={()=>window.location.href="/admin/documents"}
// style={{
// padding:"15px 28px",
// fontSize:"16px",
// borderRadius:12,
// border:"none",
// background:"#111827",
// color:"#fff",
// fontWeight:700,
// cursor:"pointer",
// whiteSpace:"nowrap",
// marginLeft:"auto",
// }}
// >
// ← Dashboard
// </button>


//       <div>
//         <h1>
//           {user.firstName} {user.lastName}
//         </h1>

//         <h3>{user.employeeId}</h3>

//         <p>{user.department}</p>
//       </div>
//     </div>

//     <div
//       style={{
//         background: "#fff",
//         borderRadius: 15,
//         overflow: "hidden",
//         boxShadow:
//           "0 5px 20px rgba(0,0,0,.08)",
//       }}
//     >
//       <DocumentRow
//         title="📄 Resume"
//         type="resume"
//       />

      
// <DocumentRow
//  title="✉️ Offer Letter"
//  type="offerLetter"
// />

//       <DocumentRow
//         title="🖼 Passport"
//         type="passport"
//       />

//       <DocumentRow
//         title="💳 PAN Card"
//         type="pan"
//       />

//       <DocumentRow
//         title="🪪 Aadhaar Card"
//         type="aadhaar"
//       />

//       <DocumentRow
//         title="🏦 Cancelled Cheque"
//         type="bank"
//       />


//       <DocumentRow
//         title="💼 Experience Letter"
//         type="experienceLetter"
//       />

//       <DocumentRow
//         title="📄 Relieving Letter"
//         type="relievingLetter"
//       />
//       <DocumentRow
//  title="💰 Payslip"
//  type="salarySlip"
// />



// <DocumentRow
//  title="🏢 Office Compliance Document"
//  type="officeCompliance"
// />
//     </div>
//   </div>
// );
// }

// const blueBtn = {
//   background: "#3d6fa8",
//   color: "#fff",
//   padding: "10px 18px",
//   borderRadius: 8,
//   textDecoration: "none",
// };

// const greenBtn = {
//   background: "#16a34a",
//   color: "#fff",
//   padding: "10px 18px",
//   borderRadius: 8,
//   textDecoration: "none",
// };

// const orangeBtn = {
//   background: "#f59e0b",
//   color: "#fff",
//   padding: "10px 18px",
//   borderRadius: 8,
//   cursor: "pointer",
// };