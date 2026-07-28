"use client";

import { useEffect, useState } from "react";
import { auth, db } from "../../lib/firebase";

import {
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";

type DocItem = {
  id: string;
  fileName?: string;
  title?: string;
  url?: string;
  uploadedBy?: string;
  uploadedAt?: any;
  category?: string;
};

const CATEGORY_CONFIG = [
  { key: "Payroll", label: "Payroll Documents", icon: "💰", color: "#059669" },
  { key: "Creative Script", label: "Script Documents", icon: "🎬", color: "#7c3aed" },
  { key: "Office Documents", label: "Office Documents", icon: "🏢", color: "#2563eb" },
  { key: "Offer Letter", label: "Offer Letter", icon: "✉️", color: "#d97706" },
];

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | undefined;

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (!user) {
        setLoading(false);
        return;
      }

      const q = query(
        collection(db, "documents"),
        where("employeeEmail", "in", [user.email, "all"])
      );

      unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
        const list = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as DocItem[];

        setDocuments(list);
        setLoading(false);
      });
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  const filteredDocs = documents.filter((d) => {
    const name = (d.fileName || d.title || "").toLowerCase();
    const matchesSearch = name.includes(search.toLowerCase());
    const matchesCategory =
      activeCategory === "All" || d.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const totalCount = documents.length;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f7fb",
        padding: "32px 24px 60px",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* HEADER */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            flexWrap: "wrap",
            gap: 16,
            marginBottom: 28,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 34,
                fontWeight: 800,
                color: "#0f172a",
                margin: 0,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              📁 My Documents
            </h1>
            <p style={{ color: "#64748b", fontSize: 15, marginTop: 6 }}>
              All your payroll, offer letters, and company files in one place.
            </p>
          </div>

          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: "10px 18px",
              boxShadow: "0 2px 10px rgba(0,0,0,.06)",
              fontSize: 14,
              color: "#475569",
              fontWeight: 600,
            }}
          >
            {totalCount} document{totalCount !== 1 ? "s" : ""} total
          </div>
        </div>

        {/* SEARCH + FILTER BAR */}
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 24,
          }}
        >
          <input
            placeholder="🔍 Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: "1 1 260px",
              padding: "13px 16px",
              fontSize: 15,
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              outline: "none",
              background: "#fff",
            }}
          />

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <FilterPill
              label="All"
              active={activeCategory === "All"}
              onClick={() => setActiveCategory("All")}
            />
            {CATEGORY_CONFIG.map((c) => (
              <FilterPill
                key={c.key}
                label={`${c.icon} ${c.label}`}
                active={activeCategory === c.key}
                onClick={() => setActiveCategory(c.key)}
              />
            ))}
          </div>
        </div>

        {/* CONTENT */}
        {loading ? (
          <EmptyState icon="⏳" text="Loading your documents..." />
        ) : filteredDocs.length === 0 ? (
          <EmptyState
            icon="📭"
            text={
              search
                ? "No documents match your search."
                : "No documents available yet."
            }
          />
        ) : activeCategory !== "All" ? (
          <DocumentGrid docs={filteredDocs} />
        ) : (
          CATEGORY_CONFIG.map((c) => {
            const docsInCategory = filteredDocs.filter(
              (d) => d.category === c.key
            );
            if (docsInCategory.length === 0) return null;
            return (
              <DocumentSection
                key={c.key}
                title={`${c.icon} ${c.label}`}
                color={c.color}
                docs={docsInCategory}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 16px",
        borderRadius: 999,
        border: active ? "1px solid #2563eb" : "1px solid #e2e8f0",
        background: active ? "#2563eb" : "#fff",
        color: active ? "#fff" : "#475569",
        fontWeight: 600,
        fontSize: 13.5,
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "all .15s ease",
      }}
    >
      {label}
    </button>
  );
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 16,
        padding: "60px 20px",
        textAlign: "center",
        boxShadow: "0 4px 16px rgba(0,0,0,.05)",
      }}
    >
      <div style={{ fontSize: 42, marginBottom: 10 }}>{icon}</div>
      <p style={{ color: "#64748b", fontSize: 15, margin: 0 }}>{text}</p>
    </div>
  );
}

function DocumentSection({
  title,
  color,
  docs,
}: {
  title: string;
  color: string;
  docs: DocItem[];
}) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2
        style={{
          fontSize: 18,
          fontWeight: 800,
          color,
          marginBottom: 14,
        }}
      >
        {title}
        <span
          style={{
            marginLeft: 10,
            fontSize: 12,
            fontWeight: 700,
            color: "#94a3b8",
            background: "#f1f5f9",
            padding: "2px 9px",
            borderRadius: 999,
          }}
        >
          {docs.length}
        </span>
      </h2>
      <DocumentGrid docs={docs} />
    </div>
  );
}

function DocumentGrid({ docs }: { docs: DocItem[] }) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 16,
        boxShadow: "0 4px 16px rgba(0,0,0,.05)",
        overflow: "hidden",
      }}
    >
      {docs.map((item, i) => (
        <div
          key={item.id}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "18px 22px",
            borderBottom:
              i === docs.length - 1 ? "none" : "1px solid #f1f5f9",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              minWidth: 0,
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: "#eff6ff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
                flexShrink: 0,
              }}
            >
              {getFileIcon(item.fileName || item.title || "")}
            </div>

            <div style={{ minWidth: 0 }}>
              <h3
                style={{
                  fontSize: 15.5,
                  fontWeight: 700,
                  color: "#0f172a",
                  margin: 0,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: 420,
                }}
                title={item.fileName || item.title}
              >
                {item.fileName || item.title}
              </h3>
              <p style={{ fontSize: 13, color: "#94a3b8", margin: "3px 0 0" }}>
                Uploaded by {item.uploadedBy || "HR"}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <a href={item.url} target="_blank" rel="noreferrer" style={viewBtn}>
              👁 View
            </a>
            <a href={item.url} download style={downloadBtn}>
              ⬇ Download
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}

function getFileIcon(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return "📕";
    case "doc":
    case "docx":
      return "📘";
    case "xls":
    case "xlsx":
    case "csv":
      return "📗";
    case "png":
    case "jpg":
    case "jpeg":
      return "🖼️";
    default:
      return "📄";
  }
}

const viewBtn: React.CSSProperties = {
  background: "#2563eb",
  color: "#fff",
  padding: "9px 16px",
  borderRadius: 8,
  textDecoration: "none",
  fontWeight: 600,
  fontSize: 13.5,
};

const downloadBtn: React.CSSProperties = {
  background: "#16a34a",
  color: "#fff",
  padding: "9px 16px",
  borderRadius: 8,
  textDecoration: "none",
  fontWeight: 600,
  fontSize: 13.5,
};



// "use client";

// import { useEffect, useState } from "react";
// import { auth, db } from "../../lib/firebase";

// import {
// collection,
// query,
// where,
// onSnapshot
// } from "firebase/firestore";


// export default function DocumentsPage(){

// const [documents,setDocuments] = useState([]);


// useEffect(()=>{

// const unsubscribeAuth = auth.onAuthStateChanged((user)=>{

// if(!user) return;


// const q=query(
// collection(db,"documents"),
// where(
// "employeeEmail",
// "==",
// user.email
// )
// );


// const unsubscribe = onSnapshot(q,(snapshot)=>{


// const list=snapshot.docs.map(doc=>({

// id:doc.id,
// ...doc.data()

// }));


// setDocuments(list);


// });


// return ()=>unsubscribe();


// });


// return ()=>unsubscribeAuth();


// },[]);



// const payroll = documents.filter(
// d=>d.category==="Payroll"
// );


// const creative = documents.filter(
// d=>d.category==="Creative Script"
// );


// const office = documents.filter(
// d=>d.category==="Office Documents"
// );


// const offer = documents.filter(
// d=>d.category==="Offer Letter"
// );



// return(

// <div
// style={{
// padding:"25px",
// background:"#f5f7fb",
// minHeight:"100vh"
// }}
// >


// <h1
// style={{
// fontSize:"36px",
// fontWeight:"800",
// color:"#1e3a8a"
// }}
// >
// 📁 My Documents
// </h1>



// <DocumentSection
// title="💰 Payroll Documents"
// data={payroll}
// />



// <DocumentSection
// title="🎬 Script Documents"
// data={creative}
// />



// <DocumentSection
// title="🏢 Office Complete Documents"
// data={office}
// />



// <DocumentSection
// title="✉ Offer Letter"
// data={offer}
// />



// </div>

// )

// }




// function DocumentSection({
// title,
// data=[]
// }){


// return(

// <div
// style={{
// background:"#fff",
// padding:"25px",
// borderRadius:"20px",
// marginBottom:"25px",
// boxShadow:"0 10px 25px rgba(0,0,0,.08)"
// }}
// >


// <h2
// style={{
// fontSize:"24px",
// fontWeight:800,
// marginBottom:"20px"
// }}
// >

// {title}

// </h2>



// {
// data.length===0 ?

// <p>
// No Documents Available
// </p>


// :


// data.map(item=>(

// <div
// key={item.id}
// style={{
// display:"flex",
// justifyContent:"space-between",
// alignItems:"center",
// padding:"15px",
// borderBottom:"1px solid #eee"
// }}
// >


// <div>

// <h3>
// {item.fileName || item.title}
// </h3>


// <p>
// Uploaded By: {item.uploadedBy || "HR"}
// </p>

// </div>



// <div
// style={{
// display:"flex",
// gap:"10px"
// }}
// >


// <a
// href={item.url}
// target="_blank"
// style={viewBtn}
// >
// 👁 View
// </a>



// <a
// href={item.url}
// download
// style={downloadBtn}
// >
// ⬇ Download
// </a>


// </div>


// </div>


// ))


// }


// </div>

// )

// }




// const viewBtn={

// background:"#2563eb",
// color:"#fff",
// padding:"10px 18px",
// borderRadius:"8px",
// textDecoration:"none",
// fontWeight:"600"

// };


// const downloadBtn={

// background:"#16a34a",
// color:"#fff",
// padding:"10px 18px",
// borderRadius:"8px",
// textDecoration:"none",
// fontWeight:"600"

// };