"use client";

import Link from "next/link";
import { useState, useEffect, CSSProperties } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth } from "../lib/firebase";

export default function Navbar() {
  const [platformOpen, setPlatformOpen] = useState(false);
  const [solutionOpen, setSolutionOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      window.location.href = "/login";
    } catch (error) {
      console.log("Logout error:", error);
    }
  };

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
    padding: "14px 32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    boxSizing: "border-box",
  }}
>

{/* Logo */}
<div
  style={{
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexShrink: 0,
  }}
>
  <img
    src="/logo.ico"
    style={{
      width: 58,
      height: 58,
      objectFit: "contain",
    }}
  />

  <div>
    <h2
      style={{
        margin: 0,
        color: "#3d6fa8",
        fontSize: "24px",
        fontWeight: 800,
        lineHeight: 1.1,
      }}
    >
      OMTATVA DIGITALS
    </h2>

    <p
      style={{
        margin: "2px 0 0",
        color: "#666",
        fontSize: "13px",
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
  gap: 26,
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

                {[
                  ["Attendance","/attendance"],
                  ["Leave","/leave"],
                  ["Timesheets","/timesheet"],
                  ["Performance","/dashboard"],
                  ["Documents","/documents"],
                  ["AI Production","/Ai production"],
                  ["Reports","/reports"],
                ].map(([name,path]) => (
                  <Link key={path} href={path} style={dropItem}>
                    {name}
                  </Link>
                ))}

              </div>
            )}

          </div>



          {/* Solutions */}
          <div
            style={{ position:"relative" }}
            onMouseEnter={() => setSolutionOpen(true)}
            onMouseLeave={() => setSolutionOpen(false)}
          >

            <span style={link}>
              Solutions ▼
            </span>


            {solutionOpen && (
              <div style={dropdown}>

                {[
                  ["HR Management","/solutions/hr"],
                  ["Employee Portal","/dashboard"],
                  ["Admin Portal","/admin"],
                  ["AI Production", "/ai-production"],
                  // ["Enterprise",""],
                ].map(([name,path]) => (
                  <Link key={path} href={path} style={dropItem}>
                    {name}
                  </Link>
                ))}

              </div>
            )}

          </div>



        </div>



        {/* Buttons */}

<div
  style={{
  display: "flex",
  gap: "12px",
  marginLeft: "24px",
  alignItems: "center",
  flexShrink: 0,
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


  <button
    onClick={async () => {
      await signOut(auth);
      window.location.href = "/login";
    }}
    style={{
  background: "#dc2626",
  color: "#fff",
  border: "none",
  padding: "10px 18px",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: "15px",
}}
  >
    🚪 Logout
  </button>

</div>

      </div>
    </nav>
  );
}



const link: CSSProperties = {
  color: "#1f2937",
  textDecoration: "none",
  fontWeight: 600,
  fontSize: "17px",
  padding: "8px 0",
  cursor: "pointer",
  transition: "0.25s",
};

const dropdown: CSSProperties = {
  position: "absolute",
  top: 40,
  left: 0,
  width: 220,
  background: "#fff",
  borderRadius: 12,
  boxShadow: "0 10px 25px rgba(0,0,0,.12)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  zIndex: 9999,
};


const dropItem: CSSProperties = {
  padding: "12px 18px",
  textDecoration: "none",
  color: "#333",
  fontSize: "15px",
  fontWeight: 500,
  borderBottom: "1px solid #eee",
};


const employeeBtn: CSSProperties = {
  background: "#3d6fa8",
  color: "#fff",
  border: "none",
  padding: "10px 18px",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: "15px",
};


const adminBtn: CSSProperties = {
  background: "#111827",
  color: "#fff",
  border: "none",
  padding: "10px 18px",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: "15px",
};


const logoutBtn: CSSProperties = {
  background:"#dc2626",
  color:"#fff",
  border:"none",
  padding:"12px 22px",
  borderRadius:12,
  cursor:"pointer",
  fontWeight:700,
  fontSize:"15px",
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