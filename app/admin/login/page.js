"use client";

import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

export default function AdminLoginPage() {
  const login = async () => {
    try {
      const provider = new GoogleAuthProvider();

      const result = await signInWithPopup(auth, provider);

      const user = result.user;

      // TEMPORARY DEBUG — remove once the access-denied issue is
      // resolved. Open browser DevTools (F12) → Console tab before
      // clicking "Continue with Google", then check what gets printed.
      console.log("DEBUG — signed in email:", JSON.stringify(user.email));

      // Allowed Admin Emails
      const allowedAdmins = [
        "admin@omtatvadigitals.com",
        "hr@omtatvadigitals.com",
        "itsupport@omtatvadigitals.com",
      ];

      console.log("DEBUG — allowedAdmins:", allowedAdmins);
      console.log(
        "DEBUG — email in allowedAdmins?",
        allowedAdmins.includes(user.email || "")
      );

      if (!allowedAdmins.includes(user.email || "")) {
        alert("Access Denied!\nOnly Admin / HR / Owner can login.");
        await signOut(auth);
        return;
      }

      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      // First Login
      if (!userSnap.exists()) {
        let role = "admin";

        if (user.email === "hr@omtatvadigitals.com") role = "hr";

        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,

          firstName: "",
          lastName: "",
          employeeId: "",
          department: "",
          designation: "",
          phone: "",
          emergencyContact: "",
          emergencyPhone: "",
          address: "",
          city: "",
          state: "",
          country: "",
          dob: "",
          joiningDate: "",
          profileImage: user.photoURL || "",

          role,
          status: "Active",

          profileCompleted: false,

          createdAt: serverTimestamp(),
        });

        alert("Welcome Admin!");
        window.location.href = "/admin";
        return;
      }

      const userData = userSnap.data();

      // TEMPORARY DEBUG
      console.log("DEBUG — Firestore role value:", JSON.stringify(userData.role));

      // Double Security Check
      // Access is based on the email whitelist (allowedAdmins) rather
      // than the Firestore "role" field — avoids issues if role ever
      // drifts out of sync (wrong casing, stale value from an older
      // login flow, etc.). The email was already checked once above
      // right after sign-in; this re-checks it here as the final gate
      // before granting access to an EXISTING user's account.
      if (!allowedAdmins.includes(user.email || "")) {
        alert("Access Denied!");
        await signOut(auth);
        return;
      }

      if (userData.profileCompleted) {
        window.location.href = "/admin";
      } else {
        window.location.href = "/admin";
      }
    } catch (error) {
      console.error(error);

      if (error instanceof Error) {
        alert(error.message);
      } else {
        alert("Something went wrong.");
      }
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#f5f7fb",
      }}
    >
      <div
        style={{
          width: 450,
          maxWidth: "90vw",
          background: "#fff",
          padding: 40,
          borderRadius: 18,
          boxShadow: "0 15px 45px rgba(0,0,0,.12)",
          textAlign: "center",
        }}
      >
        <img
          src="/logo.ico"
          alt="logo"
          style={{
            width: 70,
            display: "block",
            margin: "0 auto 20px",
          }}
        />

        <h1 style={{ color: "#3d6fa8", marginBottom: 10 }}>Admin Portal</h1>

        <p style={{ color: "#666", marginBottom: 30 }}>OMTATVA DIGITALS HRMS</p>

        <button
          onClick={login}
          style={{
            width: "100%",
            padding: "15px",
            background: "#3d6fa8",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            fontWeight: 700,
            cursor: "pointer",
            fontSize: 16,
          }}
        >
          Continue with Google
        </button>

        <p style={{ marginTop: 25, color: "#888", fontSize: 14 }}>
          Only Owner, Admin and HR accounts are allowed.
        </p>
      </div>
    </div>
  );
}