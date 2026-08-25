"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import DashboardNavbar from "@/components/DashboardNavbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Main content's left margin mirrors the desktop sidebar width
          (260px open / 80px collapsed) so content never sits under it.
          On mobile the Sidebar turns into an off-canvas drawer instead
          (see Sidebar.tsx's mobileOpen/backdrop), so that margin no
          longer applies there — it's zeroed out below, and padding
          shrinks too so content isn't cramped on small screens. */}
      <style jsx>{`
        .dash-main {
          margin-left: ${sidebarOpen ? "260px" : "80px"};
          padding: 20px;
        }
        @media (max-width: 768px) {
          .dash-main {
            margin-left: 0 !important;
            padding: 14px !important;
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
        }}
      >
        <Sidebar open={sidebarOpen} />

        <main
          className="dash-main"
          style={{
            flex: 1,
            transition: "margin-left 0.3s ease",
            backgroundColor: "var(--brand-bg, var(--bg-color))",
            backgroundImage: "var(--brand-bg-image, none)",
            backgroundSize: "cover",
            backgroundPosition: "center",
            overflowY: "auto",
            boxSizing: "border-box",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}