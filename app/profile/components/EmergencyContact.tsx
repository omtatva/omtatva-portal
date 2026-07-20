"use client";

import React from "react";

export default function EmergencyContact({
  back,
  next,
}: {
  back: () => void;
  next: () => void;
}) {
  const input: React.CSSProperties = {
    width: "100%",
    height: 52,
    border: "1px solid #d1d5db",
    borderRadius: 12,
    padding: "0 15px",
    fontSize: 15,
    marginTop: 8,
    boxSizing: "border-box",
  };

  return (
    <div>
      <h2
        style={{
          color: "#2563eb",
          marginBottom: 30,
        }}
      >
        🚨 Emergency Contact
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2,minmax(0,1fr))",
          gap: 25,
        }}
      >
        <div>
          <label>Contact Name *</label>
          <input style={input} />
        </div>

        <div>
          <label>Relationship *</label>
          <select style={input}>
            <option>Select</option>
            <option>Father</option>
            <option>Mother</option>
            <option>Spouse</option>
            <option>Brother</option>
            <option>Sister</option>
            <option>Friend</option>
            <option>Guardian</option>
            <option>Other</option>
          </select>
        </div>

        <div>
          <label>Primary Mobile *</label>
          <input
            type="tel"
            placeholder="+91 9876543210"
            style={input}
          />
        </div>

        <div>
          <label>Alternate Mobile</label>
          <input
            type="tel"
            style={input}
          />
        </div>

        <div>
          <label>Email Address</label>
          <input
            type="email"
            style={input}
          />
        </div>

        <div>
          <label>Occupation</label>
          <input style={input} />
        </div>

        <div style={{ gridColumn: "1 / span 2" }}>
          <label>Address</label>
          <input style={input} />
        </div>
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