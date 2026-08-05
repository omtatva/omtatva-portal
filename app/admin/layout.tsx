"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import DashboardNavbar from "@/components/DashboardNavbar";

// Routes under /admin/* that are NOT part of the authenticated shell —
// they should render standalone, without Sidebar/DashboardNavbar around
// them. Add any other public admin-side routes here (e.g. a password
// reset page) as they're built.
const PUBLIC_ADMIN_ROUTES = ["/admin/login"];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const pathname = usePathname();

  const isPublicRoute = PUBLIC_ADMIN_ROUTES.includes(pathname);

  if (isPublicRoute) {
    return <>{children}</>;
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
      {/* Responsive rules: inline styles can't hold media queries, so the
          mobile sidebar/content behavior lives here. Below 768px the
          sidebar is treated as an overlay drawer (fixed, slides over the
          content) instead of pushing content with margin-left, and the
          main content always takes the full width. */}
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
      <DashboardNavbar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

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
    transition: "margin-left .2s ease, background 0.2s ease",
    padding: "20px",
    background: "var(--bg-color)",
    color: "var(--text-color)",
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