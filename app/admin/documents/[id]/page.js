"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

import { db, storage } from "../../../../lib/firebase";

// Types marked `multiple: true` accept more than one file — HR can
// keep adding files and every one shows up with its own View/Download.
// Everything else stays single-file (uploading again replaces it).
const DOCUMENT_TYPES = [
  { title: "📄 Resume", type: "resume" },
  { title: "✉️ Offer Letter", type: "offerLetter" },
  { title: "🖼 Passport", type: "passport" },
  { title: "💳 PAN Card", type: "pan", multiple: true },
  { title: "🪪 Aadhaar Card", type: "aadhaar", multiple: true },
  { title: "Education Certificates", type: "education", multiple: true },
  { title: "🏦 Cancelled Cheque", type: "bank" },
  { title: "💼 Experience Letter", type: "experienceLetter", multiple: true },
  { title: "📄 Relieving Letter", type: "relievingLetter" },
  { title: "💰 Payslip", type: "salarySlip", multiple: true },
  { title: "🏢 Office Compliance Document", type: "officeCompliance" },

];

// Infer a proper Content-Type from the file extension / URL so
// Storage doesn't fall back to a generic application/octet-stream —
// that generic type, combined with an attachment disposition, is
// what makes browsers download instead of preview.
function extensionFromNameOrUrl(nameOrUrl) {
  if (!nameOrUrl) return undefined;
  const withoutQuery = nameOrUrl.split("?")[0];
  const decoded = decodeURIComponent(withoutQuery);
  return decoded.split(".").pop()?.toLowerCase();
}

function getContentType(nameOrUrl) {
  const ext = extensionFromNameOrUrl(nameOrUrl);
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    default:
      return undefined;
  }
}

// Opens a file in a new tab via a fetched blob with the correct MIME
// type — works for both newly uploaded (inline-metadata) files and
// older ones that still carry an attachment disposition from Storage.
async function viewInNewTab(url, fileName) {
  if (!url) return;

  const newTab = window.open("", "_blank");

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Fetch failed");

    const rawBlob = await response.blob();
    const contentType = getContentType(fileName || url) || rawBlob.type;
    const blob = contentType ? new Blob([rawBlob], { type: contentType }) : rawBlob;
    const blobUrl = URL.createObjectURL(blob);

    if (newTab) {
      newTab.location.href = blobUrl;
    } else {
      window.open(blobUrl, "_blank");
    }

    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  } catch (error) {
    console.log("View fetch failed, falling back to direct link:", error);
    if (newTab) {
      newTab.location.href = url;
    } else {
      window.open(url, "_blank");
    }
  }
}

export default function EmployeeDocumentsPage() {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadingType, setUploadingType] = useState(null);
  const [downloadingKey, setDownloadingKey] = useState(null);

  useEffect(() => {
    if (id) {
      loadEmployee();
    } else {
      setLoading(false);
    }
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

      // contentDisposition: "inline" tells Storage to serve the file
      // for the browser to render instead of forcing a download.
      const contentType = getContentType(file.name);
      const metadata = {
        contentDisposition: "inline",
        ...(contentType ? { contentType } : {}),
      };

      await uploadBytes(storageRef, file, metadata);
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
  src={
    user.profilePhoto ||
    user.photoURL ||
    "/profile.png"
  }
  alt="Profile"
  style={{
    width:110,
    height:110,
    borderRadius:"50%",
    objectFit:"cover",
    border:"4px solid #3d6fa8"
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
            <div style={{ fontSize: 22, fontWeight: 800, color: "#3d6fa8" }}>
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
                <button
                  onClick={() => viewInNewTab(file.url, file.name)}
                  style={{ ...btnStyle("#3d6fa8"), border: "none", cursor: "pointer" }}
                >
                  View {index + 1}
                </button>
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
            <button
              onClick={() => viewInNewTab(data, type)}
              style={{ ...btnStyle("#3d6fa8"), border: "none", cursor: "pointer" }}
            >
              View
            </button>
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
          {isUploading ? "Uploading..." : multiple ? "Upload (Add More)" : "Upload"}
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