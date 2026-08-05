"use client";

import { useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Listens to settings/appearance and applies the saved theme to the
// whole portal by setting data-theme on <html>. globals.css swaps the
// --bg-color/--text-color/--card-bg variables based on that attribute.
export default function ThemeSync() {
  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, "settings", "appearance"),
      (snap) => {
        const theme = snap.exists() ? snap.data().theme : "light";
        document.documentElement.setAttribute("data-theme", theme || "light");
      },
      (error) => console.error("THEME SNAPSHOT ERROR:", error)
    );
    return () => unsubscribe();
  }, []);

  return null;
}