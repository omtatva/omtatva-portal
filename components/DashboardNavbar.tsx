"use client";

import { Menu, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { appSettings } from "@/config/appSettings";

interface Props {
  sidebarOpen: boolean;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function DashboardNavbar({
  sidebarOpen,
  setSidebarOpen,
}: Props) {
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
    <header
      style={{
        height: 70,
        background: appSettings.colors.sidebar,
        borderBottom: "1px solid #EAF3FF",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 20px",
        position: "sticky",
        top: 0,
        zIndex: 1000,
        boxSizing: "border-box",
      }}
    >
      {/* Left: menu toggle + branding */}
      <div style={{ display: "flex", alignItems: "center" }}>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
          aria-expanded={sidebarOpen}
          className="dashnav-menu-btn"
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            color: appSettings.colors.primary,
            display: "flex",
            alignItems: "center",
            padding: 6,
            borderRadius: 8,
          }}
        >
          <Menu size={26} />
        </button>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginLeft: 20,
          }}
        >
          {appSettings.branding.logo ? (
            <img
              src={appSettings.branding.logo}
              alt={`${appSettings.branding.companyName} logo`}
              style={{
                height: 40,
                width: 40,
                borderRadius: 8,
                objectFit: "contain",
              }}
            />
          ) : null}

          <h3
            className="dashnav-company-name"
            style={{
              margin: 0,
              color: appSettings.colors.primary,
              fontSize: "20px",
              fontWeight: 700,
            }}
          >
            {appSettings.branding.companyName}
          </h3>
        </div>
      </div>

      {/* Right: user info + logout */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {user && (
          <span
            className="dashnav-user-email"
            style={{
              color: "#444",
              fontSize: 14,
              fontWeight: 500,
              maxWidth: 220,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {user.email}
          </span>
        )}

        <button
          onClick={handleLogout}
          aria-label="Logout"
          className="dashnav-logout-btn"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            border: "none",
            background: "#dc2626",
            color: "#fff",
            padding: "8px 16px",
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          <LogOut size={16} />
          <span className="dashnav-logout-label">Logout</span>
        </button>
      </div>

      <style jsx>{`
        .dashnav-menu-btn:hover {
          background: rgba(61, 111, 168, 0.08);
        }
        .dashnav-logout-btn:hover {
          background: #b91c1c;
        }
        .dashnav-menu-btn:focus-visible,
        .dashnav-logout-btn:focus-visible {
          outline: 2px solid ${appSettings.colors.primary};
          outline-offset: 2px;
        }
        @media (max-width: 640px) {
          .dashnav-company-name {
            display: none;
          }
          .dashnav-user-email {
            display: none;
          }
          .dashnav-logout-label {
            display: none;
          }
        }
      `}</style>
    </header>
  );
}


// "use client";

// import { Menu } from "lucide-react";
// import { appSettings } from "@/config/appSettings";

// interface Props {
//   sidebarOpen: boolean;
//   setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
// }

// export default function DashboardNavbar({
//   sidebarOpen,
//   setSidebarOpen,
// }: Props) {

//   return (
//     <header
//       style={{
//         height: 70,
//         background: appSettings.colors.sidebar,
//         borderBottom: "1px solid #EAF3FF",
//         display: "flex",
//         alignItems: "center",
//         padding: "0 20px",
//         position: "sticky",
//         top: 0,
//         zIndex: 1000,
//       }}
//     >

//       <button
//         onClick={() => setSidebarOpen(!sidebarOpen)}
//         style={{
//           border: "none",
//           background: "transparent",
//           cursor: "pointer",
//           color: appSettings.colors.primary,
//           display:"flex",
//           alignItems:"center",
//         }}
//       >
//         <Menu size={26} />
//       </button>


//       <div
//         style={{
//           display:"flex",
//           alignItems:"center",
//           gap:"12px",
//           marginLeft:20,
//         }}
//       >

//         {
//           appSettings.branding.logo ? (

//             <img
//               src={appSettings.branding.logo}
//               alt="logo"
//               style={{
//                 height:40,
//                 width:40,
//                 borderRadius:8,
//                 objectFit:"contain",
//               }}
//             />

//           ) : null
//         }


//         <h3
//           style={{
//             margin:0,
//             color: appSettings.colors.primary,
//             fontSize:"20px",
//             fontWeight:700,
//           }}
//         >
//           {appSettings.branding.companyName}
//         </h3>


//       </div>


//     </header>
//   );
// }