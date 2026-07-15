"use client";

import { useState, useEffect } from "react";

import {
  collection,
  addDoc,
  getDocs,
  Timestamp,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";

import { db } from "../../../lib/firebase";

export default function AssetsPage() {
  const [employeeName, setEmployeeName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [assetType, setAssetType] = useState("");
  const [assetName, setAssetName] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [remarks, setRemarks] = useState("");
  const [assets, setAssets] = useState([]);
  const [employees, setEmployees] = useState([]);
useEffect(() => {
  loadAssets();
  loadEmployees();
}, []);

const loadAssets = async () => {

  const snapshot = await getDocs(collection(db, "assets"));

  const list = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  setAssets(list);

};

const loadEmployees = async () => {

  const snapshot = await getDocs(collection(db, "users"));

  const list = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  setEmployees(list);

};
const assignAsset = async () => {

  if (!employeeName || !assetType) {
    alert("Please fill all required fields.");
    return;
  }

  await addDoc(collection(db, "assets"), {

    employeeName,

    employeeId,

    assetType,

    assetName,

    serialNumber,

    remarks,

    status: "Assigned",

    assignedDate: Timestamp.now(),

  });

  alert("Asset Assigned Successfully");

  setEmployeeName("");
  setEmployeeId("");
  setAssetType("");
  setAssetName("");
  setSerialNumber("");
  setRemarks("");

  loadAssets();
};

const returnAsset = async (id) => {

  await updateDoc(
    doc(db, "assets", id),
    {
      status: "Returned",
      returnedDate: Timestamp.now(),
    }
  );

  alert("Asset Returned");

  loadAssets();

};
const deleteAsset = async (id) => {

  const confirmDelete = window.confirm(
    "Delete this asset?"
  );

  if (!confirmDelete) return;

  await deleteDoc(
    doc(db, "assets", id)
  );

  alert("Deleted");

  loadAssets();

};

  return (
    <div
      style={{
        maxWidth: "1300px",
        margin: "40px auto",
        padding: "30px",
      }}
    >
      <h1
        style={{
          fontSize: "36px",
          marginBottom: "10px",
        }}
      >
        💻 Company Assets
      </h1>
<button
        onClick={() => (window.location.href = "/admin")}
        style={{
          background: "#2563eb",
          color: "#fff",
          border: "none",
          padding: "10px 20px",
          borderRadius: "10px",
          cursor: "pointer",
          fontWeight: "600",
        }}
      >
        ← Dashboard
      </button>
      <p
        style={{
          color: "#64748b",
          marginBottom: "30px",
        }}
      >
        Assign and manage company assets for employees.
      </p>

      <div
        style={{
          background: "#fff",
          padding: "30px",
          borderRadius: "15px",
          boxShadow: "0 10px 25px rgba(0,0,0,.08)",
        }}
      >
        <h2>Assign Asset</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "20px",
            marginTop: "20px",
          }}
        >
          <div>

            <label>Employee</label>

            <select

            value={employeeId}

            onChange={(e)=>{

            const selected = employees.find(
            emp => emp.uid === e.target.value
            );

            if(selected){

            setEmployeeId(selected.uid);

            setEmployeeName(
            `${selected.firstName || ""} ${selected.lastName || ""}`
            );

            }

            }}

            style={inputStyle}

            >

            <option value="">Select Employee</option>

            {employees.map((emp) => (

            <option
            key={emp.id}
            value={emp.uid}
            >

            {emp.firstName || emp.name || "No Name"} {emp.lastName || ""}

            </option>

            ))}

            </select>

            </div>


          <div>
            <label>Asset Type</label>

            <select
              value={assetType}
              onChange={(e) => setAssetType(e.target.value)}
              style={inputStyle}
            >
              <option value="">Select Asset</option>
              <option>Laptop</option>
              <option>Desktop</option>
              <option>Monitor</option>
              <option>Keyboard</option>
              <option>Mouse</option>
              <option>Headset</option>
              <option>Mobile</option>
              <option>ID Card</option>
              <option>Access Card</option>
              <option>Adobe License</option>
              <option>Frame.io License</option>
              <option>Slack Account</option>
              <option>Google Workspace</option>
              <option>VPN Access</option>
              <option>Other</option>
            </select>
          </div>

          <div>
            <label>Asset Name</label>

            <input
              value={assetName}
              onChange={(e) => setAssetName(e.target.value)}
              placeholder="MacBook Pro M4"
              style={inputStyle}
            />
          </div>

          <div>
            <label>Serial Number</label>

            <input
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              placeholder="MBP-10025"
              style={inputStyle}
            />
          </div>

          <div>
            <label>Remarks</label>

            <input
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="New Employee Kit"
              style={inputStyle}
            />
          </div>
        </div>

        <button
          onClick={assignAsset}
          style={{
            marginTop: "30px",
            background: "#2563eb",
            color: "#fff",
            border: "none",
            padding: "15px 30px",
            borderRadius: "10px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          Assign Asset
        </button>
      </div>

      <div
        style={{
          marginTop: "40px",
          background: "#fff",
          padding: "30px",
          borderRadius: "15px",
          boxShadow: "0 10px 25px rgba(0,0,0,.08)",
        }}
      >

        <div
style={{
display:"grid",
gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",
gap:20,
marginBottom:30
}}
>

<div style={card}>
<h3>Total Assets</h3>
<h1>{assets.length}</h1>
</div>

<div style={card}>
<h3>Assigned</h3>
<h1>
{
assets.filter(
a=>a.status==="Assigned"
).length
}
</h1>
</div>

<div style={card}>
<h3>Returned</h3>
<h1>
{
assets.filter(
a=>a.status==="Returned"
).length
}
</h1>
</div>

<div style={card}>
<h3>Asset Types</h3>
<h1>
{
new Set(
assets.map(
a=>a.assetType
)
).size
}
</h1>
</div>

</div>
        <h2>Assigned Assets</h2>

        <table
          style={{
            width: "100%",
            marginTop: "20px",
            borderCollapse: "collapse",
          }}
        >
          <thead>
            <tr>
                <th style={th}>Employee</th>
                <th style={th}>Asset</th>
                <th style={th}>Name</th>
                <th style={th}>Serial</th>
                <th style={th}>Status</th>
                <th style={th}>Actions</th>
            </tr>
            </thead>

        <tbody>

        {assets.length === 0 ? (

        <tr>

        <td
        colSpan="5"
        style={{
        padding:30,
        textAlign:"center"
        }}
        >

        No Assets Assigned

        </td>

        </tr>

        ) : (

        assets.map((asset)=>(

        <tr key={asset.id}>

        <td style={td}>{asset.employeeName}</td>

        <td style={td}>{asset.assetType}</td>

        <td style={td}>{asset.assetName}</td>

        <td style={td}>{asset.serialNumber}</td>

        <td style={td}>
        <span
            style={{
            padding: "6px 12px",
            borderRadius: 20,
            background:
                asset.status === "Returned"
                ? "#fee2e2"
                : "#dcfce7",
            color:
                asset.status === "Returned"
                ? "#dc2626"
                : "#15803d",
            fontWeight: "600",
            }}
        >
            {asset.status}
        </span>
        </td>

        <td style={td}>
        <button
            style={greenBtn}
            onClick={() => returnAsset(asset.id)}
        >
            Return
        </button>

        <button
            style={redBtn}
            onClick={() => deleteAsset(asset.id)}
        >
            Delete
        </button>
        </td>

        </tr>

        ))

        )}

        </tbody>
        </table>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "12px",
  marginTop: "8px",
  border: "1px solid #d1d5db",
  borderRadius: "10px",
};

const th = {
  padding: "15px",
  background: "#f8fafc",
  textAlign: "left",
};

const td = {
  padding: "15px",
  borderBottom: "1px solid #eee",
};

const card={
background:"#fff",
padding:"20px",
borderRadius:"15px",
textAlign:"center",
boxShadow:"0 8px 20px rgba(0,0,0,.08)"
};