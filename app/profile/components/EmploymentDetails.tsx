"use client";

import React from "react";

export default function EmploymentDetails({
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
        💼 Employment Details
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2,minmax(0,1fr))",
          gap: 25,
        }}
      >
        <div>
          <label>Employee Code</label>
          <input style={input} />
        </div>

        <div>
          <label>Department</label>
          <select style={input}>
            <option>Production</option>
            <option>HR</option>
            <option>Marketing</option>
            <option>Finance</option>
            <option>Operations</option>
            <option>Creative</option>
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
          <label>Work Mode</label>
          <select style={input}>
            <option>Office</option>
            <option>Hybrid</option>
            <option>Remote</option>
          </select>
        </div>

        <div>
          <label>Office Location</label>
          <input
            defaultValue="Noida"
            style={input}
          />
        </div>

        <div>
          <label>Joining Date</label>
          <input
            type="date"
            style={input}
          />
        </div>

        <div>
          <label>Confirmation Date</label>
          <input
            type="date"
            style={input}
          />
        </div>

        <div>
          <label>Notice Period</label>
          <select style={input}>
            <option>15 Days</option>
            <option>30 Days</option>
            <option>60 Days</option>
            <option>90 Days</option>
          </select>
        </div>

        <div>
          <label>Employee Status</label>
          <select style={input}>
            <option>Active</option>
            <option>Probation</option>
            <option>On Leave</option>
            <option>Resigned</option>
          </select>
        </div>

        <div>
          <label>Official Email</label>
          <input
            type="email"
            style={{
              ...input,
              background: "#f3f4f6",
            }}
            disabled
          />
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