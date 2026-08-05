"use client";

import { useEffect, useState } from "react";
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
  Lock,
} from "lucide-react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

// Only these accounts can view/change platform settings. Matches the
// same email-whitelist pattern used for Bank Details access
// (BankDetails.tsx's isAdminOrIT check) — update this list to add or
// remove IT Support accounts.
const ALLOWED_SETTINGS_EMAILS = [
  "itsupport@omtatvadigitals.com",
];

export default function SettingsPage() {
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        window.location.href = "/admin/login";
        return;
      }

      const email = user.email?.toLowerCase() || "";
      setHasAccess(ALLOWED_SETTINGS_EMAILS.includes(email));
      setCheckingAccess(false);
    });

    return () => unsubscribe();
  }, []);

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

  if (checkingAccess) {
    return null;
  }

  if (!hasAccess) {
    return (
      <div
        style={{
          padding: "25px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "70vh",
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 20,
            padding: "40px 30px",
            textAlign: "center",
            maxWidth: 420,
            boxShadow: "0 10px 30px rgba(0,0,0,.06)",
          }}
        >
          <div
            style={{
              width: 60,
              height: 60,
              margin: "0 auto 18px",
              borderRadius: "50%",
              background: "#fee2e2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#dc2626",
            }}
          >
            <Lock size={28} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 10px" }}>
            Access Restricted
          </h2>
          <p style={{ color: "#64748b", fontSize: 14.5, margin: 0 }}>
            Only IT Support can view or change platform settings. Contact IT
            Support if you need something changed here.
          </p>
        </div>
      </div>
    );
  }

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
                background: "#fff",
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
                  color: "#64748B",
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