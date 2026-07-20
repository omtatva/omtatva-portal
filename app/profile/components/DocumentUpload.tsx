"use client";

import React, { useState } from "react";
import { auth, db, storage } from "../../../lib/firebase";
import toast from "react-hot-toast";
import {
  ref,
  getDownloadURL,
  uploadBytesResumable,
} from "firebase/storage";

import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
export default function DocumentUpload({
  back,
  next,
}: {
  back: () => void;
  next: () => void;
}) {

  const [documents, setDocuments] = useState<{
    [key: string]: File | null;
  }>({});

  const [uploadProgress, setUploadProgress] = useState<{
  [key: string]: number;
}>({});

const uploadFile = async (
  file: File,
  type: string
) => {
  const user = auth.currentUser;

  if (!user) {
    toast.error("Please login first.");
    return;
  }

  const storageRef = ref(
    storage,
    `employees/${user.uid}/${type}/${file.name}`
  );

  const uploadTask = uploadBytesResumable(
    storageRef,
    file
  );

  return new Promise<void>((resolve, reject) => {
    uploadTask.on(
      "state_changed",

      (snapshot) => {
        const progress = Math.round(
          (snapshot.bytesTransferred /
            snapshot.totalBytes) *
            100
        );

        setUploadProgress((prev) => ({
          ...prev,
          [type]: progress,
        }));
      },

      (error) => {
        reject(error);
      },

      async () => {
        try {
          const url = await getDownloadURL(
            uploadTask.snapshot.ref
          );

          await addDoc(
            collection(db, "employeeDocuments"),
            {
              employeeId: user.uid,
              employeeEmail: user.email,
              fileName: file.name,
              documentType: type,
              downloadURL: url,
              status: "Pending",
              uploadedAt: serverTimestamp(),
            }
          );

          setUploadProgress((prev) => ({
            ...prev,
            [type]: 100,
          }));

          resolve();
        } catch (error) {
          reject(error);
        }
      }
    );
  });
};

  const uploadCard = (title: string, key: string) => (
    <div
      style={{
        border: "2px dashed #cbd5e1",
        borderRadius: 16,
        padding: 25,
        textAlign: "center",
        background: "#f8fafc",
      }}
    >
      <h3
        style={{
          marginBottom: 15,
          color: "#2563eb",
        }}
      >
        {title}
      </h3>

      <input
  id={key}
  type="file"
  style={{ display: "none" }}
  onChange={async (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    setDocuments({
      ...documents,
      [key]: file,
    });

    await uploadFile(file, key);
  }}
/>

<label
  htmlFor={key}
  style={{
    display: "inline-block",
    marginTop: 15,
    background:
      uploadProgress[key] === 100
        ? "#16a34a"
        : "#2563eb",
    color: "#fff",
    padding: "10px 22px",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 14,
  }}
>
  {uploadProgress[key] === 100
    ? "✅ Replace File"
    : "📤 Upload File"}
</label>

{uploadProgress[key] > 0 &&
uploadProgress[key] < 100 && (
 <>
  <div
    style={{
      width: "100%",
      height: 8,
      background: "#e2e8f0",
      borderRadius: 50,
      marginTop: 15,
      overflow: "hidden",
    }}
  >
    <div
      style={{
        width: `${uploadProgress[key]}%`,
        height: "100%",
        background:
          uploadProgress[key] === 100
            ? "#16a34a"
            : "#2563eb",
        transition: "width .3s ease",
      }}
    />
  </div>

 <p
  style={{
    marginTop: 10,
    fontWeight: 600,
    fontSize: 14,
    color:
      uploadProgress[key] === 100
        ? "#16a34a"
        : "#2563eb",
  }}
>
  {uploadProgress[key] === 100 ? (
    <>✅ Uploaded Successfully</>
  ) : uploadProgress[key] > 0 ? (
    <>⏳ Uploading... {uploadProgress[key]}%</>
  ) : (
    <>📤 Ready to Upload</>
  )}
</p>
</>
)}
      <p
  style={{
    marginTop: 15,
    fontSize: 14,
    color: documents[key] ? "#16a34a" : "#64748b",
    fontWeight: 600,
    minHeight: 20,
  }}
>
  {documents[key]
    ? `✅ ${documents[key]?.name}`
    : "No file selected"}
</p>
<p
  style={{
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 8,
  }}
>
  PDF, JPG, PNG • Max 5 MB
</p>
    </div>
  );

  return (
    <div>
      <h2
        style={{
          color: "#2563eb",
          marginBottom: 35,
        }}
      >
        📁 Document Upload
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(260px,1fr))",
          gap: 25,
        }}
      >
        {uploadCard("📷 Profile Photo", "photo")}
        {uploadCard("🪪 Aadhaar Card", "aadhaar")}
        {uploadCard("💳 PAN Card", "pan")}
        {uploadCard("📄 Resume", "resume")}
        {uploadCard("🎓 Education Certificates", "education")}
        {uploadCard("💼 Experience Letter", "experience")}
        {uploadCard("🏦 Cancelled Cheque", "cheque")}
        {uploadCard("📃 Offer Letter", "offer")}
        {uploadCard("📂 Other Documents", "other")}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 45,
        }}
      >
        <button
          onClick={back}
          style={{
            background: "#64748b",
            color: "#fff",
            border: "none",
            padding: "14px 30px",
            borderRadius: 12,
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          ← Back
        </button>

        <button
          onClick={next}
          style={{
            background: "#2563eb",
            color: "#fff",
            border: "none",
            padding: "14px 30px",
            borderRadius: 12,
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          Save & Continue →
        </button>
      </div>
    </div>
  );
}