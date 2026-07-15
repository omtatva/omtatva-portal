"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../../lib/firebase";

export default function DocumentsPage() {
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    const snapshot = await getDocs(collection(db, "users"));

    const list = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    setEmployees(list);
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
        width: "96%",
        maxWidth: "1700px",
        margin: "40px auto",
      }}
    >
      <h1
        style={{
          fontSize: 38,
          marginBottom: 8,
        }}
      >
        📁 Employee Documents
      </h1>

      <p
        style={{
          color: "#64748b",
          marginBottom: 30,
          fontSize: 18,
        }}
      >
        Manage employee documents and upload HR files.
      </p>

      <input
        placeholder="Search Employee..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: "100%",
          padding: "16px",
          fontSize: 18,
          borderRadius: 12,
          border: "1px solid #d1d5db",
          marginBottom: 25,
        }}
      />

      <div
        style={{
          background: "#fff",
          borderRadius: 15,
          overflow: "hidden",
          boxShadow: "0 5px 20px rgba(0,0,0,.08)",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
          }}
        >
          <thead>
            <tr
              style={{
                background: "#f8fafc",
              }}
            >
              <th style={th}>Employee</th>
              <th style={th}>Employee ID</th>
              <th style={th}>Department</th>
              <th style={th}>Resume</th>
              <th style={th}>Status</th>
              <th style={th}>Action</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((emp) => (
              <tr key={emp.id}>
                <td style={td}>
                  {emp.firstName} {emp.lastName}
                </td>

                <td style={td}>
                  {emp.employeeId || "-"}
                </td>

                <td style={td}>
                  {emp.department || "-"}
                </td>

                <td style={td}>
                  {emp.resume ? "✅ Uploaded" : "❌ Missing"}
                </td>

                <td style={td}>
                  {emp.status || "Active"}
                </td>

                <td style={td}>
                  <button
                    onClick={() =>
                      (window.location.href = `/admin/documents/${emp.id}`)
                    }
                    style={{
                      background: "#2563eb",
                      color: "#fff",
                      border: "none",
                      padding: "10px 20px",
                      borderRadius: 10,
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    View Documents
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th = {
  textAlign: "left",
  padding: "18px",
  fontSize: 18,
};

const td = {
  padding: "18px",
  fontSize: 17,
  borderTop: "1px solid #eee",
};