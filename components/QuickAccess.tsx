"use client";

import Link from "next/link";


export default function QuickAccess() {
  return (
    <section
  style={{
    padding: "40px 5%",
    background: "#f7fbff",
  }}
>
  <h2
    style={{
      fontSize: "38px",
      color: "#111111",
      marginBottom: "10px",
      textAlign: "center",
    }}
  >
    🚀 Quick Access
  </h2>

  <p
    style={{
      textAlign: "center",
      color: "#444444",
      marginBottom: "40px",
      fontSize: "18px",
    }}
  >
    Access all HR and AI Production modules from one place.
  </p>

  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
      gap: "25px",
    }}
  >
    {[
  {
    title: "Attendance",
    icon: "🕒",
    desc: "Punch In & Attendance History",
    link: "/attendance",
  },
  {
    title: "Timesheets",
    icon: "📋",
    desc: "Submit daily work logs",
    link: "/timesheet",
  },
  {
    title: "Leave",
    icon: "🏖",
    desc: "Apply & Track Leave",
    link: "/leave",
  },
  {
    title: "Employee Dashboard",
    icon: "👤",
    desc: "View your performance",
    link: "/dashboard",
  },
  {
    title: "Admin Dashboard",
    icon: "👨‍💼",
    desc: "Manage employees",
    link: "/admin",
  },
  {
    title: "Documents",
    icon: "📄",
    desc: "Payslips & HR Docs",
    link: "/documents",
  },
  {
    title: "Reports",
    icon: "📊",
    desc: "Analytics & Reports",
    link: "/reports",
  },
  {
    title: "Users",
    icon: "👥",
    desc: "Employee Directory",
    link: "/users",
  },
].map((item) => (
  <Link
    key={item.title}
    href={item.link}
    style={{
      textDecoration: "none",
      color: "inherit",
    }}
  >
    <div
      style={{
        background: "#ffffff",
        borderRadius: "22px",
        padding: "30px",
        border: "1px solid #eaf3ff",
        boxShadow: "0 12px 35px rgba(61,111,168,.12)",
        cursor: "pointer",
      }}
    >
      <div
        style={{
          width: "70px",
          height: "70px",
          borderRadius: "18px",
          background: "#eaf3ff",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontSize: "34px",
          marginBottom: "20px",
        }}
      >
        {item.icon}
      </div>

      <h3
        style={{
          color: "#111",
          marginBottom: "10px",
        }}
      >
        {item.title}
      </h3>

      <p
        style={{
          color: "#666",
          lineHeight: 1.7,
        }}
      >
        {item.desc}
      </p>
    </div>
  </Link>
))}
        
  </div>
</section>
  );
}