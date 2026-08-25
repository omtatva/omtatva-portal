"use client";
import { useEffect, useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { ROLES } from "@/lib/roles";
import type { Shift } from "@/lib/attendanceRules";
export default function AddEmployeePage() {
const [firstName, setFirstName] = useState("");
const [lastName, setLastName] = useState("");
const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [employeeId, setEmployeeId] = useState("");
const [phone, setPhone] = useState("");
const [department, setDepartment] = useState("");
const [designation, setDesignation] = useState("");
const [role, setRole] = useState("employee");
const [shiftId, setShiftId] = useState("");
const [shifts, setShifts] = useState<Shift[]>([]);
const [status, setStatus] = useState("active");
const [loading, setLoading] = useState(false);

useEffect(() => {
  getDoc(doc(db, "settings", "attendanceRules")).then((snap) => {
    if (snap.exists()) {
      setShifts(snap.data().shifts || []);
    }
  });
}, []);
const saveEmployee = async () => {
  if (!firstName || !email || !password) {
    alert("Please fill all required fields.");
    return;
  }

  try {
    setLoading(true);

    // Create login account
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    const uid = userCredential.user.uid;

    // Save employee details
    await setDoc(doc(db, "users", uid), {
      firstName,
      lastName,
      employeeId,
      email,
      phone,
      department,
      designation,
      role,
      shiftId,
      status,
      createdAt: new Date(),
    });

    // NOTE: "Role" here is just a title/designation on the employee's
    // record — it intentionally does NOT grant admin dashboard access.
    // Real access is granted only from Settings -> Access Management,
    // by email, so picking "Admin"/"Head" etc. here can't silently make
    // someone an admin.

    alert("Employee Added Successfully ✅");

    window.location.href = "/admin/users";
  } catch (error: any) {
    console.error(error);
    alert(error.message);
  } finally {
    setLoading(false);
  }
};
  return (
    <div
      style={{
        maxWidth: 700,
        margin: "40px auto",
        background: "#fff",
        padding: 30,
        borderRadius: 12,
        boxShadow: "0 4px 15px rgba(0,0,0,.08)",
      }}
    >
      <h1
        style={{
          fontSize: 32,
          fontWeight: 700,
          marginBottom: 20,
        }}
      >
        ➕ Add Employee
      </h1>

      <div style={{ display: "grid", gap: 16 }}>
  <input
    placeholder="First Name"
    value={firstName}
    onChange={(e) => setFirstName(e.target.value)}
  />

  <input
    placeholder="Last Name"
    value={lastName}
    onChange={(e) => setLastName(e.target.value)}
  />

  <input
    placeholder="Employee ID"
    value={employeeId}
    onChange={(e) => setEmployeeId(e.target.value)}
  />

  <input
    placeholder="Email"
    type="email"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
  />

  <input
    placeholder="Password"
    type="password"
    value={password}
    onChange={(e) => setPassword(e.target.value)}
  />

  <input
    placeholder="Phone"
    value={phone}
    onChange={(e) => setPhone(e.target.value)}
  />

  <input
    placeholder="Department"
    value={department}
    onChange={(e) => setDepartment(e.target.value)}
  />

  <input
    placeholder="Designation"
    value={designation}
    onChange={(e) => setDesignation(e.target.value)}
  />

  <select value={role} onChange={(e) => setRole(e.target.value)}>
    {ROLES.map((r) => (
      <option key={r.value} value={r.value}>
        {r.label}
      </option>
    ))}
  </select>

  <select value={shiftId} onChange={(e) => setShiftId(e.target.value)}>
    <option value="">Shift: Default (office timing)</option>
    {shifts.map((s) => (
      <option key={s.id} value={s.id}>
        Shift: {s.name} ({s.startTime}–{s.endTime})
      </option>
    ))}
  </select>

  <select value={status} onChange={(e) => setStatus(e.target.value)}>
    <option value="active">Active</option>
    <option value="inactive">Inactive</option>
  </select>

  <button
  onClick={saveEmployee}
  disabled={loading}
  style={{
    background: "#3d6fa8",
    color: "#fff",
    padding: "14px",
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 700,
  }}
>
  {loading ? "Saving..." : "Save Employee"}
</button>
</div>
    </div>
  );
}