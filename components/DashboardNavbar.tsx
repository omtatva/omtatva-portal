"use client";

import { Menu, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import AvatarIllustration from "./AvatarIllustration";

interface Props {
  sidebarOpen: boolean;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const DEFAULT_BRANDING = {
  companyName: "OMTATVA DIGITALS",
  logo: "",
};

const DEFAULT_COLORS = {
  primary: "#3d6fa8",
  // Empty (not "#FFFFFF") so the navbar background falls through to the
  // theme-aware --card-bg CSS var below when no custom color has been
  // saved in Settings -> Appearance — otherwise the navbar stayed stuck
  // on white/grey even after switching to dark theme.
  sidebar: "",
};

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg,#3d6fa8,#66a8e0)",
  "linear-gradient(135deg,#7c3aed,#c084fc)",
  "linear-gradient(135deg,#16a34a,#4ade80)",
  "linear-gradient(135deg,#f59e0b,#fbbf24)",
  "linear-gradient(135deg,#dc2626,#f87171)",
  "linear-gradient(135deg,#0891b2,#22d3ee)",
];

// Deterministic pick so the same person always gets the same color,
// rather than it changing every reload.
function gradientForName(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

export default function DashboardNavbar({
  sidebarOpen,
  setSidebarOpen,
}: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [branding, setBranding] = useState(DEFAULT_BRANDING);
  const [colors, setColors] = useState(DEFAULT_COLORS);
  const [profile, setProfile] = useState({ firstName: "", lastName: "" });
  // profilePhoto/gender live on employeeProfiles/{uid} (what the Profile
  // wizard's PersonalInfo/DocumentUpload steps actually write to) — NOT
  // users/{uid}.profileImage, which is only ever set once at first
  // Google sign-in and never updated by an actual photo upload. Reading
  // the wrong field here was why an uploaded photo never showed up in
  // this header.
  const [avatar, setAvatar] = useState({ profilePhoto: "", gender: "" });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Live avatar — picks up a name change from the Profile page
  // immediately, same live-sync pattern as branding/appearance below.
  useEffect(() => {
    if (!user) {
      setProfile({ firstName: "", lastName: "" });
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, "users", user.uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setProfile({
            firstName: data.firstName || "",
            lastName: data.lastName || "",
          });
        }
      },
      (error) => console.error("NAVBAR PROFILE SNAPSHOT ERROR:", error)
    );
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setAvatar({ profilePhoto: "", gender: "" });
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, "employeeProfiles", user.uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setAvatar({
            profilePhoto: data.profilePhoto || "",
            gender: data.gender || "",
          });
        }
      },
      (error) => console.error("NAVBAR AVATAR SNAPSHOT ERROR:", error)
    );
    return () => unsubscribe();
  }, [user]);

  // Live from Firestore instead of the old in-memory appSettings object —
  // so a logo/name change from Settings → Branding, or a color change
  // from Settings → Appearance, shows up here immediately for every
  // logged-in user, not just the tab that made the change.
  useEffect(() => {
    const unsubscribeBranding = onSnapshot(
      doc(db, "settings", "branding"),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setBranding({
            companyName: data.companyName || DEFAULT_BRANDING.companyName,
            logo: data.logo || "",
          });
        }
      },
      (error) => console.error("BRANDING SNAPSHOT ERROR:", error)
    );

    const unsubscribeAppearance = onSnapshot(
      doc(db, "settings", "appearance"),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setColors({
            primary: data.colors?.primary || DEFAULT_COLORS.primary,
            sidebar: data.colors?.sidebar || DEFAULT_COLORS.sidebar,
          });
        }
      },
      (error) => console.error("APPEARANCE SNAPSHOT ERROR:", error)
    );

    return () => {
      unsubscribeBranding();
      unsubscribeAppearance();
    };
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
        background: colors.sidebar || "var(--card-bg)",
        borderBottom: "1px solid var(--border-color)",
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
            color: colors.primary,
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
          {branding.logo ? (
            <img
              src={branding.logo}
              alt={`${branding.companyName} logo`}
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
              color: colors.primary,
              fontSize: "20px",
              fontWeight: 700,
            }}
          >
            {branding.companyName}
          </h3>
        </div>
      </div>

      {/* Right: user info + logout */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {user && (
          <div className="dashnav-avatar-outer">
            <div className="dashnav-avatar-spinner" />
            <div className="dashnav-avatar-inner">
              {avatar.profilePhoto ? (
                <img
                  src={avatar.profilePhoto}
                  alt="Your profile"
                  className="dashnav-avatar-img"
                />
              ) : avatar.gender ? (
                <div className="dashnav-avatar-illustration">
                  <AvatarIllustration gender={avatar.gender} size={42} />
                </div>
              ) : (
                <div
                  className="dashnav-avatar-initials"
                  style={{
                    background: gradientForName(
                      `${profile.firstName}${profile.lastName}` || user.email || "U"
                    ),
                  }}
                >
                  {(profile.firstName?.[0] || user.email?.[0] || "U").toUpperCase()}
                </div>
              )}
            </div>
          </div>
        )}

        {user && (
          <span
            className="dashnav-user-email"
            style={{
              color: "var(--text-color)",
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
          outline: 2px solid ${colors.primary};
          outline-offset: 2px;
        }

        /* Animated avatar — a slowly rotating gradient ring behind the
           photo/initials, plus a gentle "breathing" glow. Subtle enough
           for a work dashboard, but gives the header some life instead
           of a flat static circle.

           Two layers: .dashnav-avatar-spinner is the part that actually
           rotates (transform: rotate — no @property registration
           needed, unlike animating a custom property inside
           conic-gradient()); .dashnav-avatar-inner sits on top,
           positioned absolutely, and holds the photo/initials so THEY
           stay upright while the ring behind them spins. */
        .dashnav-avatar-outer {
          position: relative;
          width: 42px;
          height: 42px;
          flex-shrink: 0;
          border-radius: 50%;
          animation: dashnav-breathe 3s ease-in-out infinite;
          transition: transform 0.2s ease;
        }
        .dashnav-avatar-outer:hover {
          transform: scale(1.08);
        }
        .dashnav-avatar-spinner {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: conic-gradient(from 0deg, #3d6fa8, #66a8e0, #7c3aed, #3d6fa8);
          animation: dashnav-spin 5s linear infinite;
        }
        .dashnav-avatar-inner {
          position: absolute;
          inset: 2.5px;
          border-radius: 50%;
          overflow: hidden;
        }
        .dashnav-avatar-img,
        .dashnav-avatar-initials,
        .dashnav-avatar-illustration {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          display: block;
          object-fit: cover;
          border: 2px solid var(--card-bg);
          box-sizing: border-box;
        }
        .dashnav-avatar-illustration {
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .dashnav-avatar-illustration svg {
          width: 100%;
          height: 100%;
        }
        .dashnav-avatar-initials {
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-weight: 700;
          font-size: 15px;
        }
        @keyframes dashnav-spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes dashnav-breathe {
          0%,
          100% {
            box-shadow: 0 0 0 0 rgba(61, 111, 168, 0.25);
          }
          50% {
            box-shadow: 0 0 0 4px rgba(61, 111, 168, 0);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .dashnav-avatar-spinner,
          .dashnav-avatar-outer {
            animation: none;
          }
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