"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

import { db, storage } from "../../../../lib/firebase";

export default function EmployeeDocumentsPage() {
  const { id } = useParams();

  const [user, setUser] = useState(null);

  useEffect(() => {
    loadEmployee();
  }, []);

  const loadEmployee = async () => {
    const snap = await getDoc(doc(db, "users", id));

    if (snap.exists()) {
      setUser(snap.data());
    }
  };

  if (!user) {
    return <h2 style={{ padding: 40 }}>Loading...</h2>;
  }

  const uploadDocument = async (type, file) => {
  if (!file) return;

  try {
    const storageRef = ref(
      storage,
      `documents/${id}/${type}_${file.name}`
    );

    await uploadBytes(storageRef, file);

    const url = await getDownloadURL(storageRef);

    await updateDoc(doc(db, "users", id), {
      [`documents.${type}`]: url,
    });

    loadEmployee();

    alert(`${type} uploaded successfully`);
  } catch (err) {
    console.log(err);
    alert("Upload Failed");
  }
};

const DocumentRow = ({ title, type }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "20px",
      borderBottom: "1px solid #eee",
    }}
  >
    <div>
      <h3>{title}</h3>

      {user.documents?.[type] ? (
        <span
          style={{
            color: "#16a34a",
            fontWeight: 600,
          }}
        >
          Uploaded
        </span>
      ) : (
        <span
          style={{
            color: "#dc2626",
          }}
        >
          Not Uploaded
        </span>
      )}
    </div>

    <div
      style={{
        display: "flex",
        gap: "12px",
        alignItems: "center",
      }}
    >
      {user.documents?.[type] && (
        <>
          <a
            href={user.documents[type]}
            target="_blank"
            style={blueBtn}
          >
            View
          </a>

          <a
            href={user.documents[type]}
            download
            style={greenBtn}
          >
            Download
          </a>
        </>
      )}

      <label style={orangeBtn}>
        Upload

        <input
          hidden
          type="file"
          onChange={(e) =>
            uploadDocument(type, e.target.files[0])
          }
        />
      </label>
    </div>
  </div>
);

return (
  <div
    style={{
      width: "96%",
      maxWidth: "1600px",
      margin: "40px auto",
    }}
  >
    <div
      style={{
        display: "flex",
        gap: "25px",
        alignItems: "center",
        marginBottom: "30px",
      }}
    >
      <img
        src={user.photoURL || "/profile.png"}
        style={{
          width: 140,
          height: 140,
          borderRadius: "50%",
          objectFit: "cover",
          border: "5px solid #2563eb",
        }}
      />

      <div>
        <h1>
          {user.firstName} {user.lastName}
        </h1>

        <h3>{user.employeeId}</h3>

        <p>{user.department}</p>
      </div>
    </div>

    <div
      style={{
        background: "#fff",
        borderRadius: 15,
        overflow: "hidden",
        boxShadow:
          "0 5px 20px rgba(0,0,0,.08)",
      }}
    >
      <DocumentRow
        title="Resume"
        type="resume"
      />

      <DocumentRow
        title="Offer Letter"
        type="offerLetter"
      />

      <DocumentRow
        title="Appointment Letter"
        type="appointmentLetter"
      />

      <DocumentRow
        title="Passport"
        type="passport"
      />

      <DocumentRow
        title="PAN Card"
        type="pan"
      />

      <DocumentRow
        title="Aadhaar Card"
        type="aadhaar"
      />

      <DocumentRow
        title="Bank Passbook"
        type="bank"
      />

      <DocumentRow
        title="Salary Slip"
        type="salarySlip"
      />

      <DocumentRow
        title="Experience Letter"
        type="experienceLetter"
      />

      <DocumentRow
        title="Relieving Letter"
        type="relievingLetter"
      />
    </div>
  </div>
);
}

const blueBtn = {
  background: "#2563eb",
  color: "#fff",
  padding: "10px 18px",
  borderRadius: 8,
  textDecoration: "none",
};

const greenBtn = {
  background: "#16a34a",
  color: "#fff",
  padding: "10px 18px",
  borderRadius: 8,
  textDecoration: "none",
};

const orangeBtn = {
  background: "#f59e0b",
  color: "#fff",
  padding: "10px 18px",
  borderRadius: 8,
  cursor: "pointer",
};