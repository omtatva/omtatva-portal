"use client";

import Link from "next/link";

export default function Footer() {
  return (
    <footer
      style={{
        background: "#111111",
        color: "#ffffff",
        marginTop: 100,
      }}
    >
      <div
        style={{
          maxWidth: 1450,
          margin: "auto",
          padding: "70px 40px",
          display: "grid",
          gridTemplateColumns: "2fr 1fr 1fr 1fr",
          gap: 50,
        }}
      >
        {/* Company */}

        <div>
          <img
            src="/logo.ico"
            alt="logo"
            style={{
              width: 70,
              marginBottom: 20,
            }}
          />

          <h2
            style={{
              margin: 0,
              color: "#66a8e0",
            }}
          >
            OMTATVA DIGITALS
          </h2>

          <p
            style={{
              color: "#cccccc",
              lineHeight: 1.9,
              marginTop: 20,
            }}
          >
            AI Powered Production Management &
            HR Operations Platform built for
            creative teams, filmmakers and
            digital production companies.
          </p>

          <div
            style={{
              display: "flex",
              gap: 15,
              marginTop: 30,
            }}
          >
            {["🌐", "📘", "📸", "▶️", "💼"].map((icon) => (
              <div
                key={icon}
                style={{
                  width: 45,
                  height: 45,
                  background: "#3d6fa8",
                  borderRadius: "50%",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  fontSize: 18,
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
  <h3 style={{ color: "#66a8e0" }}>
    Quick Links
  </h3>

  {[
   { name: "Home", link: "/#top" },
    { name: "Attendance", link: "/attendance" },
    { name: "Timesheets", link: "/timesheet" },
    { name: "Leave", link: "/leave" },
    { name: "Employee Dashboard", link: "/dashboard" },
    { name: "Admin Dashboard", link: "/admin" },
    { name: "Documents", link: "/documents" },
    { name: "Reports", link: "/reports" },
  ].map((item) => (
    <Link
      key={item.name}
      href={item.link}
      style={{
        display: "block",
        color: "#ddd",
        textDecoration: "none",
        margin: "15px 0",
        transition: "0.3s",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.color = "#66a8e0")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.color = "#ddd")
      }
    >
      {item.name}
    </Link>
  ))}
</div>

        {/* Platform */}

        <div>
  <h3 style={{ color: "#66a8e0" }}>
    Platform
  </h3>

  {[
    { name: "Payroll", link: "/payroll" },
    { name: "Performance", link: "/performance" },
    { name: "AI Workflow", link: "/ai-workflow" },
    { name: "Reports", link: "/reports" },
    { name: "Admin Portal", link: "/admin" },
    { name: "Analytics", link: "/reports" },
  ].map((item) => (
    <Link
      key={item.name}
      href={item.link}
      style={{
        display: "block",
        color: "#ddd",
        textDecoration: "none",
        margin: "15px 0",
      }}
    >
      {item.name}
    </Link>
  ))}
</div>

        {/* Contact */}

        <div>
          <h3 style={{ color: "#66a8e0" }}>
            Contact
          </h3>

          <p style={{ color: "#ddd" }}>
            📍 Noida, Uttar Pradesh
          </p>

          <p style={{ color: "#ddd" }}>
            📞 +91 XXXXX XXXXX
          </p>

          <p style={{ color: "#ddd" }}>
            ✉ hr@omtatvadigitals.com
          </p>

          <p style={{ color: "#ddd" }}>
            🌐 www.omtatvadigitals.com
          </p>
        </div>
      </div>

      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,.1)",
          padding: 25,
          textAlign: "center",
          color: "#aaa",
        }}
      >
        © 2026 OMTATVA DIGITALS Pvt. Ltd.

        <br />

        Powered by AI • Built with ❤️ by OMTATVA DIGITALS
      </div>
    </footer>
  );
}