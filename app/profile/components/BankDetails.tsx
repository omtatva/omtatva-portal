"use client";

import React from "react";

export default function BankDetails({
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
        🏦 Bank Details
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2,minmax(0,1fr))",
          gap: 25,
        }}
      >
        <div>
          <label>Account Holder Name *</label>
          <input style={input} />
        </div>

        <div>
          <label>Bank Name *</label>
          <input style={input} />
        </div>

        <div>
          <label>Account Number *</label>
          <input style={input} />
        </div>

        <div>
          <label>Confirm Account Number *</label>
          <input style={input} />
        </div>

        <div>
          <label>IFSC Code *</label>
          <input
            placeholder="SBIN0001234"
            style={input}
          />
        </div>

        <div>
          <label>Branch Name</label>
          <input style={input} />
        </div>

        <div>
          <label>UPI ID</label>
          <input
            placeholder="name@bank"
            style={input}
          />
        </div>

        <div>
          <label>Account Type</label>

          <select style={input}>
            <option>Savings</option>
            <option>Current</option>
            <option>Salary</option>
          </select>
        </div>

        <div>
          <label>PF Number</label>
          <input style={input} />
        </div>

        <div>
          <label>ESIC Number</label>
          <input style={input} />
        </div>

        <div>
          <label>UAN Number</label>
          <input style={input} />
        </div>

        <div>
          <label>PAN linked with Bank</label>

          <select style={input}>
            <option>Yes</option>
            <option>No</option>
          </select>
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
            fontWeight: 700,
            cursor: "pointer",
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
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Save & Continue →
        </button>
      </div>
    </div>
  );
}