"use client";

import Link from "next/link";
import {
  Palette,
  Image,
  Video,
  LayoutDashboard,
  Users,
  Bell,
  Shield,
  Database,
  CalendarRange,
} from "lucide-react";

// Access to this whole section (and every /settings/* sub-route) is
// enforced once, centrally, in app/settings/layout.tsx via useAccess().
export default function SettingsPage() {
  const settings = [
    {
      title: "Appearance",
      icon: <Palette size={24} />,
      desc: "Theme, colors and layout settings",
      link: "/settings/appearance",
    },
    {
      title: "Branding",
      icon: <Image size={24} />,
      desc: "Logo, company name and images",
      link: "/settings/branding",
    },
    {
      title: "Media Manager",
      icon: <Video size={24} />,
      desc: "Videos, banners and dashboard media",
      link: "/settings/media",
    },
    {
      title: "Dashboard Layout",
      icon: <LayoutDashboard size={24} />,
      desc: "Manage dashboard cards and widgets",
      link: "/settings/dashboard",
    },
    {
      title: "Access Management",
      icon: <Users size={24} />,
      desc: "Admin users, roles and permissions",
      link: "/settings/access",
    },
    {
      title: "Leave Policy",
      icon: <CalendarRange size={24} />,
      desc: "Casual, sick and paid leave quotas",
      link: "/settings/leave-policy",
    },
    {
      title: "Notifications",
      icon: <Bell size={24} />,
      desc: "Alerts and announcements",
      link: "/settings/notifications",
    },
    {
      title: "Security",
      icon: <Shield size={24} />,
      desc: "Password and login settings",
      link: "/settings/security",
    },
    {
      title: "Backup",
      icon: <Database size={24} />,
      desc: "Export and restore settings",
      link: "/settings/backup",
    },
  ];

  return (
    <div style={{ padding: "20px" }}>
      <style jsx global>{`
        @media (max-width: 600px) {
          .settings-title {
            font-size: 22px !important;
          }
          .settings-grid {
            grid-template-columns: 1fr !important;
            gap: 14px !important;
          }
          .settings-card {
            height: auto !important;
            padding: 18px !important;
          }
        }
      `}</style>

      <h1
        className="settings-title"
        style={{
          fontSize: "28px",
          fontWeight: 700,
          marginBottom: 22,
          color: "var(--text-color)",
        }}
      >
        ⚙ Settings
      </h1>

      <div
        className="settings-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
          gap: 20,
        }}
      >
        {settings.map((item) => (
          <Link
            key={item.title}
            href={item.link}
            style={{
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div
              className="settings-card"
              style={{
                background: "var(--card-bg)",
                padding: "25px",
                borderRadius: "16px",
                boxShadow: "0 5px 20px rgba(0,0,0,.05)",
                cursor: "pointer",
                height: "150px",
                boxSizing: "border-box",
                transition: "transform .2s ease, box-shadow .2s ease",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  fontSize: 18,
                  fontWeight: 600,
                  color: "#3d6fa8",
                }}
              >
                {item.icon}
                {item.title}
              </div>

              <p
                style={{
                  color: "var(--text-muted)",
                  marginTop: 15,
                  fontSize: 14,
                }}
              >
                {item.desc}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}