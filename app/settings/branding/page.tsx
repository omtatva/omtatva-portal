"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import { db, storage } from "../../../lib/firebase";
import { Building2, Image, Upload } from "lucide-react";

const SETTINGS_REF = () => doc(db, "settings", "branding");

export default function BrandingPage() {
  const [companyName, setCompanyName] = useState("");
  const [logo, setLogo] = useState("");
  const [loginImage, setLoginImage] = useState("");
  const [background, setBackground] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  // Live-load from Firestore, and stay in sync — so if another admin
  // (or this same page in another tab) changes branding, this page
  // reflects it immediately instead of only on next visit.
  useEffect(() => {
    const unsubscribe = onSnapshot(
      SETTINGS_REF(),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setCompanyName(data.companyName || "");
          setLogo(data.logo || "");
          setLoginImage(data.loginImage || "");
          setBackground(data.backgroundImage || "");
        }
        setLoading(false);
      },
      (error) => {
        console.error("LOAD BRANDING ERROR:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Persists the given partial update to Firestore immediately — used
  // both by "Save" (company name) and by each file upload (so an image
  // upload doesn't require a separate Save click to take effect).
  const persist = async (updates: Record<string, any>) => {
    setSaving(true);
    try {
      await setDoc(SETTINGS_REF(), updates, { merge: true });
    } catch (error) {
      console.error("SAVE BRANDING ERROR:", error);
      alert("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const saveCompanyName = () => {
    persist({ companyName });
    alert("Company name saved");
  };

  // Uploads a file to Firebase Storage under settings/branding/<field>,
  // then writes the resulting download URL straight to Firestore —
  // this is the actual "upload" step that was missing before (the old
  // page only accepted a pasted URL).
  const uploadFile = async (
    file: File,
    field: "logo" | "loginImage" | "backgroundImage",
    setLocal: (url: string) => void
  ) => {
    try {
      setUploadingField(field);

      const storageRef = ref(storage, `settings/branding/${field}-${Date.now()}-${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          undefined,
          (error) => reject(error),
          () => resolve()
        );
      });

      const url = await getDownloadURL(uploadTask.snapshot.ref);

      setLocal(url);
      await persist({ [field]: url });
    } catch (error) {
      console.error("UPLOAD ERROR:", error);
      alert("Upload failed. Please try again.");
    } finally {
      setUploadingField(null);
    }
  };

  if (loading) {
    return <CenteredMessage text="Loading branding settings..." />;
  }

  return (
    <div
      style={{
        padding: "20px",
        background: "#f8fbff",
        minHeight: "100vh",
      }}
    >
      <style jsx global>{`
        @media (max-width: 600px) {
          .branding-title {
            font-size: 24px !important;
          }
          .branding-grid {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }
          .branding-card {
            padding: 18px !important;
          }
        }
      `}</style>

      <h1
        className="branding-title"
        style={{ fontSize: "30px", fontWeight: 700 }}
      >
        🏢 Branding
        {saving && (
          <span style={{ fontSize: 14, color: "#3d6fa8", marginLeft: 12, fontWeight: 500 }}>
            Saving...
          </span>
        )}
      </h1>

      <p style={{ color: "#64748B", marginBottom: 26 }}>
        Manage your company identity and visuals. Changes here apply
        instantly across the platform (navbar, login page, dashboard).
      </p>

      <div
        className="branding-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))",
          gap: 25,
        }}
      >
        {/* COMPANY IDENTITY */}
        <Card title="Company Identity" icon={<Building2 />}>
          <label style={labelStyle}>Company Name</label>
          <input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            style={input}
          />
          <button onClick={saveCompanyName} style={saveBtn}>
            Save Name
          </button>

          <label style={{ ...labelStyle, marginTop: 22 }}>Company Logo</label>

          <UploadRow
            currentUrl={logo}
            uploading={uploadingField === "logo"}
            onFile={(file) => uploadFile(file, "logo", setLogo)}
          />

          {logo && (
            <img
              src={logo}
              alt="Company logo"
              style={{
                width: 100,
                height: 100,
                objectFit: "contain",
                marginTop: 15,
                borderRadius: 12,
                border: "1px solid #eee",
                background: "#fff",
              }}
            />
          )}
        </Card>

        {/* LOGIN PAGE */}
        <Card title="Login Page" icon={<Image />}>
          <label style={labelStyle}>Login Background Image</label>

          <UploadRow
            currentUrl={loginImage}
            uploading={uploadingField === "loginImage"}
            onFile={(file) => uploadFile(file, "loginImage", setLoginImage)}
          />

          {loginImage && (
            <img
              src={loginImage}
              alt="Login background preview"
              style={{
                width: "100%",
                height: 120,
                objectFit: "cover",
                borderRadius: 12,
                marginTop: 12,
              }}
            />
          )}
        </Card>

        {/* DASHBOARD BANNER */}
        <Card title="Dashboard Banner" icon={<Image />}>
          <label style={labelStyle}>Dashboard Background Image</label>

          <UploadRow
            currentUrl={background}
            uploading={uploadingField === "backgroundImage"}
            onFile={(file) => uploadFile(file, "backgroundImage", setBackground)}
          />

          {background && (
            <img
              src={background}
              alt="Dashboard banner preview"
              style={{
                width: "100%",
                height: 120,
                objectFit: "cover",
                borderRadius: 12,
                marginTop: 12,
              }}
            />
          )}
        </Card>
      </div>
    </div>
  );
}

function UploadRow({
  currentUrl,
  uploading,
  onFile,
}: {
  currentUrl: string;
  uploading: boolean;
  onFile: (file: File) => void;
}) {
  const inputId = `upload-${Math.random().toString(36).slice(2)}`;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <input
        id={inputId}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
      />

      <label
        htmlFor={inputId}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          background: uploading ? "#93c5fd" : "#3d6fa8",
          color: "#fff",
          padding: "10px 18px",
          borderRadius: 10,
          cursor: uploading ? "default" : "pointer",
          fontWeight: 600,
          fontSize: 13.5,
        }}
      >
        <Upload size={16} />
        {uploading ? "Uploading..." : currentUrl ? "Replace Image" : "Upload Image"}
      </label>
    </div>
  );
}

function Card({ title, icon, children }: any) {
  return (
    <div
      className="branding-card"
      style={{
        background: "#fff",
        padding: 25,
        borderRadius: 18,
        boxShadow: "0 8px 25px rgba(0,0,0,.05)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 18,
          fontWeight: 700,
          marginBottom: 20,
        }}
      >
        {icon}
        {title}
      </div>

      {children}
    </div>
  );
}

function CenteredMessage({ text }: { text: string }) {
  return (
    <div style={{ padding: 60, textAlign: "center", color: "#64748b" }}>
      <h2>{text}</h2>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13.5,
  fontWeight: 600,
  color: "#334155",
  marginBottom: 8,
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  margin: "0 0 12px",
  border: "1px solid #ddd",
  borderRadius: 10,
  boxSizing: "border-box",
  fontSize: 14.5,
};

const saveBtn: React.CSSProperties = {
  background: "#f1f5f9",
  color: "#334155",
  border: "none",
  padding: "9px 16px",
  borderRadius: 8,
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
};