

"use client";

import Link from "next/link";
import { useState, useEffect, useRef, CSSProperties } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth } from "../lib/firebase";
import { usePathname } from "next/navigation";

const PLATFORM_LINKS: [string, string][] = [
  ["Attendance", "/attendance"],
  ["Leave", "/leave"],
  ["Timesheets", "/timesheet"],
  ["Performance", "/performance"],
  ["Documents", "/documents"],
  ["AI Production", "/ai-production"],
  ["Reports", "/reports"],
];

const SOLUTION_LINKS: [string, string][] = [
  ["HR Management", "/solutions/hr"],
  ["Employee Portal", "/dashboard"],
  ["Admin Portal", "/admin"],
  ["AI Production", "/ai-production"],
];

export default function Navbar() {
  const [platformOpen, setPlatformOpen] = useState(false);
  const [solutionOpen, setSolutionOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const pathname = usePathname();
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
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

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        navRef.current &&
        event.target instanceof Node &&
        !navRef.current.contains(event.target)
      ) {
        setPlatformOpen(false);
        setSolutionOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPlatformOpen(false);
        setSolutionOpen(false);
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
    pathname.startsWith("/workspace") ||
    pathname.startsWith("/attendance") ||
    pathname.startsWith("/leave") ||
    pathname.startsWith("/timesheet") ||
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
            src="/logo.ico"
            alt="OMTATVA Digitals logo"
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
              OMTATVA DIGITALS
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
                setSolutionOpen(false);
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

          {/* Solutions */}
          <div style={{ position: "relative" }}>
            <button
              type="button"
              style={{ ...link, ...dropdownTriggerReset }}
              aria-haspopup="true"
              aria-expanded={solutionOpen}
              onClick={() => {
                setSolutionOpen(!solutionOpen);
                setPlatformOpen(false);
              }}
            >
              Solutions ▼
            </button>

            {solutionOpen && (
              <div style={dropdown} role="menu">
                {SOLUTION_LINKS.map(([name, path]) => (
                  <Link
                    key={path}
                    href={path}
                    style={dropItem}
                    role="menuitem"
                    onClick={() => {
                      setSolutionOpen(false);
                      setMobileOpen(false);
                    }}
                  >
                    {name}
                  </Link>
                ))}
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