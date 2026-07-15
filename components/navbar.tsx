"use client";

import Link from "next/link";
import { useState, CSSProperties } from "react";

export default function navbar() {
  const [platformOpen, setPlatformOpen] = useState(false);
  const [solutionOpen, setSolutionOpen] = useState(false);

  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 999,
        background: "#fff",
        boxShadow: "0 2px 15px rgba(0,0,0,.08)",
      }}
    >
<div
  style={{
    width: "100%",
    padding: "20px 30px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  }}
>
    
        {/* Logo */}

        <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 15,
    }}
  >
    <img
  src="/logo.ico"
  style={{
    width: 70,
    height: 70,
    objectFit: "contain",
  }}
/>

    <div>
      <h2
  style={{
    margin: 0,
    color: "#3d6fa8",
    fontSize: "32px",
    fontWeight: 800,
    letterSpacing: 1,
  }}
>
        OMTATVA DIGITALS
      </h2>

     <p
  style={{
    margin: 0,
    fontSize: 16,
    color: "#666",
  }}
>
        Driven by Stories • Powered by AI
      </p>
    </div>
  </div>

        {/* Menu */}

<div
  style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "65px",
    flex: 1,
  }}
>
          <Link href="/#top" style={link}>
  Home
</Link>

          {/* Platform */}

          <div
            style={{ position: "relative" }}
            onMouseEnter={() => setPlatformOpen(true)}
            onMouseLeave={() => setPlatformOpen(false)}
          >
            <span style={link}>
              Platform ▼
            </span>

            {platformOpen && (
              <div style={dropdown}>
                <Link href="/features/attendance" style={dropItem}>
                  Attendance
                </Link>

                <Link href="/features/payroll" style={dropItem}>
                  Payroll
                </Link>

                <Link href="/features/leave" style={dropItem}>
                  Leave
                </Link>

                <Link href="/features/timesheet" style={dropItem}>
                  Timesheets
                </Link>

                <Link href="/features/performance" style={dropItem}>
                  Performance
                </Link>

                <Link href="/features/documents" style={dropItem}>
                  Documents
                </Link>

                <Link href="/features/production" style={dropItem}>
                  AI Production
                </Link>

                <Link href="/features/reports" style={dropItem}>
                  Reports
                </Link>
              </div>
            )}
          </div>

          {/* Solutions */}

          <div
            style={{ position: "relative" }}
            onMouseEnter={() => setSolutionOpen(true)}
            onMouseLeave={() => setSolutionOpen(false)}
          >
            <span style={link}>
              Solutions ▼
            </span>

            {solutionOpen && (
              <div style={dropdown}>
                <Link href="/solutions/hr" style={dropItem}>
                  HR Management
                </Link>

                <Link href="/solutions/employee" style={dropItem}>
                  Employee Portal
                </Link>

                <Link href="/solutions/admin" style={dropItem}>
                  Admin Portal
                </Link>

                <Link href="/solutions/ai" style={dropItem}>
                  AI Production
                </Link>

                <Link href="/solutions/enterprise" style={dropItem}>
                  Enterprise
                </Link>
              </div>
            )}
          </div>

          <a href="#about" style={link}>
            About
          </a>

          <a href="#contact" style={link}>
            Contact
          </a>
        </div>

        {/* Buttons */}

<div
  style={{
    display: "flex",
    gap: "15px",
    marginLeft: "40px",
    marginRight:"120px",
  }}
>
          <Link href="/login">
            <button style={employeeBtn}>
              Employee Login
            </button>
          </Link>

          <Link href="/admin/login">
            <button style={adminBtn}>
              Admin Login
            </button>
          </Link>
        </div>
      </div>
    </nav>
  );
}

const link: CSSProperties = {
  color: "#1f2937",
  textDecoration: "none",
  fontWeight: 700,
  fontSize: "24px",
  padding: "12px 0",
  cursor: "pointer",
  transition: "all .3s ease",
};

const dropdown: CSSProperties = {
  position: "absolute",
  top: 42,
  left: 0,
  width: 250,
  background: "#fff",
  borderRadius: 14,
  boxShadow: "0 15px 35px rgba(0,0,0,.12)",
  display: "flex",
  flexDirection: "column" as const,
  overflow: "hidden",
};

const dropItem: CSSProperties = {
  padding: "18px 24px",
  textDecoration: "none",
  color: "#333",
  fontSize: "18px",
  fontWeight: 500,
  borderBottom: "1px solid #eee",
};

const employeeBtn: CSSProperties = {
  background: "#3d6fa8",
  color: "#fff",
  border: "none",
  padding: "14px 28px",
  borderRadius: 12,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: "20px",
};

const adminBtn: CSSProperties = {
  background: "#111827",
  color: "#fff",
  border: "none",
  padding: "14px 28px",
  borderRadius: 12,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: "20px",
};



// export default function Navbar() {
//   return (

// <nav
//   style={{
//     height: 80,
//     background: "#ffffff",
//     display: "flex",
//     justifyContent: "space-between",
//     alignItems: "center",
//     padding: "0 60px",
//     boxShadow: "0 5px 20px rgba(0,0,0,.06)",
//     position: "sticky",
//     top: 0,
//     zIndex: 999,
//   }}
// >
//   {/* Left */}

//   <div
//     style={{
//       display: "flex",
//       alignItems: "center",
//       gap: 15,
//     }}
//   >
//     <img
//       src="/logo.ico"
//       style={{
//         width: 55,
//         height: 55,
//         objectFit: "contain",
//       }}
//     />

//     <div>
//       <h2
//         style={{
//           margin: 0,
//           color: "#3d6fa8",
//           fontWeight: 800,
//           letterSpacing: 1,
//         }}
//       >
//         OMTATVA DIGITALS
//       </h2>

//       <p
//         style={{
//           margin: 0,
//           fontSize: 12,
//           color: "#666",
//         }}
//       >
//         Driven by Stories • Powered by AI
//       </p>
//     </div>
//   </div>

//   {/* Right */}

//   <div
//     style={{
//       display: "flex",
//       gap: 35,
//       alignItems: "center",
//     }}
//   >
//     {[
//       "Home",
//       "Features",
//       "About",
//       "Contact",
//     ].map((item) => (
//       <a
//         key={item}
//         href="#"
//         style={{
//           color: "#444",
//           textDecoration: "none",
//           fontWeight: 600,
//           transition: ".3s",
//         }}
//       >
//         {item}
//       </a>
//     ))}

//     <a href="/login">
//       <button
//         style={{
//           background: "#3d6fa8",
//           color: "#fff",
//           border: "none",
//           padding: "12px 28px",
//           borderRadius: 12,
//           fontWeight: 700,
//           cursor: "pointer",
//         }}
//       >
//         Employee Login
//       </button>
//     </a>
//   </div>
// </nav>
//   );
// }