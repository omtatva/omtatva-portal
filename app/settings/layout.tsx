"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import DashboardNavbar from "@/components/DashboardNavbar";
import AccessRestricted from "@/components/AccessRestricted";
import { useAccess } from "@/lib/useAccess";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { authReady, authUser, roleReady, isSuperAdmin } = useAccess();

  // Gate every /settings/* route here (not just the hub page) — previously
  // only app/settings/page.tsx checked access, so any settings sub-page
  // was reachable directly by URL with no check at all.
  useEffect(() => {
    if (authReady && !authUser) {
      window.location.href = "/admin/login";
    }
  }, [authReady, authUser]);

  const checking = !authReady || (!!authUser && !roleReady);

  if (checking) {
    return null;
  }

  if (!authUser) {
    return null;
  }

  if (!isSuperAdmin) {
    return (
      <AccessRestricted message="Only IT Support / Super Admin can view or change platform settings. Contact them if you need something changed here." />
    );
  }

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Responsive rules: below 768px the sidebar becomes a fixed
          overlay drawer (slides over the content, with a tap-to-close
          backdrop) instead of pushing content with margin-left, and
          the main content always takes the full width. */}
      <style jsx global>{`
        @media (max-width: 768px) {
          .dashboard-main-content {
            margin-left: 0 !important;
            padding: 14px !important;
          }
          .dashboard-sidebar-wrapper {
            position: fixed !important;
            top: 0;
            left: 0;
            height: 100vh;
            z-index: 1000;
            transform: ${sidebarOpen ? "translateX(0)" : "translateX(-100%)"};
            transition: transform 0.25s ease;
            box-shadow: ${sidebarOpen ? "0 0 30px rgba(0,0,0,.25)" : "none"};
          }
          .dashboard-sidebar-backdrop {
            display: ${sidebarOpen ? "block" : "none"};
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.45);
            z-index: 999;
          }
        }
        @media (min-width: 769px) {
          .dashboard-sidebar-backdrop {
            display: none;
          }
        }
      `}</style>

      {/* Top Navbar */}
      <DashboardNavbar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      {/* Sidebar + Content */}
      <div
        style={{
          display: "flex",
          flex: 1,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Tapping outside the sidebar on mobile closes it */}
        <div
          className="dashboard-sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
        />

        <div className="dashboard-sidebar-wrapper">
          <Sidebar open={sidebarOpen} />
        </div>

        <main
          className="dashboard-main-content"
          style={{
            flex: 1,
            marginLeft: sidebarOpen ? "260px" : "80px",
            transition: "margin-left 0.3s ease",
            padding: "20px",
            background: "var(--bg-color)",
            overflowY: "auto",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}