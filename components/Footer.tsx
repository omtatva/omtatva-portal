// 

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

const DEFAULT_BRANDING = {
  companyName: "OMTATVA DIGITALS",
  logo: "/logo.ico",
};

const QUICK_LINKS = [
  { name: "Home", link: "/#top" },
  { name: "Attendance", link: "/attendance" },
  { name: "Timesheets", link: "/timesheet" },
  { name: "Leave", link: "/leave" },
  { name: "Dashboard", link: "/dashboard" },
  { name: "Admin", link: "/admin" },
];

const PLATFORM_LINKS = [
  { name: "Payroll", link: "/payroll" },
  { name: "Performance", link: "/performance" },
  { name: "Documents", link: "/documents" },
  { name: "Reports", link: "/reports" },
  { name: "AI Production", link: "/ai-production" },
];

// TODO: replace "#" with the real profile URLs for each platform
const SOCIAL_LINKS = [
  { icon: "🌐", label: "Website", href: "https://www.omtatvadigitals.com" },
  { icon: "📘", label: "Facebook", href: "#" },
  { icon: "📸", label: "Instagram", href: "#" },
  { icon: "▶️", label: "YouTube", href: "#" },
  { icon: "💼", label: "LinkedIn", href: "#" },
];

export default function Footer() {
  const [branding, setBranding] = useState(DEFAULT_BRANDING);

  // Live from Firestore, same pattern as DashboardNavbar.tsx / navbar.tsx
  // — so a logo/company name change from Settings -> Branding shows up
  // in the public site footer too.
  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, "settings", "branding"),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setBranding({
            companyName: data.companyName || DEFAULT_BRANDING.companyName,
            logo: data.logo || DEFAULT_BRANDING.logo,
          });
        }
      },
      (error) => console.error("FOOTER BRANDING SNAPSHOT ERROR:", error)
    );
    return () => unsubscribe();
  }, []);

  return (
    <footer style={{ background: "#111827", color: "#fff", marginTop: 70 }}>
      <div className="footer-grid">
        {/* Company */}
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              marginBottom: 20,
            }}
          >
            <img
              src={branding.logo}
              alt={`${branding.companyName} logo`}
              style={{ width: 90, height: 90, objectFit: "contain" }}
            />
            <div>
              <h2
                style={{
                  margin: 0,
                  color: "#66a8e0",
                  fontSize: 34,
                  fontWeight: 700,
                  lineHeight: 1.1,
                }}
              >
                {branding.companyName}
              </h2>
              <p style={{ margin: "8px 0 0", color: "#bdbdbd", fontSize: 16 }}>
                Driven by Stories • Powered by AI
              </p>
            </div>
          </div>

          <p
            style={{
              color: "#d1d5db",
              lineHeight: 1.9,
              fontSize: 17,
              maxWidth: 420,
              marginTop: 25,
            }}
          >
            AI-powered HR, Attendance, Payroll and Production Management
            Platform built for modern creative teams and AI filmmaking
            studios.
          </p>

          <div style={{ display: "flex", gap: 14, marginTop: 30 }}>
            {SOCIAL_LINKS.map((social) => (
              <a
                key={social.label}
                href={social.href}
                aria-label={social.label}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background: "#3d6fa8",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  fontSize: 20,
                  cursor: "pointer",
                  textDecoration: "none",
                }}
              >
                {social.icon}
              </a>
            ))}
          </div>
        </div>

        {/* Quick Links */}
        <div>
          <h3 style={{ color: "#66a8e0", marginBottom: 15, fontSize: 20 }}>
            Quick Links
          </h3>
          {QUICK_LINKS.map((item) => (
            <Link
              key={item.name}
              href={item.link}
              style={{
                display: "block",
                color: "#ddd",
                textDecoration: "none",
                margin: "10px 0",
                fontSize: 15,
              }}
            >
              {item.name}
            </Link>
          ))}
        </div>

        {/* Platform */}
        <div>
          <h3 style={{ color: "#66a8e0", marginBottom: 15, fontSize: 20 }}>
            Platform
          </h3>
          {PLATFORM_LINKS.map((item) => (
            <Link
              key={item.name}
              href={item.link}
              style={{
                display: "block",
                color: "#ddd",
                textDecoration: "none",
                margin: "10px 0",
                fontSize: 15,
              }}
            >
              {item.name}
            </Link>
          ))}
        </div>

        {/* Contact */}
        <div>
          <h3 style={{ color: "#66a8e0", marginBottom: 15, fontSize: 20 }}>
            Contact
          </h3>
          <p style={{ color: "#ddd", fontSize: 15 }}>📍 Noida, Uttar Pradesh</p>
          <p style={{ color: "#ddd", fontSize: 15 }}>
            📞{" "}
            <a href="tel:+919667566556" style={{ color: "#ddd" }}>
              +91 9667566556
            </a>
          </p>
          <p style={{ color: "#ddd", fontSize: 15 }}>
            ✉{" "}
            <a href="mailto:hr@omtatvadigitals.com" style={{ color: "#ddd" }}>
              hr@omtatvadigitals.com
            </a>
          </p>
          <p style={{ color: "#ddd", fontSize: 15 }}>
            🌐{" "}
            <a
              href="https://www.omtatvadigitals.com"
              style={{ color: "#ddd" }}
            >
              www.omtatvadigitals.com
            </a>
          </p>
        </div>
      </div>

      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,.1)",
          padding: "25px 40px",
          textAlign: "center",
          color: "#bdbdbd",
          fontSize: 15,
          lineHeight: 1.8,
        }}
      >
        © {new Date().getFullYear()} OMTATVA DIGITALS Pvt. Ltd. All Rights
        Reserved.
        <br />
        Powered by AI • Designed & Developed by <b>Radhika Agarwal</b>
      </div>

      <style jsx>{`
        .footer-grid {
          max-width: 1300px;
          margin: 0 auto;
          padding: 50px 40px;
          display: grid;
          grid-template-columns: 2.3fr 1fr 1fr 1fr;
          gap: 60px;
          align-items: start;
        }
        @media (max-width: 900px) {
          .footer-grid {
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            padding: 40px 24px;
          }
        }
        @media (max-width: 560px) {
          .footer-grid {
            grid-template-columns: 1fr;
            padding: 32px 20px;
          }
        }
      `}</style>
    </footer>
  );
}