"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

const SETTINGS_DOC = "settings/access";

export default function AccessManagementPage() {
  const [allowedEmails, setAllowedEmails] = useState([]);
  const [allowedRoles, setAllowedRoles] = useState([]);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAccessSettings();
  }, []);

  const loadAccessSettings = async () => {
    setLoading(true);
    try {
      const ref = doc(db, "settings", "access");
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
      alert("Failed to load access settings");
    } finally {
      setLoading(false);
    }
  };

  const saveAccessSettings = async (emails, roles) => {
    setSaving(true);
    try {
      const ref = doc(db, "settings", "access");
      await setDoc(ref, {
        allowedEmails: emails,
        allowedRoles: roles,
      });
    } catch (error) {
      console.error("SAVE ACCESS ERROR:", error);
      alert("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const addEmail = () => {
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    if (allowedEmails.includes(email)) {
      alert("This email already has access");
      return;
    }
    const updated = [...allowedEmails, email];
    setAllowedEmails(updated);
    setNewEmail("");
    saveAccessSettings(updated, allowedRoles);
  };

  const removeEmail = (email) => {
    const updated = allowedEmails.filter((e) => e !== email);
    setAllowedEmails(updated);
    saveAccessSettings(updated, allowedRoles);
  };

  const addRole = () => {
    const role = newRole.trim().toLowerCase();
    if (!role) return;
    if (allowedRoles.includes(role)) {
      alert("This role already has access");
      return;
    }
    const updated = [...allowedRoles, role];
    setAllowedRoles(updated);
    setNewRole("");
    saveAccessSettings(allowedEmails, updated);
  };

  const removeRole = (role) => {
    const updated = allowedRoles.filter((r) => r !== role);
    setAllowedRoles(updated);
    saveAccessSettings(allowedEmails, updated);
  };

  if (loading) {
    return <CenteredMessage text="Loading access settings..." />;
  }

  return (
    <div style={{ padding: 25, maxWidth: 900 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
        🔐 Access Management
      </h1>
      <p style={{ color: "#64748b", marginBottom: 30 }}>
        Control who can log into the admin dashboard, by email or by role.
        {saving && <span style={{ color: "#3d6fa8", marginLeft: 10 }}>Saving...</span>}
      </p>

      {/* EMAILS */}
      <Section title="Allowed Emails" subtitle="These specific accounts always get admin access.">
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <input
            placeholder="name@company.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addEmail()}
            style={inputStyle}
          />
          <button onClick={addEmail} style={addBtnStyle}>
            + Add
          </button>
        </div>

        {allowedEmails.length === 0 ? (
          <EmptyRow text="No emails added yet." />
        ) : (
          allowedEmails.map((email) => (
            <Row key={email} label={email} onRemove={() => removeEmail(email)} />
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
            style={inputStyle}
          />
          <button onClick={addRole} style={addBtnStyle}>
            + Add
          </button>
        </div>

        {allowedRoles.length === 0 ? (
          <EmptyRow text="No roles added yet." />
        ) : (
          allowedRoles.map((role) => (
            <Row key={role} label={role} onRemove={() => removeRole(role)} />
          ))
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

function Row({ label, onRemove }) {
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
        style={{
          background: "none",
          border: "none",
          color: "#dc2626",
          fontWeight: 600,
          cursor: "pointer",
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

const addBtnStyle = {
  background: "#3d6fa8",
  color: "#fff",
  border: "none",
  padding: "12px 22px",
  borderRadius: 10,
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 14,
};

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
// background:"#2563EB",
// color:"#fff",
// padding:"12px 25px",
// border:"none",
// borderRadius:"10px",
// cursor:"pointer"
// };