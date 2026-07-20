"use client";
import { useProfile } from "../ProfileContext";
import { auth, db } from "../../../lib/firebase";

import {
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
export default function ReviewSubmit({

    
  back,
}: {
  back: () => void;
}) {
    const { profile } = useProfile();
    const submitProfile = async () => {
  const user = auth.currentUser;

  if (!user) return;

  await setDoc(
    doc(db, "employees", user.uid),
    {
      ...profile,
      updatedAt: serverTimestamp(),
      profileCompleted: true,
    },
    { merge: true }
  );

  alert("Profile submitted successfully.");
};
  return (
    <div>
      <h2
        style={{
          color: "#2563eb",
          marginBottom: 25,
        }}
      >
        ✅ Review & Submit
      </h2>

      <div
        style={{
          background: "#f8fafc",
          border: "1px solid #dbeafe",
          borderRadius: 20,
          padding: 35,
          lineHeight: 2,
        }}
      >
        <h3>Profile Summary</h3>

        <p>
          Review all the information entered in the previous
          steps before submitting your employee profile.
        </p>

        <ul>
          <li>✔ Personal Information</li>
          <li>✔ Account Details</li>
          <li>✔ Address Information</li>
          <li>✔ Emergency Contact</li>
          <li>✔ Employment Details</li>
          <li>✔ Bank Details</li>
          <li>✔ Documents Uploaded</li>
        </ul>

        <p
          style={{
            color: "#64748b",
          }}
        >
          Once submitted, your HR team will verify the
          information before activating your profile.
        </p>
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
  onClick={submitProfile}
  style={{
    background: "#16a34a",
    color: "#fff",
    border: "none",
    padding: "15px 40px",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 16,
  }}
>
  🚀 Submit Profile
</button>
      </div>
    </div>
  );
}