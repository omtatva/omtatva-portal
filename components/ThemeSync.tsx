"use client";

import { useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Listens to settings/appearance + settings/branding and applies them
// portal-wide via CSS variables on <html>:
//  - data-theme drives the light/dark palette in globals.css
//  - --brand-primary/--brand-sidebar/--brand-bg are the custom colors set
//    in Settings -> Appearance
//  - --brand-bg-image is the background image set in Settings -> Branding
// Mounted once in app/layout.tsx, so every route (employee and admin
// alike) picks these up live, including the page-background layouts that
// used to read a stale, non-persistent config/appSettings.ts object.
export default function ThemeSync() {
  useEffect(() => {
    const root = document.documentElement;

    const unsubscribeAppearance = onSnapshot(
      doc(db, "settings", "appearance"),
      (snap) => {
        const data = snap.exists() ? snap.data() : {};
        root.setAttribute("data-theme", data?.theme || "light");
        root.style.setProperty("--brand-primary", data?.colors?.primary || "#3d6fa8");
        root.style.setProperty("--brand-sidebar", data?.colors?.sidebar || "#FFFFFF");
        root.style.setProperty("--brand-bg", data?.colors?.background || "#F8FBFF");
      },
      (error) => console.error("THEME SNAPSHOT ERROR:", error)
    );

    const unsubscribeBranding = onSnapshot(
      doc(db, "settings", "branding"),
      (snap) => {
        const data = snap.exists() ? snap.data() : {};
        root.style.setProperty(
          "--brand-bg-image",
          data?.backgroundImage ? `url(${data.backgroundImage})` : "none"
        );
      },
      (error) => console.error("BRANDING SNAPSHOT ERROR:", error)
    );

    return () => {
      unsubscribeAppearance();
      unsubscribeBranding();
    };
  }, []);

  return null;
}
