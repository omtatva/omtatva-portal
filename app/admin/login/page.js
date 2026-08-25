"use client";

import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { lookupRoleForEmail } from "@/lib/adminAccess";
import { isAdminTierRole } from "@/lib/roles";
import { checkLoginAllowed } from "@/lib/security";

export default function AdminLoginPage() {
  const login = async () => {
    try {
      const provider = new GoogleAuthProvider();

      const result = await signInWithPopup(auth, provider);

      const user = result.user;
      const email = user.email || "";

      // Who is allowed in, and with what role, is managed entirely from
      // Settings -> Access Management (adminAccess collection) instead of
      // a hardcoded email list here.
      const role = await lookupRoleForEmail(email);

      if (!isAdminTierRole(role)) {
        alert("Access Denied!\nOnly accounts granted admin/HR access in Settings can log in here.");
        await signOut(auth);
        return;
      }

      const blockedReason = await checkLoginAllowed(email, role);
      if (blockedReason) {
        alert(blockedReason);
        await signOut(auth);
        return;
      }

      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      // First Login
      if (!userSnap.exists()) {
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

      // Existing user — make sure their Firestore role stays in sync with
      // whatever Settings -> Access Management currently says for their
      // email (covers the case where their role was changed while they
      // were logged out).
      if (userData.role !== role) {
        await setDoc(userRef, { role }, { merge: true });
      }

      window.location.href = "/admin";
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
