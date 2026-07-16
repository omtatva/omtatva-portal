"use client";

import Link from "next/link";

export default function Features() {
  const features = [
    {
      icon: "🕒",
      title: "Attendance Management",
      desc: "Smart check-in, check-out and attendance analytics.",
      link: "/attendance",
    },
    {
      icon: "📋",
      title: "Timesheet Tracking",
      desc: "Log project hours and manage daily productivity.",
      link: "/timesheet",
    },
    {
      icon: "🏖️",
      title: "Leave Management",
      desc: "Apply, approve and monitor employee leave digitally.",
      link: "/leave",
    },
    {
      icon: "⭐",
      title: "Performance Reviews",
      desc: "Evaluate employees with structured performance reviews.",
      link: "/performance",
    },
    {
      icon: "💰",
      title: "Payroll",
      desc: "Generate salary slips and manage payroll securely.",
      link: "/payroll",
    },
    {
      icon: "📄",
      title: "Documents",
      desc: "Store payslips, contracts and HR documents safely.",
      link: "/documents",
    },
    {
      icon: "🤖",
      title: "AI Production",
      desc: "Manage AI filmmaking workflows using modern AI tools.",
      link: "/production",
    },
    {
      icon: "📊",
      title: "Reports & Analytics",
      desc: "Interactive dashboards with business insights.",
      link: "/reports",
    },
  ];

  return (
    <section
      style={{
        margin: "70px auto",
        padding: "0 50px",
      }}
    >
      <div
        style={{
          textAlign: "center",
          marginBottom: 45,
        }}
      >
        <p
          style={{
            color: "#3d6fa8",
            fontWeight: 700,
            letterSpacing: 2,
            fontSize: 14,
            marginBottom: 8,
          }}
        >
          PLATFORM FEATURES
        </p>

        <h2
          style={{
            fontSize: 34,
            margin: "0 0 12px",
            color: "#111",
          }}
        >
          Everything You Need In One Platform
        </h2>

        <p
          style={{
            maxWidth: 650,
            margin: "0 auto",
            color: "#555",
            fontSize: 17,
            lineHeight: 1.6,
          }}
        >
          Designed for HR teams, employees and AI production companies with
          secure, cloud-based workflows.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
          gap: 22,
        }}
      >
        {features.map((item) => (
          <div
            key={item.title}
            style={{
              background: "#fff",
              borderRadius: 18,
              padding: 24,
              border: "1px solid #e8eef8",
              boxShadow: "0 8px 22px rgba(0,0,0,.06)",
            }}
          >
            <div
              style={{
                width: 58,
                height: 58,
                borderRadius: 14,
                background: "#eef6ff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                marginBottom: 18,
              }}
            >
              {item.icon}
            </div>

            <h3
              style={{
                color: "#111",
                fontSize: 22,
                margin: "0 0 10px",
              }}
            >
              {item.title}
            </h3>

            <p
              style={{
                color: "#666",
                lineHeight: 1.6,
                fontSize: 15,
                minHeight: 70,
              }}
            >
              {item.desc}
            </p>

            <Link href={item.link}>
              <button
                style={{
                  marginTop: 18,
                  background: "#3d6fa8",
                  color: "#fff",
                  border: "none",
                  padding: "10px 18px",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                Learn More →
              </button>
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}