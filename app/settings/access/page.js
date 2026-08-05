"use client";

import { useEffect, useState } from "react";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";

const SETTINGS_DOC = "settings/access";

// Module titles that can be assigned to an individual employee.
// Edit this list to match the sections that actually exist in your app.
const MODULES = [
  "Admin Portal",
  "Settings",
  "Dashboard",
  "Attendance",
  "Timesheet",
  "Leave",
  "Holiday",
  "Reports",
];

export default function AccessManagementPage() {
  const [allowedEmails, setAllowedEmails] = useState([]);
  const [allowedRoles, setAllowedRoles] = useState([]);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // ---------- Per-employee module access ----------
  const [employees, setEmployees] = useState([]); // [{id, name, email}]
  const [userAccessList, setUserAccessList] = useState([]); // [{id, name, email, modules}]
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedModules, setSelectedModules] = useState([]);
  const [assigning, setAssigning] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(true);

  useEffect(() => {
    loadAccessSettings();
    loadEmployeesAndAccess();
  }, []);

  const loadAccessSettings = async () => {
    setLoading(true);
    try {
      const ref = doc(db, SETTINGS_DOC);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const data = snap.data();
        setAllowedEmails(data.allowedEmails || []);
        setAllowedRoles(data.allowedRoles || []);
      } else {
        // First time setup — seed with your existing hardcoded defaults
        const defaults = {
          allowedEmails: [
            "admin@omtatvadigitals.com",
            "hr@omtatvadigitals.com",
            "itsupport@omtatvadigitals.com",
          ],
          allowedRoles: ["admin", "hr", "developer"],
        };
        await setDoc(ref, defaults);
        setAllowedEmails(defaults.allowedEmails);
        setAllowedRoles(defaults.allowedRoles);
      }
    } catch (error) {
      console.error("LOAD ACCESS ERROR:", error);
      setError("Couldn't load access settings. Refresh and try again.");
    } finally {
      setLoading(false);
    }
  };

  // Employee names live in "employeeProfiles", login emails live in "users" —
  // same split the dashboard page uses — so merge them by doc id (uid).
  const loadEmployeesAndAccess = async () => {
    setLoadingEmployees(true);
    try {
      const [usersSnap, profilesSnap, accessSnap] = await Promise.all([
        getDocs(collection(db, "users")),
        getDocs(collection(db, "employeeProfiles")),
        getDocs(collection(db, "userAccess")),
      ]);

      const usersById = {};
      usersSnap.docs.forEach((d) => (usersById[d.id] = d.data()));

      const merged = profilesSnap.docs.map((d) => {
        const u = usersById[d.id] || {};
        const p = d.data();
        const name = `${p.firstName || u.firstName || ""} ${p.lastName || u.lastName || ""}`.trim();
        return {
          id: d.id,
          name: name || "(no name)",
          email: u.email || p.email || "",
        };
      });

      setEmployees(merged);
      setUserAccessList(
        accessSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
      );
    } catch (err) {
      console.error("LOAD EMPLOYEES/ACCESS ERROR:", err);
      setError("Couldn't load employees or module access. Refresh and try again.");
    } finally {
      setLoadingEmployees(false);
    }
  };

  // Returns true on success, false on failure — callers use this to decide
  // whether to keep an optimistic UI update or roll it back.
  const saveAccessSettings = async (emails, roles) => {
    setSaving(true);
    setError("");
    try {
      const ref = doc(db, SETTINGS_DOC);
      await setDoc(ref, {
        allowedEmails: emails,
        allowedRoles: roles,
      });
      return true;
    } catch (err) {
      console.error("SAVE ACCESS ERROR:", err);
      setError(
        "Couldn't save that change — it was not applied. Check your connection or permissions and try again."
      );
      return false;
    } finally {
      setSaving(false);
    }
  };

  const addEmail = async () => {
    if (saving) return;
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    if (allowedEmails.includes(email)) {
      setError("This email already has access.");
      return;
    }

    const previous = allowedEmails;
    const updated = [...allowedEmails, email];

    setAllowedEmails(updated); // optimistic
    setNewEmail("");

    const ok = await saveAccessSettings(updated, allowedRoles);
    if (!ok) {
      setAllowedEmails(previous); // roll back — the write never landed
      setNewEmail(email); // give the email back so they don't retype it
    }
  };

  const removeEmail = async (email) => {
    if (saving) return;
    const previous = allowedEmails;
    const updated = allowedEmails.filter((e) => e !== email);

    setAllowedEmails(updated); // optimistic

    const ok = await saveAccessSettings(updated, allowedRoles);
    if (!ok) {
      setAllowedEmails(previous); // roll back
    }
  };

  const addRole = async () => {
    if (saving) return;
    const role = newRole.trim().toLowerCase();
    if (!role) return;
    if (allowedRoles.includes(role)) {
      setError("This role already has access.");
      return;
    }

    const previous = allowedRoles;
    const updated = [...allowedRoles, role];

    setAllowedRoles(updated); // optimistic
    setNewRole("");

    const ok = await saveAccessSettings(allowedEmails, updated);
    if (!ok) {
      setAllowedRoles(previous); // roll back
      setNewRole(role);
    }
  };

  const removeRole = async (role) => {
    if (saving) return;
    const previous = allowedRoles;
    const updated = allowedRoles.filter((r) => r !== role);

    setAllowedRoles(updated); // optimistic

    const ok = await saveAccessSettings(allowedEmails, updated);
    if (!ok) {
      setAllowedRoles(previous); // roll back
    }
  };

  // ---------- Per-employee module access ----------
  const toggleModule = (mod) => {
    setSelectedModules((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]
    );
  };

  const startEditingAccess = (entry) => {
    setSelectedEmployeeId(entry.id);
    setSelectedModules(entry.modules || []);
  };

  const assignAccess = async () => {
    if (assigning) return;
    if (!selectedEmployeeId) {
      setError("Select an employee first.");
      return;
    }
    if (selectedModules.length === 0) {
      setError("Select at least one module to assign.");
      return;
    }

    const employee = employees.find((e) => e.id === selectedEmployeeId);
    if (!employee) return;

    const previousList = userAccessList;
    const entry = {
      id: employee.id,
      name: employee.name,
      email: employee.email,
      modules: selectedModules,
    };

    // optimistic update — replace existing entry for this employee, or add new
    setUserAccessList((prev) => {
      const exists = prev.some((e) => e.id === entry.id);
      return exists
        ? prev.map((e) => (e.id === entry.id ? entry : e))
        : [...prev, entry];
    });

    setAssigning(true);
    setError("");
    try {
      await setDoc(doc(db, "userAccess", employee.id), {
        name: employee.name,
        email: employee.email,
        modules: selectedModules,
        updatedAt: serverTimestamp(),
      });
      setSelectedEmployeeId("");
      setSelectedModules([]);
    } catch (err) {
      console.error("ASSIGN ACCESS ERROR:", err);
      setUserAccessList(previousList); // roll back
      setError("Couldn't assign access — it was not saved. Try again.");
    } finally {
      setAssigning(false);
    }
  };

  const removeAccess = async (entryId) => {
    if (assigning) return;
    const previousList = userAccessList;
    setUserAccessList((prev) => prev.filter((e) => e.id !== entryId)); // optimistic

    setAssigning(true);
    setError("");
    try {
      await deleteDoc(doc(db, "userAccess", entryId));
    } catch (err) {
      console.error("REMOVE ACCESS ERROR:", err);
      setUserAccessList(previousList); // roll back
      setError("Couldn't remove that access — it was not saved. Try again.");
    } finally {
      setAssigning(false);
    }
  };

  if (loading) {
    return <CenteredMessage text="Loading access settings..." />;
  }

  return (
    <div style={{ padding: 25, maxWidth: 900 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
        🔐 Access Management
      </h1>
      <p style={{ color: "#64748b", marginBottom: 12 }}>
        Control who can log into the admin dashboard, by email or by role.
        {saving && <span style={{ color: "#3d6fa8", marginLeft: 10 }}>Saving...</span>}
      </p>

      {error && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
            padding: "12px 16px",
            borderRadius: 10,
            marginBottom: 20,
            fontSize: 13.5,
            fontWeight: 600,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span>{error}</span>
          <button
            onClick={() => setError("")}
            style={{
              background: "none",
              border: "none",
              color: "#b91c1c",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* EMAILS */}
      <Section title="Allowed Emails" subtitle="These specific accounts always get admin access.">
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <input
            placeholder="name@company.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addEmail()}
            disabled={saving}
            style={inputStyle}
          />
          <button onClick={addEmail} disabled={saving} style={addBtnStyle(saving)}>
            + Add
          </button>
        </div>

        {allowedEmails.length === 0 ? (
          <EmptyRow text="No emails added yet." />
        ) : (
          allowedEmails.map((email) => (
            <Row key={email} label={email} onRemove={() => removeEmail(email)} disabled={saving} />
          ))
        )}
      </Section>

      {/* ROLES */}
      <Section title="Allowed Roles" subtitle="Anyone whose profile role matches one of these gets admin access.">
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <input
            placeholder="e.g. hr, developer, manager"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addRole()}
            disabled={saving}
            style={inputStyle}
          />
          <button onClick={addRole} disabled={saving} style={addBtnStyle(saving)}>
            + Add
          </button>
        </div>

        {allowedRoles.length === 0 ? (
          <EmptyRow text="No roles added yet." />
        ) : (
          allowedRoles.map((role) => (
            <Row key={role} label={role} onRemove={() => removeRole(role)} disabled={saving} />
          ))
        )}
      </Section>

      {/* PER-EMPLOYEE MODULE ACCESS */}
      <Section
        title="Assign Module Access"
        subtitle="Pick an employee, then pick which sections (Admin Portal, Settings, etc.) they're allowed to open."
      >
        {loadingEmployees ? (
          <p style={{ color: "#94a3b8", fontSize: 13.5 }}>Loading employees...</p>
        ) : (
          <>
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 13.5, fontWeight: 600, color: "#334155" }}>
                Employee
              </label>
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                disabled={assigning}
                style={{ ...inputStyle, width: "100%", marginTop: 8 }}
              >
                <option value="">Select an employee</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                    {emp.email ? ` (${emp.email})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13.5, fontWeight: 600, color: "#334155" }}>
                Modules
              </label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))",
                  gap: 10,
                  marginTop: 10,
                }}
              >
                {MODULES.map((mod) => (
                  <label
                    key={mod}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "10px 12px",
                      background: selectedModules.includes(mod) ? "#eaf1fb" : "#f8fafc",
                      border: `1px solid ${selectedModules.includes(mod) ? "#3d6fa8" : "#e2e8f0"}`,
                      borderRadius: 10,
                      fontSize: 13.5,
                      fontWeight: 600,
                      color: "#1e293b",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedModules.includes(mod)}
                      onChange={() => toggleModule(mod)}
                      disabled={assigning}
                    />
                    {mod}
                  </label>
                ))}
              </div>
            </div>

            <button
              onClick={assignAccess}
              disabled={assigning}
              style={{ ...addBtnStyle(assigning), marginBottom: 28 }}
            >
              {assigning ? "Assigning..." : "Assign Access"}
            </button>

            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>
              Current assignments
            </h3>

            {userAccessList.length === 0 ? (
              <EmptyRow text="No employee has module access assigned yet." />
            ) : (
              userAccessList.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    padding: "14px 16px",
                    background: "#f8fafc",
                    borderRadius: 10,
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 8,
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 700, color: "#1e293b", fontSize: 14.5 }}>
                        {entry.name}
                      </span>
                      {entry.email && (
                        <span style={{ color: "#64748b", fontSize: 13, marginLeft: 8 }}>
                          {entry.email}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 14 }}>
                      <button
                        onClick={() => startEditingAccess(entry)}
                        disabled={assigning}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#3d6fa8",
                          fontWeight: 600,
                          cursor: assigning ? "default" : "pointer",
                          fontSize: 13.5,
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => removeAccess(entry.id)}
                        disabled={assigning}
                        style={{
                          background: "none",
                          border: "none",
                          color: assigning ? "#fca5a5" : "#dc2626",
                          fontWeight: 600,
                          cursor: assigning ? "default" : "pointer",
                          fontSize: 13.5,
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {(entry.modules || []).map((mod) => (
                      <span
                        key={mod}
                        style={{
                          background: "#eaf1fb",
                          color: "#3d6fa8",
                          fontSize: 12,
                          fontWeight: 700,
                          padding: "4px 10px",
                          borderRadius: 20,
                        }}
                      >
                        {mod}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </Section>
    </div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 16,
        padding: 28,
        marginBottom: 24,
        boxShadow: "0 5px 20px rgba(0,0,0,.05)",
      }}
    >
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "#0f172a" }}>{title}</h2>
      <p style={{ color: "#64748b", fontSize: 13.5, marginTop: 4, marginBottom: 20 }}>
        {subtitle}
      </p>
      {children}
    </div>
  );
}

function Row({ label, onRemove, disabled }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 16px",
        background: "#f8fafc",
        borderRadius: 10,
        marginBottom: 8,
      }}
    >
      <span style={{ fontWeight: 600, color: "#1e293b", fontSize: 14.5 }}>{label}</span>
      <button
        onClick={onRemove}
        disabled={disabled}
        style={{
          background: "none",
          border: "none",
          color: disabled ? "#fca5a5" : "#dc2626",
          fontWeight: 600,
          cursor: disabled ? "default" : "pointer",
          fontSize: 13.5,
        }}
      >
        Remove
      </button>
    </div>
  );
}

function EmptyRow({ text }) {
  return <p style={{ color: "#94a3b8", fontSize: 13.5 }}>{text}</p>;
}

function CenteredMessage({ text }) {
  return (
    <div style={{ padding: 60, textAlign: "center", color: "#64748b" }}>
      <h2>{text}</h2>
    </div>
  );
}

const inputStyle = {
  flex: 1,
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #e2e8f0",
  fontSize: 14,
  outline: "none",
};

const addBtnStyle = (saving) => ({
  background: saving ? "#94a3b8" : "#3d6fa8",
  color: "#fff",
  border: "none",
  padding: "12px 22px",
  borderRadius: 10,
  fontWeight: 700,
  cursor: saving ? "default" : "pointer",
  fontSize: 14,
});

// "use client";

// import { useState } from "react";
// import { UserPlus, Trash2 } from "lucide-react";
// import { appSettings, updateAppSettings } from "../../../config/appSettings";

// const modules = [
//   "Dashboard",
//   "Attendance",
//   "Timesheet",
//   "Leave",
//   "Holiday",
//   "Admin",
//   "Reports",
//   "Settings",
// ];


// export default function AccessManagement(){

// const [admins,setAdmins] = useState([
//   {
//     name:"Main Admin",
//     email:"admin@omtavta.com",
//     role:"Super Admin",
//   }
// ]);


// const [email,setEmail] = useState("");
// const [name,setName] = useState("");
// const [role,setRole] = useState("Admin");


// const [permissions,setPermissions] = useState<string[]>([]);


// function addAdmin(){

// if(!email || !name) return;


// const newUser = {

// name,
// email,
// role,
// permissions

// };


// updateAppSettings({

// access:{

// users:[

// ...appSettings.access.users,

// newUser

// ]

// }

// });


// setAdmins([

// ...admins,

// newUser

// ]);


// setName("");
// setEmail("");
// setPermissions([]);

// }



// function togglePermission(item:string){

// if(permissions.includes(item)){

// setPermissions(
//  permissions.filter(
//  p=>p!==item
//  )
// );

// }
// else{

// setPermissions([
//  ...permissions,
//  item
// ]);

// }

// }



// return(

// <div
// style={{
// padding:"25px"
// }}
// >


// <h1
// style={{
// fontSize:"28px",
// fontWeight:700
// }}
// >
// 👥 Access Management
// </h1>



// <div
// style={{
// display:"grid",
// gridTemplateColumns:"1fr 1fr",
// gap:20,
// marginTop:25
// }}
// >


// {/* Add Admin */}

// <div
// style={card}
// >

// <h2>
// <UserPlus size={20}/>
//  Add New Admin
// </h2>


// <input
// placeholder="Name"
// value={name}
// onChange={(e)=>setName(e.target.value)}
// style={input}
// />


// <input
// placeholder="Email ID"
// value={email}
// onChange={(e)=>setEmail(e.target.value)}
// style={input}
// />



// <select
// style={input}
// value={role}
// onChange={(e)=>setRole(e.target.value)}
// >

// <option>
// Admin
// </option>

// <option>
// HR Admin
// </option>

// <option>
// Manager
// </option>

// <option>
// Employee
// </option>

// </select>



// <h3>
// Module Access
// </h3>


// {
// modules.map(item=>(

// <label
// key={item}
// style={{
// display:"block",
// marginBottom:8
// }}
// >

// <input
// type="checkbox"
// checked={permissions.includes(item)}
// onChange={()=>togglePermission(item)}
// />

// {" "}
// {item}

// </label>

// ))

// }



// <button
// onClick={addAdmin}
// style={button}
// >
// Save Access
// </button>


// </div>





// {/* Admin List */}

// <div
// style={card}
// >

// <h2>
// Existing Admins
// </h2>


// {
// admins.map((admin,index)=>(

// <div
// key={index}
// style={{
// borderBottom:"1px solid #eee",
// padding:"12px 0",
// display:"flex",
// justifyContent:"space-between"
// }}
// >

// <div>

// <b>{admin.name}</b>

// <br/>

// <span>
// {admin.email}
// </span>

// <br/>

// <small>
// {admin.role}
// </small>

// </div>


// <button
// style={{
// border:"none",
// background:"transparent",
// color:"red"
// }}
// >

// <Trash2 size={18}/>

// </button>


// </div>

// ))

// }


// </div>


// </div>

// </div>

// )

// }




// const card={
// background:"#fff",
// padding:"25px",
// borderRadius:"16px",
// boxShadow:"0 5px 20px rgba(0,0,0,.05)"
// };


// const input={
// width:"100%",
// padding:"12px",
// margin:"8px 0",
// border:"1px solid #ddd",
// borderRadius:"8px"
// };


// const button={
// marginTop:20,
// background:"#3d6fa8",
// color:"#fff",
// padding:"12px 25px",
// border:"none",
// borderRadius:"10px",
// cursor:"pointer"
// };