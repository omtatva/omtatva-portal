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
  style={{
    flex: 1,
    marginLeft: sidebarOpen ? "260px" : "80px",
    transition: "margin-left 0.3s ease",
    padding: "20px",
    background: "#F5F7FB",
    overflowY: "auto",
  }}
>
  {children}
</main>
      </div>
    </div>
  );
}