"use client";

import { useEffect, useState } from "react";
import {
collection,
getDocs,
doc,
updateDoc,
deleteDoc,
} from "firebase/firestore";

import { db } from "../../../lib/firebase";

export default function UsersPage() {
const [users, setUsers] = useState([]);
const [search, setSearch] = useState("");
const [departmentFilter, setDepartmentFilter] = useState("");
const [roleFilter, setRoleFilter] = useState("");
const [statusFilter, setStatusFilter] = useState("");
const [loading, setLoading] = useState(true);
const [editingId, setEditingId] = useState("");
const [employeeCode, setEmployeeCode] = useState("");

useEffect(() => {
loadUsers();
}, []);

const loadUsers = async () => {
try {
const snapshot = await getDocs(
collection(db, "users")
);

  const userList = snapshot.docs.map((userDoc) => ({
    id: userDoc.id,
    ...userDoc.data(),
  }));

  setUsers(userList);
} catch (error) {
  console.error("Load Users Error:", error);
} finally {
  setLoading(false);
}

};

const updateRole = async (userId, role) => {
try {
await updateDoc(
doc(db, "users", userId),
{ role }
);

  alert("Role updated successfully");
  loadUsers();
} catch (error) {
  console.error(error);
  alert("Failed to update role");
}

};

const updateStatus = async (userId, status) => {
try {
await updateDoc(
doc(db, "users", userId),
{ status }
);

  alert(`User ${status}`);
  loadUsers();
} catch (error) {
  console.error(error);
  alert("Failed to update status");
}

};
const saveEmployeeId = async (userId) => {
  try {
    await updateDoc(doc(db, "users", userId), {
      employeeId: employeeCode,
    });

    alert("Employee ID Updated");

    setEditingId("");
    setEmployeeCode("");

    loadUsers();
  } catch (error) {
    console.error(error);
    alert("Failed to update Employee ID");
  }
};

const deleteUser = async (userId) => {
const confirmed = window.confirm(
"Are you sure you want to permanently delete this user?"
);

if (!confirmed) return;

try {
  await deleteDoc(
    doc(db, "users", userId)
  );

  alert("User deleted");
  loadUsers();
} catch (error) {
  console.error(error);
  alert("Delete failed");
}

};

if (loading) {
return (
<div style={{ padding: "30px" }}>
Loading Users...
</div>
);
}

const totalEmployees = users.length;

const activeEmployees = users.filter(
  (user) => user.status === "active"
).length;

const inactiveEmployees = users.filter(
  (user) => user.status === "inactive"
).length;

const adminCount = users.filter(
  (user) => user.role === "admin"
).length;
const filteredUsers = users.filter((user) => {
  const fullName =
    `${user.firstName || ""} ${user.lastName || ""}`.toLowerCase();

  const email = (user.email || "").toLowerCase();
  const employeeId = (user.employeeId || "").toLowerCase();
  const department = (user.department || "").toLowerCase();
  const role = (user.role || "").toLowerCase();
  const status = (user.status || "").toLowerCase();

  const matchesSearch =
    fullName.includes(search.toLowerCase()) ||
    email.includes(search.toLowerCase()) ||
    employeeId.includes(search.toLowerCase());

  const matchesDepartment =
    !departmentFilter || department === departmentFilter.toLowerCase();

  const matchesRole =
    !roleFilter || role === roleFilter.toLowerCase();

  const matchesStatus =
    !statusFilter || status === statusFilter.toLowerCase();

  return (
    matchesSearch &&
    matchesDepartment &&
    matchesRole &&
    matchesStatus
  );
});
return (
<div
style={{
  width: "100%",
  maxWidth: "100%",
  boxSizing: "border-box",
  padding: "30px 40px",
  margin: "0 auto",
  background: "#f7fbff",
  minHeight: "100vh",
  overflowX: "hidden",
}}
>

{/* Header */}

<div
  style={{
    display:"flex",
justifyContent:"space-between",
alignItems:"center",
marginBottom:"35px",
flexWrap:"wrap",
gap:"20px",
  }}
>

<div>

<h1
style={{
fontSize:46,
fontWeight: 800,
margin: 0,
color:"#111"
}}
>
👥 Employee Management
</h1>

<p
style={{
marginTop:10,
color:"#666",
fontSize:18
}}
>
Manage employees, departments, company access and permissions.
</p>

</div>

<div
style={{
display:"flex",
gap:15
}}
>

<button
onClick={()=>window.location.href="/admin"}
style={{
padding:"15px 28px",
fontSize:"15px",
borderRadius:12,
border:"none",
background:"#111827",
color:"#fff",
fontWeight:700,
cursor:"pointer"
}}
>
← Dashboard
</button>

<button
style={{
padding:"13px 22px",
borderRadius:12,
border:"none",
background:"#3d6fa8",
color:"#fff",
fontWeight:700,
cursor:"pointer"
}}
>
＋ Add Employee
</button>

</div>

</div>

{/* Statistics */}

<div
style={{
display:"grid",
gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
gap:"24px",
marginBottom:35

}}
>

{[
{
icon:"👥",
title:"Total Employees",
value:totalEmployees,
color:"#3d6fa8"
},

{
icon:"🟢",
title:"Active",
value:activeEmployees,
color:"#16a34a"
},

{
icon:"⚠️",
title:"Inactive",
value:inactiveEmployees,
color:"#dc2626"
},

{
icon:"👑",
title:"Admins",
value:adminCount,
color:"#7c3aed"
}

].map((card)=>(

<div
  key={card.title}
  style={{
    background: "#fff",
    padding:"40px",
    minHeight:"180px",
    borderRadius: "24px",
    boxShadow: "0 15px 40px rgba(61,111,168,.12)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    transition: ".3s",
  }}
>

<div>

<p
style={{
margin:0,
fontSize:"19px",
fontWeight:600,
color:"#64748b"
}}
>
{card.title}
</p>

<h1
style={{
marginTop:12,
fontSize:"60px",
fontWeight:800,
color:card.color
}}
>
{card.value}
</h1>

</div>

<div
style={{
fontSize:"72px",
    opacity: .9,
}}
>
{card.icon}
</div>

</div>

))

}

</div>

{/* Search */}

<div
style={{
background:"#fff",
padding:"28px 32px",
borderRadius:20,
boxShadow:"0 12px 35px rgba(61,111,168,.12)",
marginBottom:35
}}
>

<div
style={{
display:"grid",
gridTemplateColumns:"2fr 1fr 1fr 1fr auto",
gap:"22px"
}}
>

<input
placeholder="🔍 Search Employee..."
value={search}
onChange={(e)=>setSearch(e.target.value)}
style={{
borderRadius:12,
border:"1px solid #dbeafe",
padding:"16px 18px",
fontSize:"17px",
height:"55px"
}}
/>

<select
value={departmentFilter}
onChange={(e)=>setDepartmentFilter(e.target.value)}
style={filterStyle}
>
<option value="">Department</option>
<option>HR</option>
<option>Production</option>
<option>AI</option>
<option>Finance</option>
</select>

<select
value={roleFilter}
onChange={(e)=>setRoleFilter(e.target.value)}
style={filterStyle}
>
<option value="">Role</option>
<option>employee</option>
<option>hr</option>
<option>admin</option>
<option>owner</option>
</select>

<select
value={statusFilter}
onChange={(e)=>setStatusFilter(e.target.value)}
style={filterStyle}
>
<option value="">Status</option>
<option>active</option>
<option>inactive</option>
</select>

<button
onClick={()=>{
setSearch("")
setDepartmentFilter("")
setRoleFilter("")
setStatusFilter("")
}}
style={{
background:"#111827",
color:"#fff",
border:"none",
borderRadius:12,
padding:"14px 18px",
cursor:"pointer",
fontWeight:700
}}
>
Reset
</button>

</div>

</div>

  <div
    style={{
      background: "#fff",
      borderRadius: "12px",
      overflowX: "auto",
      boxShadow:
        "0 4px 15px rgba(0,0,0,0.08)",
    }}
  >
    <table
      style={{
        width:"100%",
minWidth:"1600px",
        borderCollapse: "collapse",
      }}
    >
      <thead>
        <tr
          style={{
            background: "#f8fafc",
          }}
        >
          <th style={th}>Name</th>
          <th style={th}>Employee ID</th>
          <th style={th}>Email</th>
          <th style={th}>Department</th>
          <th style={th}>Designation</th>
          <th style={th}>Role</th>
          <th style={th}>Status</th>
          <th style={th}>Actions</th>
        </tr>
      </thead>

      <tbody>
        {filteredUsers.map((user) => (
            <tr key={user.id}>
            <td style={td}>
  {user.firstName || user.lastName
    ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
    : "-"}
</td>
            <td style={td}>
  {editingId === user.id ? (
    <>
      <input
        type="text"
        placeholder="Search Employee..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          padding: "6px",
          width: "90px",
          marginRight: "8px",
        }}
      />

      <button
        onClick={() => saveEmployeeId(user.id)}
        style={greenBtn}
      >
        Save
      </button>
    </>
  ) : (
    <>
      {user.employeeId || "-"}

      <button
        style={{
          marginLeft: "10px",
          padding: "5px 10px",
          cursor: "pointer",
        }}
        onClick={() => {
          setEditingId(user.id);
          setEmployeeCode(user.employeeId || "");
        }}
      >
        ✏️
      </button>
    </>
  )}
</td>
            <td style={td}>
              {user.email || "-"}
            </td>

            <td style={td}>
              {user.department || "-"}
            </td>

            <td style={td}>
              {user.designation || "-"}
            </td>

            <td style={td}>
              {user.role || "employee"}
            </td>

            <td style={td}>
              <span
                style={{
                  padding:
                    "6px 12px",
                  borderRadius:
                    "20px",
                  background:
                    user.status ===
                    "inactive"
                      ? "#fee2e2"
                      : "#dcfce7",
                  color:
                    user.status ===
                    "inactive"
                      ? "#dc2626"
                      : "#16a34a",
                  fontWeight: "600",
                }}
              >
                {user.status ||
                  "active"}
              </span>
            </td>

            <td style={td}>
            <div
                style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                fontSize:"15px",
                }}
            >

                <button
                  style={blackBtn}
                  onClick={() =>
                    window.location.href = `/admin/users/${user.id}`
                  }
                >
                  👁 View
                </button>

              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>

  <div
    style={{
      marginTop: "20px",
      background: "#fff",
      padding: "20px",
      borderRadius: "12px",
      boxShadow:
        "0 4px 15px rgba(0,0,0,0.08)",
    }}
  >
    <strong>
      Total Employees: {users.length}
    </strong>
  </div>
</div>

);
}

const th = {
  textAlign: "left",
  padding: "22px",
  fontSize: "18px",
  fontWeight: 700,
  borderBottom: "2px solid #e5e7eb",
};

const td = {
  padding: "20px",
  fontSize: "17px",
  borderBottom: "1px solid #f1f5f9",
};

const blueBtn = {
background: "#2563eb",
color: "#fff",
border: "none",
padding: "8px 12px",
borderRadius: "6px",
cursor: "pointer",
};

const greenBtn = {
background: "#16a34a",
color: "#fff",
border: "none",
padding: "8px 12px",
borderRadius: "6px",
cursor: "pointer",
};

const orangeBtn = {
background: "#f59e0b",
color: "#fff",
border: "none",
padding: "8px 12px",
borderRadius: "6px",
cursor: "pointer",
};

const redBtn = {
background: "#dc2626",
color: "#fff",
border: "none",
padding: "8px 12px",
borderRadius: "6px",
cursor: "pointer",
};

const blackBtn = {
background: "#111827",
color: "#fff",
border: "none",
padding: "8px 12px",
borderRadius: "6px",
cursor: "pointer",
};

const card = {
  background: "#fff",
  padding: "25px",
  borderRadius: "15px",
  boxShadow: "0 5px 20px rgba(0,0,0,0.08)",
  textAlign: "center",
};

const filterStyle = {
padding: "14px",
borderRadius: "12px",
border: "1px solid #dbeafe",
fontSize: "15px",
background: "#fff",
};