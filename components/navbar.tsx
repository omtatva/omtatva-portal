

"use client";

import Link from "next/link";
import { useState, useEffect, useRef, CSSProperties } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { collection, doc, onSnapshot, query, orderBy } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { usePathname } from "next/navigation";

const DEFAULT_BRANDING = {
  companyName: "OMTATVA DIGITALS",
  logo: "/logo.ico",
};

const PLATFORM_LINKS: [string, string][] = [
  ["Dashboard", "/dashboard"],
  ["Attendance", "/attendance"],
  ["Leave", "/leave"],
  ["Timesheets", "/timesheet"],
  ["Documents", "/documents"],
  ["AI Production", "/workspace"],
  ["Reports", "/reports"],
];

type Announcement = {
  id: string;
  title: string;
  message: string;
  createdAt?: { toDate?: () => Date };
};

export default function Navbar() {
  const [platformOpen, setPlatformOpen] = useState(false);
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [branding, setBranding] = useState(DEFAULT_BRANDING);

  const pathname = usePathname();
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "announcements"), orderBy("createdAt", "desc")),
      (snapshot) => {
        const list = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as Announcement[];
        setAnnouncements(list);
      },
      (error) => {
        console.log("Load Announcements Error:", error);
        setAnnouncements([]);
      }
    );
    return () => unsubscribe();
  }, []);

  // Live from Firestore, same pattern as DashboardNavbar.tsx — so a
  // logo/company name change from Settings -> Branding shows up here on
  // the public site too, not just inside the logged-in portal.
  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, "settings", "branding"),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setBranding({
            companyName: data.companyName || DEFAULT_BRANDING.companyName,
            logo: data.logo || DEFAULT_BRANDING.logo,
          });
        }
      },
      (error) => console.error("NAVBAR BRANDING SNAPSHOT ERROR:", error)
    );
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

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        navRef.current &&
        event.target instanceof Node &&
        !navRef.current.contains(event.target)
      ) {
        setPlatformOpen(false);
        setAnnouncementOpen(false);
        setExpandedId(null);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPlatformOpen(false);
        setAnnouncementOpen(false);
        setExpandedId(null);
        setMobileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const hideNavbar =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/attendance") ||
    pathname.startsWith("/leave") ||
    pathname.startsWith("/timesheet") ||
    pathname.startsWith("/workspace") ||
    pathname.startsWith("/documents") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/settings");

  if (hideNavbar) {
    return null;
  }

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
        className="navbar-inner"
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
            gap: 18,
            flexShrink: 0,
          }}
        >
          <img
            src={branding.logo}
            alt={`${branding.companyName} logo`}
            style={{ width: 58, height: 58, objectFit: "contain" }}
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
              {branding.companyName}
            </h2>
            <p style={{ margin: "2px 0 0", color: "#666", fontSize: "13px" }}>
              Driven by Stories • Powered by AI
            </p>
          </div>
        </div>

        {/* Mobile toggle */}
        <button
          className="navbar-toggle"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(!mobileOpen)}
          style={{
            display: "none",
            background: "none",
            border: "none",
            fontSize: 26,
            cursor: "pointer",
            color: "#1f2937",
          }}
        >
          {mobileOpen ? "✕" : "☰"}
        </button>

        {/* Menu */}
        <div
          ref={navRef}
          className={`navbar-menu ${mobileOpen ? "navbar-menu-open" : ""}`}
        >
          <Link href="/#top" style={link} onClick={() => setMobileOpen(false)}>
            Home
          </Link>

          {/* Platform */}
          <div style={{ position: "relative" }}>
            <button
              type="button"
              style={{ ...link, ...dropdownTriggerReset }}
              aria-haspopup="true"
              aria-expanded={platformOpen}
              onClick={() => {
                setPlatformOpen(!platformOpen);
                setAnnouncementOpen(false);
              }}
            >
              Platform ▼
            </button>

            {platformOpen && (
              <div style={dropdown} role="menu">
                {PLATFORM_LINKS.map(([name, path]) => (
                  <Link
                    key={path}
                    href={path}
                    style={dropItem}
                    role="menuitem"
                    onClick={() => {
                      setPlatformOpen(false);
                      setMobileOpen(false);
                    }}
                  >
                    {name}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Announcements */}
          <div style={{ position: "relative" }}>
            <button
              type="button"
              style={{ ...link, ...dropdownTriggerReset }}
              aria-haspopup="true"
              aria-expanded={announcementOpen}
              onClick={() => {
                setAnnouncementOpen(!announcementOpen);
                setPlatformOpen(false);
              }}
            >
              📢 Announcements
              {announcements.length > 0 && (
                <span style={announcementBadge}>{announcements.length}</span>
              )}
              {" ▼"}
            </button>

            {announcementOpen && (
              <div style={announcementDropdown} role="menu">
                {announcements.length === 0 && (
                  <div style={{ padding: "16px 18px", color: "#94a3b8", fontSize: 14 }}>
                    No announcements right now.
                  </div>
                )}

                {announcements.map((item) => {
                  const isExpanded = expandedId === item.id;
                  return (
                    <div
                      key={item.id}
                      role="menuitem"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : item.id)
                      }
                      style={announcementItem}
                    >
                      <div style={announcementTitleRow}>
                        <span style={{ fontWeight: 700, color: "#111827" }}>
                          {item.title}
                        </span>
                        <span style={{ color: "#94a3b8", fontSize: 12 }}>
                          {isExpanded ? "▲" : "▼"}
                        </span>
                      </div>

                      {item.createdAt?.toDate && (
                        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                          {item.createdAt.toDate().toLocaleDateString()}
                        </div>
                      )}

                      {isExpanded && (
                        <div style={announcementMessage}>{item.message}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Auth buttons (shown inline in mobile menu) */}
          <div className="navbar-auth-mobile">
            {!authLoading && (user ? (
              <button onClick={handleLogout} style={logoutBtn}>
                🚪 Logout
              </button>
            ) : (
              <>
                <Link href="/login" onClick={() => setMobileOpen(false)}>
                  <button style={employeeBtn}>Employee Login</button>
                </Link>
                <Link href="/admin/login" onClick={() => setMobileOpen(false)}>
                  <button style={adminBtn}>Admin Login</button>
                </Link>
              </>
            ))}
          </div>
        </div>

        {/* Auth buttons (desktop) */}
        <div
          className="navbar-auth-desktop"
          style={{
            display: "flex",
            gap: "12px",
            marginLeft: "24px",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          {!authLoading && (user ? (
            <button onClick={handleLogout} style={logoutBtn}>
              🚪 Logout
            </button>
          ) : (
            <>
              <Link href="/login">
                <button style={employeeBtn}>Employee Login</button>
              </Link>
              <Link href="/admin/login">
                <button style={adminBtn}>Admin Login</button>
              </Link>
            </>
          ))}
        </div>
      </div>

      <style jsx>{`
        .navbar-menu {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 26px;
          flex: 1;
        }
        @media (max-width: 900px) {
          .navbar-toggle {
            display: block !important;
          }
          .navbar-menu {
            display: none;
          }
          .navbar-menu-open {
            display: flex !important;
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: #fff;
            flex-direction: column;
            align-items: flex-start;
            padding: 20px 32px;
            gap: 16px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.12);
          }
          .navbar-auth-desktop {
            display: none !important;
          }
          .navbar-auth-mobile {
            display: flex;
            gap: 12px;
            margin-top: 10px;
          }
        }
        @media (min-width: 901px) {
          .navbar-auth-mobile {
            display: none;
          }
        }
      `}</style>
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
  display: "flex",
  alignItems: "center",
  gap: "6px",
};

const dropdownTriggerReset: CSSProperties = {
  background: "none",
  border: "none",
  font: "inherit",
};

const dropdown: CSSProperties = {
  position: "absolute",
  top: "100%",
  left: 0,
  marginTop: 8,
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

const announcementBadge: CSSProperties = {
  background: "#dc2626",
  color: "#fff",
  fontSize: 11,
  fontWeight: 700,
  borderRadius: 999,
  padding: "1px 7px",
  lineHeight: 1.5,
};

const announcementDropdown: CSSProperties = {
  position: "absolute",
  top: "100%",
  right: 0,
  marginTop: 8,
  width: 320,
  maxWidth: "90vw",
  maxHeight: 420,
  overflowY: "auto",
  background: "#fff",
  borderRadius: 12,
  boxShadow: "0 10px 25px rgba(0,0,0,.12)",
  zIndex: 9999,
};

const announcementItem: CSSProperties = {
  padding: "14px 18px",
  borderBottom: "1px solid #eee",
  cursor: "pointer",
};

const announcementTitleRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
};

const announcementMessage: CSSProperties = {
  marginTop: 10,
  fontSize: 14,
  color: "#4b5563",
  lineHeight: 1.5,
  whiteSpace: "pre-wrap",
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
  background: "#dc2626",
  color: "#fff",
  border: "none",
  padding: "10px 18px",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: "15px",
};

// // "use client";

// // import Link from "next/link";
// // import { useState, useEffect, useRef, CSSProperties } from "react";
// // import { onAuthStateChanged, signOut, User } from "firebase/auth";
// // import { auth } from "../lib/firebase";
// // import { usePathname } from "next/navigation";

// // const PLATFORM_LINKS: [string, string][] = [
// //   ["Attendance", "/attendance"],
// //   ["Leave", "/leave"],
// //   ["Timesheets", "/timesheet"],
// //   ["Performance", "/performance"],
// //   ["Documents", "/documents"],
// //   ["AI Production", "/ai-production"],
// //   ["Reports", "/reports"],
// // ];

// // const SOLUTION_LINKS: [string, string][] = [
// //   ["HR Management", "/solutions/hr"],
// //   ["Employee Portal", "/dashboard"],
// //   ["Admin Portal", "/admin"],
// //   ["AI Production", "/ai-production"],
// // ];

// // export default function Navbar() {
// //   const [platformOpen, setPlatformOpen] = useState(false);
// //   const [solutionOpen, setSolutionOpen] = useState(false);
// //   const [mobileOpen, setMobileOpen] = useState(false);
// //   const [user, setUser] = useState<User | null>(null);
// //   const [authLoading, setAuthLoading] = useState(true);

// //   const pathname = usePathname();
// //   const navRef = useRef<HTMLDivElement>(null);

// //   useEffect(() => {
// //     const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
// //       setUser(currentUser);
// //       setAuthLoading(false);
// //     });
// //     return () => unsubscribe();
// //   }, []);

// //   const handleLogout = async () => {
// //     try {
// //       await signOut(auth);
// //       window.location.href = "/login";
// //     } catch (error) {
// //       console.log("Logout error:", error);
// //     }
// //   };

// //   useEffect(() => {
// //     function handleClickOutside(event: MouseEvent) {
// //       if (
// //         navRef.current &&
// //         event.target instanceof Node &&
// //         !navRef.current.contains(event.target)
// //       ) {
// //         setPlatformOpen(false);
// //         setSolutionOpen(false);
// //       }
// //     }
// //     function handleEscape(event: KeyboardEvent) {
// //       if (event.key === "Escape") {
// //         setPlatformOpen(false);
// //         setSolutionOpen(false);
// //         setMobileOpen(false);
// //       }
// //     }
// //     document.addEventListener("mousedown", handleClickOutside);
// //     document.addEventListener("keydown", handleEscape);
// //     return () => {
// //       document.removeEventListener("mousedown", handleClickOutside);
// //       document.removeEventListener("keydown", handleEscape);
// //     };
// //   }, []);

// //   const hideNavbar =
// //     pathname.startsWith("/dashboard") ||
// //     pathname.startsWith("/workspace") ||
// //     pathname.startsWith("/attendance") ||
// //     pathname.startsWith("/leave") ||
// //     pathname.startsWith("/timesheet") ||
// //     pathname.startsWith("/documents") ||
// //     pathname.startsWith("/admin") ||
// //     pathname.startsWith("/settings");

// //   if (hideNavbar) {
// //     return null;
// //   }

// //   return (
// //     <nav
// //       style={{
// //         position: "sticky",
// //         top: 0,
// //         zIndex: 999,
// //         background: "#fff",
// //         boxShadow: "0 2px 15px rgba(0,0,0,.08)",
// //       }}
// //     >
// //       <div
// //         className="navbar-inner"
// //         style={{
// //           width: "100%",
// //           padding: "14px 32px",
// //           display: "flex",
// //           alignItems: "center",
// //           justifyContent: "space-between",
// //           boxSizing: "border-box",
// //         }}
// //       >
// //         {/* Logo */}
// //         <div
// //           style={{
// //             display: "flex",
// //             alignItems: "center",
// //             gap: 18,
// //             flexShrink: 0,
// //           }}
// //         >
// //           <img
// //             src="/logo.ico"
// //             alt="OMTATVA Digitals logo"
// //             style={{ width: 58, height: 58, objectFit: "contain" }}
// //           />
// //           <div>
// //             <h2
// //               style={{
// //                 margin: 0,
// //                 color: "#3d6fa8",
// //                 fontSize: "24px",
// //                 fontWeight: 800,
// //                 lineHeight: 1.1,
// //               }}
// //             >
// //               OMTATVA DIGITALS
// //             </h2>
// //             <p style={{ margin: "2px 0 0", color: "#666", fontSize: "13px" }}>
// //               Driven by Stories • Powered by AI
// //             </p>
// //           </div>
// //         </div>

// //         {/* Mobile toggle */}
// //         <button
// //           className="navbar-toggle"
// //           aria-label={mobileOpen ? "Close menu" : "Open menu"}
// //           aria-expanded={mobileOpen}
// //           onClick={() => setMobileOpen(!mobileOpen)}
// //           style={{
// //             display: "none",
// //             background: "none",
// //             border: "none",
// //             fontSize: 26,
// //             cursor: "pointer",
// //             color: "#1f2937",
// //           }}
// //         >
// //           {mobileOpen ? "✕" : "☰"}
// //         </button>

// //         {/* Menu */}
// //         <div
// //           ref={navRef}
// //           className={`navbar-menu ${mobileOpen ? "navbar-menu-open" : ""}`}
// //         >
// //           <Link href="/#top" style={link} onClick={() => setMobileOpen(false)}>
// //             Home
// //           </Link>

// //           {/* Platform */}
// //           <div style={{ position: "relative" }}>
// //             <button
// //               type="button"
// //               style={{ ...link, ...dropdownTriggerReset }}
// //               aria-haspopup="true"
// //               aria-expanded={platformOpen}
// //               onClick={() => {
// //                 setPlatformOpen(!platformOpen);
// //                 setSolutionOpen(false);
// //               }}
// //             >
// //               Platform ▼
// //             </button>

// //             {platformOpen && (
// //               <div style={dropdown} role="menu">
// //                 {PLATFORM_LINKS.map(([name, path]) => (
// //                   <Link
// //                     key={path}
// //                     href={path}
// //                     style={dropItem}
// //                     role="menuitem"
// //                     onClick={() => {
// //                       setPlatformOpen(false);
// //                       setMobileOpen(false);
// //                     }}
// //                   >
// //                     {name}
// //                   </Link>
// //                 ))}
// //               </div>
// //             )}
// //           </div>

// //           {/* Solutions */}
// //           <div style={{ position: "relative" }}>
// //             <button
// //               type="button"
// //               style={{ ...link, ...dropdownTriggerReset }}
// //               aria-haspopup="true"
// //               aria-expanded={solutionOpen}
// //               onClick={() => {
// //                 setSolutionOpen(!solutionOpen);
// //                 setPlatformOpen(false);
// //               }}
// //             >
// //               Solutions ▼
// //             </button>

// //             {solutionOpen && (
// //               <div style={dropdown} role="menu">
// //                 {SOLUTION_LINKS.map(([name, path]) => (
// //                   <Link
// //                     key={path}
// //                     href={path}
// //                     style={dropItem}
// //                     role="menuitem"
// //                     onClick={() => {
// //                       setSolutionOpen(false);
// //                       setMobileOpen(false);
// //                     }}
// //                   >
// //                     {name}
// //                   </Link>
// //                 ))}
// //               </div>
// //             )}
// //           </div>

// //           {/* Auth buttons (shown inline in mobile menu) */}
// //           <div className="navbar-auth-mobile">
// //             {!authLoading && (user ? (
// //               <button onClick={handleLogout} style={logoutBtn}>
// //                 🚪 Logout
// //               </button>
// //             ) : (
// //               <>
// //                 <Link href="/login" onClick={() => setMobileOpen(false)}>
// //                   <button style={employeeBtn}>Employee Login</button>
// //                 </Link>
// //                 <Link href="/admin/login" onClick={() => setMobileOpen(false)}>
// //                   <button style={adminBtn}>Admin Login</button>
// //                 </Link>
// //               </>
// //             ))}
// //           </div>
// //         </div>

// //         {/* Auth buttons (desktop) */}
// //         <div
// //           className="navbar-auth-desktop"
// //           style={{
// //             display: "flex",
// //             gap: "12px",
// //             marginLeft: "24px",
// //             alignItems: "center",
// //             flexShrink: 0,
// //           }}
// //         >
// //           {!authLoading && (user ? (
// //             <button onClick={handleLogout} style={logoutBtn}>
// //               🚪 Logout
// //             </button>
// //           ) : (
// //             <>
// //               <Link href="/login">
// //                 <button style={employeeBtn}>Employee Login</button>
// //               </Link>
// //               <Link href="/admin/login">
// //                 <button style={adminBtn}>Admin Login</button>
// //               </Link>
// //             </>
// //           ))}
// //         </div>
// //       </div>

// //       <style jsx>{`
// //         .navbar-menu {
// //           display: flex;
// //           align-items: center;
// //           justify-content: center;
// //           gap: 26px;
// //           flex: 1;
// //         }
// //         @media (max-width: 900px) {
// //           .navbar-toggle {
// //             display: block !important;
// //           }
// //           .navbar-menu {
// //             display: none;
// //           }
// //           .navbar-menu-open {
// //             display: flex !important;
// //             position: absolute;
// //             top: 100%;
// //             left: 0;
// //             right: 0;
// //             background: #fff;
// //             flex-direction: column;
// //             align-items: flex-start;
// //             padding: 20px 32px;
// //             gap: 16px;
// //             box-shadow: 0 10px 25px rgba(0, 0, 0, 0.12);
// //           }
// //           .navbar-auth-desktop {
// //             display: none !important;
// //           }
// //           .navbar-auth-mobile {
// //             display: flex;
// //             gap: 12px;
// //             margin-top: 10px;
// //           }
// //         }
// //         @media (min-width: 901px) {
// //           .navbar-auth-mobile {
// //             display: none;
// //           }
// //         }
// //       `}</style>
// //     </nav>
// //   );
// // }

// // const link: CSSProperties = {
// //   color: "#1f2937",
// //   textDecoration: "none",
// //   fontWeight: 600,
// //   fontSize: "17px",
// //   padding: "8px 0",
// //   cursor: "pointer",
// //   transition: "0.25s",
// // };

// // const dropdownTriggerReset: CSSProperties = {
// //   background: "none",
// //   border: "none",
// //   font: "inherit",
// // };

// // const dropdown: CSSProperties = {
// //   position: "absolute",
// //   top: "100%",
// //   left: 0,
// //   marginTop: 8,
// //   width: 220,
// //   background: "#fff",
// //   borderRadius: 12,
// //   boxShadow: "0 10px 25px rgba(0,0,0,.12)",
// //   display: "flex",
// //   flexDirection: "column",
// //   overflow: "hidden",
// //   zIndex: 9999,
// // };

// // const dropItem: CSSProperties = {
// //   padding: "12px 18px",
// //   textDecoration: "none",
// //   color: "#333",
// //   fontSize: "15px",
// //   fontWeight: 500,
// //   borderBottom: "1px solid #eee",
// // };

// // const employeeBtn: CSSProperties = {
// //   background: "#3d6fa8",
// //   color: "#fff",
// //   border: "none",
// //   padding: "10px 18px",
// //   borderRadius: 8,
// //   cursor: "pointer",
// //   fontWeight: 600,
// //   fontSize: "15px",
// // };

// // const adminBtn: CSSProperties = {
// //   background: "#111827",
// //   color: "#fff",
// //   border: "none",
// //   padding: "10px 18px",
// //   borderRadius: 8,
// //   cursor: "pointer",
// //   fontWeight: 600,
// //   fontSize: "15px",
// // };

// // const logoutBtn: CSSProperties = {
// //   background: "#dc2626",
// //   color: "#fff",
// //   border: "none",
// //   padding: "10px 18px",
// //   borderRadius: 8,
// //   cursor: "pointer",
// //   fontWeight: 600,
// //   fontSize: "15px",
// // };