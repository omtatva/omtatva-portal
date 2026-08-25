"use client";

import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { auth, db } from "../../lib/firebase";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { lookupRoleForEmail } from "@/lib/adminAccess";
import { checkLoginAllowed } from "@/lib/security";

export default function LoginPage() {
  const login = async () => {
    try {
      const provider = new GoogleAuthProvider();

      const result = await signInWithPopup(auth, provider);

      const user = result.user;

      const userRef = doc(db, "users", user.uid);

      const existingUser = await getDoc(userRef);

      // First login — if this email has been granted admin/HR/etc access
      // via Settings -> Access Management, honor that role here too (not
      // just when signing in through /admin/login), so nothing depends on
      // which login page someone happens to use first.
      if (!existingUser.exists()) {
        const role = await lookupRoleForEmail(user.email || "");

        const blockedReason = await checkLoginAllowed(user.email || "", role);
        if (blockedReason) {
          alert(blockedReason);
          await signOut(auth);
          return;
        }

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

        alert("Welcome to OMTATVA DIGITALS!");

        window.location.href = "/profile";

        return;
      }

      // Existing Employee
      const userData = existingUser.data();

      const blockedReason = await checkLoginAllowed(user.email || "", userData.role || "employee");
      if (blockedReason) {
        alert(blockedReason);
        await signOut(auth);
        return;
      }

      if (userData.profileCompleted) {
        window.location.href = "/dashboard";
      } else {
        window.location.href = "/profile";
      }
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#f8fafc",
      }}
    >
      <div
        style={{
          width: "450px",
          background: "#fff",
          padding: "40px",
          borderRadius: "18px",
          boxShadow: "0 10px 40px rgba(0,0,0,.08)",
          textAlign: "center",
        }}
      >
        <h1
          style={{
            fontSize: "34px",
            color: "#0f172a",
            marginBottom: "10px",
          }}
        >
          OMTATVA DIGITALS
        </h1>

        <p
          style={{
            color: "#64748b",
            marginBottom: "30px",
          }}
        >
          AI Production Management Platform
        </p>

        <button
          onClick={login}
          style={{
            width: "100%",
            padding: "15px",
            border: "none",
            borderRadius: "12px",
            background: "#3d6fa8",
            color: "#fff",
            fontWeight: "bold",
            fontSize: "16px",
            cursor: "pointer",
          }}
        >
          Continue with Google
        </button>

        <p
          style={{
            marginTop: "25px",
            color: "#94a3b8",
            fontSize: "14px",
          }}
        >
          Secure Login with Google Workspace
        </p>
      </div>
    </div>
  );
}