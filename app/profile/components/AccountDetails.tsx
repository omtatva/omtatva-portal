"use client";

import React from "react";

export default function AccountDetails({
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
        🏢 Account Details
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2,minmax(0,1fr))",
          gap: 25,
        }}
      >
        <div>
          <label>Official Email</label>
          <input
            type="email"
            disabled
            style={{
              ...input,
              background: "#f1f5f9",
            }}
          />
        </div>

        <div>
          <label>Username</label>
          <input style={input} />
        </div>

        <div>
          <label>Employee Code</label>
          <input style={input} />
        </div>

        <div>
          <label>Department</label>

          <select style={input}>
            <option>Select Department</option>
            <option>Production</option>
            <option>HR</option>
            <option>Accounts</option>
            <option>Operations</option>
            <option>Creative</option>
            <option>Marketing</option>
          </select>
        </div>

        <div>
          <label>Designation</label>
          <input style={input} />
        </div>

        <div>
          <label>Reporting Manager</label>
          <input style={input} />
        </div>

        <div>
          <label>Employment Type</label>

          <select style={input}>
            <option>Permanent</option>
            <option>Contract</option>
            <option>Intern</option>
            <option>Freelancer</option>
          </select>
        </div>

        <div>
          <label>Office Location</label>

          <select style={input}>
            <option>Noida</option>
            <option>Delhi</option>
            <option>Mumbai</option>
            <option>Remote</option>
          </select>
        </div>

        <div>
          <label>Shift Timing</label>

          <select style={input}>
            <option>09:00 AM - 06:00 PM</option>
            <option>10:00 AM - 07:00 PM</option>
            <option>Flexible</option>
          </select>
        </div>

        <div>
          <label>Joining Date</label>
          <input
            type="date"
            style={input}
          />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 40,
        }}
      >
        <button
          onClick={back}
          style={{
            background: "#64748b",
            color: "#fff",
            border: "none",
            padding: "15px 30px",
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
            padding: "15px 30px",
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