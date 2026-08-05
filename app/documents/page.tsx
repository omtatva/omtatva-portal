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
  { key: "Office Documents", label: "Office Documents", icon: "🏢", color: "#3d6fa8" },
  { key: "Offer Letter", label: "Offer Letter", icon: "✉️", color: "#d97706" },
];

// The onboarding section isn't backed by the `documents` collection
// like the ones above — it's rendered separately from `employeeDocuments`
// (see loadOnboardingDocs below) — but it still needs an entry here so
// it shows up as a filter pill alongside the rest.
const ONBOARDING_CATEGORY = {
  key: "Onboarding",
  label: "Onboarding Documents",
  icon: "📋",
  color: "#0891b2",
};

function getViewUrl(file: DocItem) {
  const name = file.fileName?.toLowerCase() || "";

  if (
    name.endsWith(".pdf") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".png")
  ) {
    return file.url || "";
  }

  if (
    name.endsWith(".doc") ||
    name.endsWith(".docx") ||
    name.endsWith(".xls") ||
    name.endsWith(".xlsx") ||
    name.endsWith(".ppt") ||
    name.endsWith(".pptx")
  ) {
    return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(file.url || "")}`;
  }

  return `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(file.url || "")}`;
}

// Document-type keys from DocumentUpload.tsx mapped to a readable label
// for display in this list.
const ONBOARDING_TYPE_LABELS: Record<string, string> = {
  photo: "Profile Photo",
  aadhaar: "Aadhaar Card",
  pan: "PAN Card",
  resume: "Resume",
  education: "Education Certificate",
  experience: "Experience Letter",
  cheque: "Cancelled Cheque",
  offer: "Offer Letter",
  other: "Other Document",
};

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocItem[]>([]);
  const [onboardingDocs, setOnboardingDocs] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  useEffect(() => {
    let unsubscribeDocsSnapshot: (() => void) | undefined;
    let unsubscribeOnboardingSnapshot: (() => void) | undefined;

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (!user) {
        window.location.href = "/login";
        return;
      }

      setCheckingAuth(false);

      // Existing HR-posted documents
      const q = query(
        collection(db, "documents"),
        where("employeeEmail", "in", [user.email, "all"])
      );

      unsubscribeDocsSnapshot = onSnapshot(q, (snapshot) => {
        const list = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as DocItem[];

        setDocuments(list);
        setLoading(false);
      });

      // Onboarding documents — from the same `employeeDocuments`
      // collection DocumentUpload.tsx writes to.
      const onboardingQuery = query(
        collection(db, "employeeDocuments"),
        where("employeeId", "==", user.uid)
      );

      unsubscribeOnboardingSnapshot = onSnapshot(onboardingQuery, (snapshot) => {
        const list: DocItem[] = [];

        snapshot.docs.forEach((docSnap) => {
          const d = docSnap.data() as any;
          const label = ONBOARDING_TYPE_LABELS[d.documentType] || d.documentType;

          if (Array.isArray(d.files)) {
            // Multi-upload type (aadhaar, pan, education, experience, other)
            d.files.forEach((f: any, index: number) => {
              list.push({
                id: `${docSnap.id}-${index}`,
                fileName: f.fileName,
                title: label,
                url: f.url,
                uploadedBy: "You",
                category: "Onboarding",
              });
            });
          } else if (d.downloadURL) {
            // Single-upload type (photo, resume, cheque, offer)
            list.push({
              id: docSnap.id,
              fileName: d.fileName,
              title: label,
              url: d.downloadURL,
              uploadedBy: "You",
              category: "Onboarding",
            });
          }
        });

        setOnboardingDocs(list);
      });
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDocsSnapshot) unsubscribeDocsSnapshot();
      if (unsubscribeOnboardingSnapshot) unsubscribeOnboardingSnapshot();
    };
  }, []);

  const filteredDocs = documents.filter((d) => {
    const name = (d.fileName || d.title || "").toLowerCase();
    const matchesSearch = name.includes(search.toLowerCase());
    const matchesCategory =
      activeCategory === "All" || d.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const filteredOnboardingDocs = onboardingDocs.filter((d) => {
    const name = (d.fileName || d.title || "").toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const totalCount = documents.length + onboardingDocs.length;

  if (checkingAuth) {
    return null;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-color)",
        padding: "20px 14px 60px",
      }}
    >
      <style jsx global>{`
        @media (max-width: 640px) {
          .docs-header {
            align-items: flex-start !important;
          }
          .docs-header h1 {
            font-size: 24px !important;
          }
          .docs-filter-row {
            flex-wrap: nowrap !important;
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch;
            padding-bottom: 4px;
          }
          .docs-filter-row::-webkit-scrollbar {
            display: none;
          }
          .docs-row {
            flex-direction: column !important;
            align-items: flex-start !important;
          }
          .docs-row-actions {
            width: 100%;
          }
          .docs-row-actions a {
            flex: 1;
            text-align: center;
          }
        }
      `}</style>

      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* HEADER */}
        <div
          className="docs-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            flexWrap: "wrap",
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: "var(--text-color)",
                margin: 0,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              📁 My Documents
            </h1>
            <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 6 }}>
              All your payroll, offer letters, and company files in one place.
            </p>
          </div>

          <div
            style={{
              background: "var(--card-bg)",
              borderRadius: 12,
              padding: "10px 18px",
              boxShadow: "0 2px 10px rgba(0,0,0,.06)",
              fontSize: 13.5,
              color: "var(--text-muted)",
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            {totalCount} document{totalCount !== 1 ? "s" : ""} total
          </div>
        </div>

        {/* SEARCH + FILTER BAR */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            marginBottom: 22,
          }}
        >
          <input
            placeholder="🔍 Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "13px 16px",
              fontSize: 15,
              borderRadius: 10,
              border: "1px solid var(--border-color)",
              outline: "none",
              background: "var(--card-bg)",
              color: "var(--text-color)",
            }}
          />

          <div className="docs-filter-row" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
            <FilterPill
              label={`${ONBOARDING_CATEGORY.icon} ${ONBOARDING_CATEGORY.label}`}
              active={activeCategory === ONBOARDING_CATEGORY.key}
              onClick={() => setActiveCategory(ONBOARDING_CATEGORY.key)}
            />
          </div>
        </div>

        {/* CONTENT */}
        {loading ? (
          <EmptyState icon="⏳" text="Loading your documents..." />
        ) : activeCategory === ONBOARDING_CATEGORY.key ? (
          filteredOnboardingDocs.length === 0 ? (
            <EmptyState
              icon="📭"
              text={
                search
                  ? "No onboarding documents match your search."
                  : "No onboarding documents uploaded yet."
              }
            />
          ) : (
            <DocumentGrid docs={filteredOnboardingDocs} />
          )
        ) : activeCategory !== "All" ? (
          filteredDocs.length === 0 ? (
            <EmptyState
              icon="📭"
              text={
                search
                  ? "No documents match your search."
                  : "No documents available yet."
              }
            />
          ) : (
            <DocumentGrid docs={filteredDocs} />
          )
        ) : filteredDocs.length === 0 && filteredOnboardingDocs.length === 0 ? (
          <EmptyState
            icon="📭"
            text={
              search
                ? "No documents match your search."
                : "No documents available yet."
            }
          />
        ) : (
          <>
            {CATEGORY_CONFIG.map((c) => {
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
            })}

            {filteredOnboardingDocs.length > 0 && (
              <DocumentSection
                key={ONBOARDING_CATEGORY.key}
                title={`${ONBOARDING_CATEGORY.icon} ${ONBOARDING_CATEGORY.label}`}
                color={ONBOARDING_CATEGORY.color}
                docs={filteredOnboardingDocs}
              />
            )}
          </>
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
        border: active ? "1px solid #3d6fa8" : "1px solid var(--border-color)",
        background: active ? "#3d6fa8" : "var(--card-bg)",
        color: active ? "#fff" : "var(--text-muted)",
        fontWeight: 600,
        fontSize: 13,
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "all .15s ease",
        flexShrink: 0,
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
        background: "var(--card-bg)",
        borderRadius: 16,
        padding: "50px 20px",
        textAlign: "center",
        boxShadow: "0 4px 16px rgba(0,0,0,.05)",
      }}
    >
      <div style={{ fontSize: 38, marginBottom: 10 }}>{icon}</div>
      <p style={{ color: "var(--text-muted)", fontSize: 14.5, margin: 0 }}>{text}</p>
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
    <div style={{ marginBottom: 24 }}>
      <h2
        style={{
          fontSize: 16.5,
          fontWeight: 800,
          color,
          marginBottom: 12,
        }}
      >
        {title}
        <span
          style={{
            marginLeft: 10,
            fontSize: 12,
            fontWeight: 700,
            color: "var(--text-muted)",
            background: "var(--accent-bg)",
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
        background: "var(--card-bg)",
        borderRadius: 16,
        boxShadow: "0 4px 16px rgba(0,0,0,.05)",
        overflow: "hidden",
      }}
    >
      {docs.map((item, i) => (
        <div
          key={item.id}
          className="docs-row"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 18px",
            borderBottom:
              i === docs.length - 1 ? "none" : "1px solid var(--border-color)",
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
                width: 40,
                height: 40,
                borderRadius: 10,
                background: "var(--accent-bg)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 19,
                flexShrink: 0,
              }}
            >
              {getFileIcon(item.fileName || item.title || "")}
            </div>

            <div style={{ minWidth: 0 }}>
              <h3
                style={{
                  fontSize: 14.5,
                  fontWeight: 700,
                  color: "var(--text-color)",
                  margin: 0,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: 260,
                }}
                title={item.fileName || item.title}
              >
                {item.fileName || item.title}
              </h3>
              <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "3px 0 0" }}>
                Uploaded by {item.uploadedBy || "HR"}
              </p>
            </div>
          </div>

          <div className="docs-row-actions" style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <a
              href={getViewUrl(item)}
              target="_blank"
              rel="noreferrer"
              style={viewBtn}
            >
              View
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
  background: "#3d6fa8",
  color: "#fff",
  padding: "9px 16px",
  borderRadius: 8,
  textDecoration: "none",
  fontWeight: 600,
  fontSize: 13,
};

const downloadBtn: React.CSSProperties = {
  background: "#16a34a",
  color: "#fff",
  padding: "9px 16px",
  borderRadius: 8,
  textDecoration: "none",
  fontWeight: 600,
  fontSize: 13,
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

// background:"#3d6fa8",
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



// "use client";

// import { useEffect, useState } from "react";
// import { auth, db } from "../../lib/firebase";

// import {
//   collection,
//   query,
//   where,
//   onSnapshot,
// } from "firebase/firestore";

// type DocItem = {
//   id: string;
//   fileName?: string;
//   title?: string;
//   url?: string;
//   uploadedBy?: string;
//   uploadedAt?: any;
//   category?: string;
// };

// const CATEGORY_CONFIG = [
//   { key: "Payroll", label: "Payroll Documents", icon: "💰", color: "#059669" },
//   { key: "Creative Script", label: "Script Documents", icon: "🎬", color: "#7c3aed" },
//   { key: "Office Documents", label: "Office Documents", icon: "🏢", color: "#3d6fa8" },
//   { key: "Offer Letter", label: "Offer Letter", icon: "✉️", color: "#d97706" },
// ];

// export default function DocumentsPage() {
//   const [documents, setDocuments] = useState<DocItem[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [search, setSearch] = useState("");
//   const [activeCategory, setActiveCategory] = useState("All");

//   useEffect(() => {
//     let unsubscribeSnapshot: (() => void) | undefined;

//     const unsubscribeAuth = auth.onAuthStateChanged((user) => {
//       if (!user) {
//         setLoading(false);
//         return;
//       }

//       const q = query(
//         collection(db, "documents"),
//         where("employeeEmail", "in", [user.email, "all"])
//       );

//       unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
//         const list = snapshot.docs.map((doc) => ({
//           id: doc.id,
//           ...doc.data(),
//         })) as DocItem[];

//         setDocuments(list);
//         setLoading(false);
//       });
//     });

//     return () => {
//       unsubscribeAuth();
//       if (unsubscribeSnapshot) unsubscribeSnapshot();
//     };
//   }, []);

//   const filteredDocs = documents.filter((d) => {
//     const name = (d.fileName || d.title || "").toLowerCase();
//     const matchesSearch = name.includes(search.toLowerCase());
//     const matchesCategory =
//       activeCategory === "All" || d.category === activeCategory;
//     return matchesSearch && matchesCategory;
//   });

//   const totalCount = documents.length;

//   return (
//     <div
//       style={{
//         minHeight: "100vh",
//         background: "#f5f7fb",
//         padding: "32px 24px 60px",
//       }}
//     >
//       <div style={{ maxWidth: 1100, margin: "0 auto" }}>
//         {/* HEADER */}
//         <div
//           style={{
//             display: "flex",
//             justifyContent: "space-between",
//             alignItems: "flex-end",
//             flexWrap: "wrap",
//             gap: 16,
//             marginBottom: 28,
//           }}
//         >
//           <div>
//             <h1
//               style={{
//                 fontSize: 34,
//                 fontWeight: 800,
//                 color: "#0f172a",
//                 margin: 0,
//                 display: "flex",
//                 alignItems: "center",
//                 gap: 10,
//               }}
//             >
//               📁 My Documents
//             </h1>
//             <p style={{ color: "#64748b", fontSize: 15, marginTop: 6 }}>
//               All your payroll, offer letters, and company files in one place.
//             </p>
//           </div>

//           <div
//             style={{
//               background: "#fff",
//               borderRadius: 12,
//               padding: "10px 18px",
//               boxShadow: "0 2px 10px rgba(0,0,0,.06)",
//               fontSize: 14,
//               color: "#475569",
//               fontWeight: 600,
//             }}
//           >
//             {totalCount} document{totalCount !== 1 ? "s" : ""} total
//           </div>
//         </div>

//         {/* SEARCH + FILTER BAR */}
//         <div
//           style={{
//             display: "flex",
//             gap: 12,
//             flexWrap: "wrap",
//             marginBottom: 24,
//           }}
//         >
//           <input
//             placeholder="🔍 Search documents..."
//             value={search}
//             onChange={(e) => setSearch(e.target.value)}
//             style={{
//               flex: "1 1 260px",
//               padding: "13px 16px",
//               fontSize: 15,
//               borderRadius: 10,
//               border: "1px solid #e2e8f0",
//               outline: "none",
//               background: "#fff",
//             }}
//           />

//           <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
//             <FilterPill
//               label="All"
//               active={activeCategory === "All"}
//               onClick={() => setActiveCategory("All")}
//             />
//             {CATEGORY_CONFIG.map((c) => (
//               <FilterPill
//                 key={c.key}
//                 label={`${c.icon} ${c.label}`}
//                 active={activeCategory === c.key}
//                 onClick={() => setActiveCategory(c.key)}
//               />
//             ))}
//           </div>
//         </div>

//         {/* CONTENT */}
//         {loading ? (
//           <EmptyState icon="⏳" text="Loading your documents..." />
//         ) : filteredDocs.length === 0 ? (
//           <EmptyState
//             icon="📭"
//             text={
//               search
//                 ? "No documents match your search."
//                 : "No documents available yet."
//             }
//           />
//         ) : activeCategory !== "All" ? (
//           <DocumentGrid docs={filteredDocs} />
//         ) : (
//           CATEGORY_CONFIG.map((c) => {
//             const docsInCategory = filteredDocs.filter(
//               (d) => d.category === c.key
//             );
//             if (docsInCategory.length === 0) return null;
//             return (
//               <DocumentSection
//                 key={c.key}
//                 title={`${c.icon} ${c.label}`}
//                 color={c.color}
//                 docs={docsInCategory}
//               />
//             );
//           })
//         )}
//       </div>
//     </div>
//   );
// }

// function FilterPill({
//   label,
//   active,
//   onClick,
// }: {
//   label: string;
//   active: boolean;
//   onClick: () => void;
// }) {
//   return (
//     <button
//       onClick={onClick}
//       style={{
//         padding: "10px 16px",
//         borderRadius: 999,
//         border: active ? "1px solid #3d6fa8" : "1px solid #e2e8f0",
//         background: active ? "#3d6fa8" : "#fff",
//         color: active ? "#fff" : "#475569",
//         fontWeight: 600,
//         fontSize: 13.5,
//         cursor: "pointer",
//         whiteSpace: "nowrap",
//         transition: "all .15s ease",
//       }}
//     >
//       {label}
//     </button>
//   );
// }

// function EmptyState({ icon, text }: { icon: string; text: string }) {
//   return (
//     <div
//       style={{
//         background: "#fff",
//         borderRadius: 16,
//         padding: "60px 20px",
//         textAlign: "center",
//         boxShadow: "0 4px 16px rgba(0,0,0,.05)",
//       }}
//     >
//       <div style={{ fontSize: 42, marginBottom: 10 }}>{icon}</div>
//       <p style={{ color: "#64748b", fontSize: 15, margin: 0 }}>{text}</p>
//     </div>
//   );
// }

// function DocumentSection({
//   title,
//   color,
//   docs,
// }: {
//   title: string;
//   color: string;
//   docs: DocItem[];
// }) {
//   return (
//     <div style={{ marginBottom: 28 }}>
//       <h2
//         style={{
//           fontSize: 18,
//           fontWeight: 800,
//           color,
//           marginBottom: 14,
//         }}
//       >
//         {title}
//         <span
//           style={{
//             marginLeft: 10,
//             fontSize: 12,
//             fontWeight: 700,
//             color: "#94a3b8",
//             background: "#f1f5f9",
//             padding: "2px 9px",
//             borderRadius: 999,
//           }}
//         >
//           {docs.length}
//         </span>
//       </h2>
//       <DocumentGrid docs={docs} />
//     </div>
//   );
// }

// function DocumentGrid({ docs }: { docs: DocItem[] }) {
//   return (
//     <div
//       style={{
//         background: "#fff",
//         borderRadius: 16,
//         boxShadow: "0 4px 16px rgba(0,0,0,.05)",
//         overflow: "hidden",
//       }}
//     >
//       {docs.map((item, i) => (
//         <div
//           key={item.id}
//           style={{
//             display: "flex",
//             justifyContent: "space-between",
//             alignItems: "center",
//             padding: "18px 22px",
//             borderBottom:
//               i === docs.length - 1 ? "none" : "1px solid #f1f5f9",
//             gap: 12,
//             flexWrap: "wrap",
//           }}
//         >
//           <div
//             style={{
//               display: "flex",
//               alignItems: "center",
//               gap: 14,
//               minWidth: 0,
//             }}
//           >
//             <div
//               style={{
//                 width: 42,
//                 height: 42,
//                 borderRadius: 10,
//                 background: "#eff6ff",
//                 display: "flex",
//                 alignItems: "center",
//                 justifyContent: "center",
//                 fontSize: 20,
//                 flexShrink: 0,
//               }}
//             >
//               {getFileIcon(item.fileName || item.title || "")}
//             </div>

//             <div style={{ minWidth: 0 }}>
//               <h3
//                 style={{
//                   fontSize: 15.5,
//                   fontWeight: 700,
//                   color: "#0f172a",
//                   margin: 0,
//                   whiteSpace: "nowrap",
//                   overflow: "hidden",
//                   textOverflow: "ellipsis",
//                   maxWidth: 420,
//                 }}
//                 title={item.fileName || item.title}
//               >
//                 {item.fileName || item.title}
//               </h3>
//               <p style={{ fontSize: 13, color: "#94a3b8", margin: "3px 0 0" }}>
//                 Uploaded by {item.uploadedBy || "HR"}
//               </p>
//             </div>
//           </div>

//           <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
//             <a href={item.url} target="_blank" rel="noreferrer" style={viewBtn}>
//               👁 View
//             </a>
//             <a href={item.url} download style={downloadBtn}>
//               ⬇ Download
//             </a>
//           </div>
//         </div>
//       ))}
//     </div>
//   );
// }

// function getFileIcon(fileName: string) {
//   const ext = fileName.split(".").pop()?.toLowerCase();
//   switch (ext) {
//     case "pdf":
//       return "📕";
//     case "doc":
//     case "docx":
//       return "📘";
//     case "xls":
//     case "xlsx":
//     case "csv":
//       return "📗";
//     case "png":
//     case "jpg":
//     case "jpeg":
//       return "🖼️";
//     default:
//       return "📄";
//   }
// }

// const viewBtn: React.CSSProperties = {
//   background: "#3d6fa8",
//   color: "#fff",
//   padding: "9px 16px",
//   borderRadius: 8,
//   textDecoration: "none",
//   fontWeight: 600,
//   fontSize: 13.5,
// };

// const downloadBtn: React.CSSProperties = {
//   background: "#16a34a",
//   color: "#fff",
//   padding: "9px 16px",
//   borderRadius: 8,
//   textDecoration: "none",
//   fontWeight: 600,
//   fontSize: 13.5,
// };



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

// background:"#3d6fa8",
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