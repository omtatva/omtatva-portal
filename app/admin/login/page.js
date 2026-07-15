"use client";

import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

export default function AdminLoginPage() {
  const login = async () => {
    try {
      const provider = new GoogleAuthProvider();

      const result = await signInWithPopup(auth, provider);

      const user = result.user;

      // Allowed Admin Emails
      const allowedAdmins = [
        "admin@omtatvadigitals.com",
        "hr@omtatvadigitals.com",
      ];

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


        if (user.email === "hr@omtatvadigitals.com")
          role = "hr";

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

        window.location.href = "/profile";

        return;
      }

      const userData = userSnap.data();

      // Double Security Check
      if (
        userData.role !== "owner" &&
        userData.role !== "admin" &&
        userData.role !== "hr"
      ) {
        alert("Access Denied!");

        await signOut(auth);

        return;
      }

      if (userData.profileCompleted) {
        window.location.href = "/admin";
      } else {
        window.location.href = "/profile";
      }
    }       
 catch (error) {
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
            marginBottom: 20,
          }}
        />

        <h1
          style={{
            color: "#2563eb",
            marginBottom: 10,
          }}
        >
          Admin Portal
        </h1>

        <p
          style={{
            color: "#666",
            marginBottom: 30,
          }}
        >
          OMTATVA DIGITALS HRMS
        </p>

        <button
          onClick={login}
          style={{
            width: "100%",
            padding: "15px",
            background: "#2563eb",
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

        <p
          style={{
            marginTop: 25,
            color: "#888",
            fontSize: 14,
          }}
        >
          Only Owner, Admin and HR accounts are allowed.
        </p>
      </div>
    </div>
  );
}