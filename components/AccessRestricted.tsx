"use client";

import { Lock } from "lucide-react";

export default function AccessRestricted({
  message = "You don't have permission to view this page. Contact IT Support if you need something changed here.",
}: {
  message?: string;
}) {
  return (
    <div
      style={{
        padding: "25px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "70vh",
      }}
    >
      <div
        style={{
          background: "var(--card-bg)",
          borderRadius: 20,
          padding: "40px 30px",
          textAlign: "center",
          maxWidth: 420,
          boxShadow: "0 10px 30px rgba(0,0,0,.06)",
        }}
      >
        <div
          style={{
            width: 60,
            height: 60,
            margin: "0 auto 18px",
            borderRadius: "50%",
            background: "#fee2e2",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#dc2626",
          }}
        >
          <Lock size={28} />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 10px", color: "var(--text-color)" }}>
          Access Restricted
        </h2>
        <p style={{ color: "var(--text-muted)", fontSize: 14.5, margin: 0 }}>
          {message}
        </p>
      </div>
    </div>
  );
}
