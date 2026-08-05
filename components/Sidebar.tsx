"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { appSettings } from "@/config/appSettings";

import {
  Home,
  LayoutDashboard,
  Bot,
  Clock3,
  CalendarCheck2,
  FileText,
  FolderOpen,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";

const menus = [
  { title: "Home", href: "/#top", icon: Home },
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "AI Workspace", href: "/workspace", icon: Bot },
  { title: "Attendance", href: "/attendance", icon: Clock3 },
  { title: "Timesheets", href: "/timesheet", icon: CalendarCheck2 },
  { title: "Leave", href: "/leave", icon: FileText },
  { title: "Documents", href: "/documents", icon: FolderOpen },
  { title: "Admin", href: "/admin", icon: Users },
  { title: "Settings", href: "/settings", icon: Settings },
];

// Titles that are hidden from regular employees — everyone else
// (Admin / HR) sees every item in `menus`.
const ADMIN_ONLY_MENU = ["Admin", "Settings"];

// Must match the exact role values AdminLoginPage.js writes to
// users/{uid}.role — currently just "admin" and "hr" (no "owner").
const ADMIN_ROLES = ["admin", "hr"];

export default function Sidebar({ open }: { open: boolean }) {
  const pathname = usePathname();
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [userRole, setUserRole] = useState<string>("");

  // Mobile drawer state — fully separate from the desktop `open`
  // (260px / 80px) collapse prop passed in from the parent layout.
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setAuthUser(u);
      setAuthReady(true);
    });
    return () => unsubscribeAuth();
  }, []);

  // Read the role straight from Firestore (users/{uid}) — the same
  // document AdminLoginPage.js writes — instead of relying on a
  // separate hardcoded appSettings.access.users list that can drift out
  // of sync. onSnapshot also means a role change is picked up live,
  // without a manual logout/login.
  useEffect(() => {
    if (!authUser) {
      setUserRole("");
      return;
    }

    const userRef = doc(db, "users", authUser.uid);

    const unsubscribeRole = onSnapshot(
      userRef,
      (snap) => {
        const role = snap.exists() ? snap.data()?.role : "";
        setUserRole(role || "");
      },
      (error) => {
        console.log("Sidebar role fetch error:", error);
      }
    );

    return () => unsubscribeRole();
  }, [authUser]);

  // Close the mobile drawer automatically whenever the route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Optional legacy fallback: still honor appSettings.access.users if an
  // email is explicitly listed there, in case that config is used for
  // people without a matching Firestore role field.
  const legacyUser = appSettings.access?.users?.find(
    (u: any) => u.email === authUser?.email
  );
  const legacyIsAdmin =
    !!legacyUser && ADMIN_ROLES.includes(String(legacyUser.role || "").toLowerCase());

  const isAdminTier =
    ADMIN_ROLES.includes(userRole.toLowerCase()) || legacyIsAdmin;

  const visibleMenus = menus.filter((menu) => {
    if (menu.title === "Home") {
      return true;
    }

    // Not logged in yet / auth still resolving -> only Home shows
    if (!authReady || !authUser) {
      return false;
    }

    // Admin / HR -> every menu item
    if (isAdminTier) {
      return true;
    }

    // Everyone else (regular employees) -> everything except Admin/Settings
    return !ADMIN_ONLY_MENU.includes(menu.title);
  });

  const handleLogout = async () => {
    try {
      await signOut(auth);
      window.location.href = "/login";
    } catch (error) {
      console.log("Logout error:", error);
    }
  };

  return (
    <>
      {/* Mobile-only hamburger button — hidden on desktop via CSS */}
      <button
        className="mobileSidebarToggle"
        aria-label={mobileOpen ? "Close menu" : "Open menu"}
        onClick={() => setMobileOpen((prev) => !prev)}
      >
        {mobileOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      {/* Dark backdrop behind the drawer — mobile only, tap to close */}
      <div
        className={`sidebarBackdrop ${mobileOpen ? "show" : ""}`}
        onClick={() => setMobileOpen(false)}
      />

      <aside
  className={`sidebar ${mobileOpen ? "mobileOpen" : ""}`}
  style={{
    width: open ? "260px" : "80px",
    background: "var(--card-bg)",
    transition: "width 0.2s ease, background 0.2s ease",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    height: "100vh",
    boxSizing: "border-box",
  }}
>
        <nav>
          {visibleMenus.map((menu) => {
            const Icon = menu.icon;
            const isActive = pathname === menu.href;

            return (
              <Link
                key={menu.href}
                href={menu.href}
                aria-current={isActive ? "page" : undefined}
                className={isActive ? "active" : ""}
                style={{
                  justifyContent: open ? "flex-start" : "center",
                }}
              >
                <span className="iconBox">
                  <Icon size={20} />
                </span>

                {open && <span>{menu.title}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div
          style={{
            padding: "16px",
            borderTop: "1px solid var(--border-color)",
          }}
        >
          <button
            onClick={handleLogout}
            aria-label="Logout"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: open ? "flex-start" : "center",
              gap: 10,
              width: "100%",
              border: "none",
              background: "transparent",
              color: "#dc2626",
              cursor: "pointer",
              padding: "10px 8px",
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 15,
            }}
          >
            <LogOut size={20} />
            {open && <span>Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
}