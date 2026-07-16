"use client";

import Link from "next/link";

export default function Footer() {
  return (
    <footer
      style={{
        background: "#111827",
        color: "#fff",
        marginTop: 70,
      }}
    >
      <div
        style={{
          maxWidth: 1300,
          margin: "0 auto",
          padding: "50px 40px",
          display: "grid",
          gridTemplateColumns: "2.3fr 1fr 1fr 1fr",
gap: 60,
alignItems: "start",
        }}
      >
        {/* Company */}
<div>
  {/* Logo + Company Name */}

  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 18,
      marginBottom: 20,
    }}
  >
    <img
      src="/logo.ico"
      alt="OMTATVA Logo"
      style={{
        width: 90,
        height: 90,
        objectFit: "contain",
      }}
    />

    <div>
      <h2
        style={{
          margin: 0,
          color: "#66a8e0",
          fontSize: 34,
          fontWeight: 700,
          lineHeight: 1.1,
        }}
      >
        OMTATVA DIGITALS
      </h2>

      <p
        style={{
          margin: "8px 0 0",
          color: "#bdbdbd",
          fontSize: 16,
        }}
      >
        Driven by Stories • Powered by AI
      </p>
    </div>
  </div>

  <p
    style={{
      color: "#d1d5db",
      lineHeight: 1.9,
      fontSize: 17,
      maxWidth: 420,
      marginTop: 25,
    }}
  >
    AI-powered HR, Attendance, Payroll and Production
    Management Platform built for modern creative teams and
    AI filmmaking studios.
  </p>

  <div
    style={{
      display: "flex",
      gap: 14,
      marginTop: 30,
    }}
  >
    {["🌐", "📘", "📸", "▶️", "💼"].map((icon) => (
      <div
        key={icon}
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: "#3d6fa8",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontSize: 20,
          cursor: "pointer",
        }}
      >
        {icon}
      </div>
    ))}
  </div>
</div>

        {/* Quick Links */}

        <div>
          <h3
            style={{
              color: "#66a8e0",
              marginBottom: 15,
              fontSize: 20,
            }}
          >
            Quick Links
          </h3>

          {[
            { name: "Home", link: "/#top" },
            { name: "Attendance", link: "/attendance" },
            { name: "Timesheets", link: "/timesheet" },
            { name: "Leave", link: "/leave" },
            { name: "Dashboard", link: "/dashboard" },
            { name: "Admin", link: "/admin" },
          ].map((item) => (
            <Link
              key={item.name}
              href={item.link}
              style={{
                display: "block",
                color: "#ddd",
                textDecoration: "none",
                margin: "10px 0",
                fontSize: 15,
              }}
            >
              {item.name}
            </Link>
          ))}
        </div>

        {/* Platform */}

        <div>
          <h3
            style={{
              color: "#66a8e0",
              marginBottom: 15,
              fontSize: 20,
            }}
          >
            Platform
          </h3>

          {[
            { name: "Payroll", link: "/payroll" },
            { name: "Performance", link: "/performance" },
            { name: "Documents", link: "/documents" },
            { name: "Reports", link: "/reports" },
            { name: "Analytics", link: "/reports" },
          ].map((item) => (
            <Link
              key={item.name}
              href={item.link}
              style={{
                display: "block",
                color: "#ddd",
                textDecoration: "none",
                margin: "10px 0",
                fontSize: 15,
              }}
            >
              {item.name}
            </Link>
          ))}
        </div>

        {/* Contact */}

        <div>
          <h3
            style={{
              color: "#66a8e0",
              marginBottom: 15,
              fontSize: 20,
            }}
          >
            Contact
          </h3>

          <p style={{ color: "#ddd", fontSize: 15 }}>📍 Noida, Uttar Pradesh</p>

          <p style={{ color: "#ddd", fontSize: 15 }}>📞 +91 9667566556</p>

          <p style={{ color: "#ddd", fontSize: 15 }}>
            ✉ hr@omtatvadigitals.com
          </p>

          <p style={{ color: "#ddd", fontSize: 15 }}>
            🌐 www.omtatvadigitals.com
          </p>
        </div>
      </div>

      <div
  style={{
    borderTop: "1px solid rgba(255,255,255,.1)",
    padding: "25px 40px",
    textAlign: "center",
    color: "#bdbdbd",
    fontSize: 15,
    lineHeight: 1.8,
  }}
>
  © 2026 OMTATVA DIGITALS Pvt. Ltd. All Rights Reserved.

  <br />

  Powered by AI • Designed & Developed by <b>Radhika Agarwal</b>
</div>
    </footer>
  );
}