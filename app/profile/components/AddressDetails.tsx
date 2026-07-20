"use client";

import React, { useState } from "react";

export default function AddressDetails({
  back,
  next,
}: {
  back: () => void;
  next: () => void;
}) {
  const [sameAddress, setSameAddress] = useState(false);

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
        🏠 Address Information
      </h2>

      <h3
        style={{
          color: "#0f172a",
          marginBottom: 20,
        }}
      >
        Current Address
      </h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2,minmax(0,1fr))",
          gap: 25,
        }}
      >
        <div style={{ gridColumn: "1 / span 2" }}>
          <label>Address Line 1</label>
          <input style={input} />
        </div>

        <div style={{ gridColumn: "1 / span 2" }}>
          <label>Address Line 2</label>
          <input style={input} />
        </div>

        <div>
          <label>City</label>
          <input style={input} />
        </div>

        <div>
          <label>State</label>
          <input style={input} />
        </div>

        <div>
          <label>Country</label>
          <input defaultValue="India" style={input} />
        </div>

        <div>
          <label>PIN Code</label>
          <input style={input} />
        </div>
      </div>

      <hr
        style={{
          margin: "40px 0",
          border: "1px solid #e5e7eb",
        }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 25,
        }}
      >
        <input
          type="checkbox"
          checked={sameAddress}
          onChange={(e) =>
            setSameAddress(e.target.checked)
          }
        />

        <label
          style={{
            fontWeight: 600,
          }}
        >
          Permanent Address is same as Current Address
        </label>
      </div>

      {!sameAddress && (
        <>
          <h3
            style={{
              color: "#0f172a",
              marginBottom: 20,
            }}
          >
            Permanent Address
          </h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2,minmax(0,1fr))",
              gap: 25,
            }}
          >
            <div style={{ gridColumn: "1 / span 2" }}>
              <label>Address Line 1</label>
              <input style={input} />
            </div>

            <div style={{ gridColumn: "1 / span 2" }}>
              <label>Address Line 2</label>
              <input style={input} />
            </div>

            <div>
              <label>City</label>
              <input style={input} />
            </div>

            <div>
              <label>State</label>
              <input style={input} />
            </div>

            <div>
              <label>Country</label>
              <input
                defaultValue="India"
                style={input}
              />
            </div>

            <div>
              <label>PIN Code</label>
              <input style={input} />
            </div>
          </div>
        </>
      )}

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