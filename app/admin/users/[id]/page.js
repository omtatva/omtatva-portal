"use client";
import LetterOfIntent from "../components/LetterOfIntent";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../../../lib/firebase";

export default function EmployeePage() {

const { id } = useParams();

const [user,setUser] = useState(null);
const [editMode, setEditMode] = useState(false);
const [showLOI, setShowLOI] = useState(false);
const [showPreview, setShowPreview] = useState(false);
const [joiningDate, setJoiningDate] = useState("");
const [designation, setDesignation] = useState("");
const [performanceBand, setPerformanceBand] = useState("");
const currentDate = new Date().toLocaleDateString("en-IN");
useEffect(() => {
loadUser();
}, []);

const loadUser = async () => {

  const docRef = doc(db, "users", id);

  const snap = await getDoc(docRef);

if (snap.exists()) {
  const data = snap.data();

  setUser(data);

   setPerformanceBand(data.performance || " ");
}

};

const saveUser = async () => {

  await updateDoc(doc(db, "users", id), user);

  alert("Employee Updated Successfully");

  setEditMode(false);

};
const handleResumeUpload = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const { getStorage, ref, uploadBytes, getDownloadURL } =
    await import("firebase/storage");

  const storage = getStorage();

  const storageRef = ref(
    storage,
    `resumes/${id}/${file.name}`
  );
  
console.log("URL ID:", id);
console.log("User UID:", user.uid);
  await uploadBytes(storageRef, file);

  const url = await getDownloadURL(storageRef);

  await updateDoc(doc(db, "users", id), {
    resume: url,
  });

  setUser({
    ...user,
    resume: url,
  });

  alert("Resume Updated");
};

const updatePerformance = async () => {
  try {
    await updateDoc(doc(db, "users", id), {
      performance: performanceBand,
      performanceUpdatedAt: new Date(),
    });

    await loadUser();

    alert("Performance Updated Successfully");
  } catch (err) {
    console.log(err);
    alert("Failed");
  }
};

if(!user){

return <h2 style={{padding:40}}>Loading...</h2>

}
const generatePDF = async () => {
  const html2pdf = (await import("html2pdf.js")).default;

  const element = document.getElementById("loi-document");

  html2pdf()
    .set({
      margin: 0.5,
      filename: `LOI_${user.firstName}_${user.lastName}.pdf`,
      image: {
        type: "jpeg",
        quality: 1,
      },
      html2canvas: {
        scale: 2,
      },
      jsPDF: {
        unit: "in",
        format: "a4",
        orientation: "portrait",
      },
    })
    .from(element)
    .save();
};

return (

<div
style={{
  width: "100%",
maxWidth: "1800px",
margin:"40px auto",
padding:30,
background:"#fff",
borderRadius:15,
 fontSize: "20px",
boxShadow:"0 10px 30px rgba(0,0,0,.08)"
}}
>

  <div
style={{
display:"flex",
gap:15
}}
>

<button
onClick={()=>window.location.href="/admin/users"}
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
</div>

<div
  style={{
    display: "flex",
    gap: "25px",
    alignItems: "center",
    marginBottom: "30px",
  }}
>
  <img
    src={user.photoURL || "/profile.png"}
    alt="Profile"
    style={{
      width: 140,
      height: 140,
      borderRadius: "50%",
      objectFit: "cover",
      border: "5px solid #2563eb",
    }}
  />

  <div style={{ flex: 1 }}>
    <h1 style={{ marginBottom: 5 }}>
      {user.firstName} {user.lastName}
    </h1>

    <h3
      style={{
        marginTop: 0,
        color: "#64748b",
      }}
    >
      {user.designation || "Employee"}
    </h3>

    <p>
      <b>Department:</b> {user.department || "-"}
    </p>

    <p>
      <b>Employee ID:</b> {user.employeeId || "-"}
    </p>

    <p>
      <b>Email:</b> {user.email}
    </p>

    <span
      style={{
        display: "inline-block",
        marginTop: 10,
        padding: "8px 18px",
        borderRadius: 20,
        background:
          user.status === "active"
            ? "#dcfce7"
            : "#fee2e2",
        color:
          user.status === "active"
            ? "#15803d"
            : "#dc2626",
        fontWeight: 700,
      }}
    >
      {user.status || "Active"}
    </span>
  </div>
</div>

<div
  style={{
    marginTop: 20,
    marginBottom: 30,
    display: "flex",
    gap: 15,
  }}
>
  <button
    onClick={() => setEditMode(!editMode)}
    style={{
      padding: "10px 20px",
      background: "#2563eb",
      color: "#fff",
      border: "none",
      borderRadius: 8,
      cursor: "pointer",
    }}
  >
    {editMode ? "Cancel" : "Edit Employee"}
  </button>

  {editMode && (
    <button
      onClick={saveUser}
      style={{
        padding: "10px 20px",
        background: "#16a34a",
        color: "#fff",
        border: "none",
        borderRadius: 8,
        cursor: "pointer",
      }}
    >
      Save Changes
    </button>
  )}
</div>

<hr/>
<div
  style={{
    display: "grid",
    gridTemplateColumns:
"repeat(auto-fit,minmax(280px,1fr))",
    gap: "20px",
    marginBottom: "40px",
  }}
>

<div style={cardStyle}>
<h3>Attendance</h3>
<h1>{user.attendanceCount || 0}</h1>
<p>This Month</p>
</div>

<div style={cardStyle}>
<h3>Timesheets</h3>
<h1>{user.timesheetCount || 0}</h1>
<p>Submitted</p>
</div>

<div style={cardStyle}>
<h3>Total Hours</h3>
<h1>{user.totalHours || 0}</h1>
<p>Working Hours</p>
</div>
<div style={cardStyle}>

  <h3>⭐ Performance</h3>

  <select
    value={performanceBand}
    onChange={(e) => setPerformanceBand(e.target.value)}
    style={{
      width: "100%",
      padding: "12px",
      marginTop: "15px",
      borderRadius: "10px",
      fontSize: "18px",
      border: "1px solid #d1d5db",
    }}
  >

    <option value="Outstanding">Outstanding</option>
<option value="Excellent">Excellent</option>
<option value="Very Good">Very Good</option>
<option value="Good">Good</option>
<option value="Average">Average</option>
<option value="Needs Improvement">Needs Improvement</option>

  </select>

  <button
    onClick={updatePerformance}
    style={{
      marginTop: "20px",
      width: "100%",
      padding: "12px",
      background: "#3d6fa8",
      color: "#fff",
      border: "none",
      borderRadius: "10px",
      cursor: "pointer",
      fontWeight: "700",
      fontSize: "16px",
    }}
  >
    Update Rating
  </button>

</div>

</div>
<h2 style={{ marginBottom: "20px" }}>
⚡ HR Quick Actions
</h2>

<div
style={{
display:"flex",
gap:"15px",
flexWrap:"wrap",
marginBottom:"40px",

}}
>

<button
style={blueBtn}
onClick={() =>
window.location.href = `/admin/attendance?employee=${id}`
}
>
Attendance
</button>

<button
style={greenBtn}
onClick={() =>
window.location.href = `/admin/leave?employee=${id}`
}
>
Leave History
</button>

<button
style={orangeBtn}
onClick={() =>
window.location.href = `/admin/payroll?employee=${id}`
}
>
Payroll
</button>

<button
style={purpleBtn}
onClick={() =>
window.location.href = `/admin/timesheets?employee=${id}`
}
>
Timesheets
</button>

<button
  style={greenBtn}
  onClick={() => {
    setDesignation(user.designation || "");
    setJoiningDate(user.joiningDate || "");
    setShowLOI(true);
  }}
>
  📄 Generate LOI
</button>

<button
style={redBtn}
onClick={async () => {

const confirmDeactivate = window.confirm(
"Deactivate this employee?"
);

if (!confirmDeactivate) return;

await updateDoc(
doc(db, "users", id),
{
status: "inactive",
}
);

alert("Employee Deactivated");

loadUser();

}}
>
Deactivate
</button>

</div>

<h2>Basic Information</h2>
<div style={{ marginBottom: 20 }}>
  <label>First Name</label>

  <input
    disabled={!editMode}
    value={user.firstName || ""}
    onChange={(e) =>
      setUser({
        ...user,
        firstName: e.target.value,
      })
    }
    style={inputStyle}
  />
</div>
<div style={{ marginBottom: 20 }}>
  <label>Last Name</label>

  <input
    disabled={!editMode}
    value={user.lastName || ""}
    onChange={(e) =>
      setUser({
        ...user,
        lastName: e.target.value,
      })
    }
    style={inputStyle}
  />
</div>
<div style={{ marginBottom: 20 }}>
  <label>Employee ID</label>

  <input
    disabled={!editMode}
    value={user.employeeId || ""}
    onChange={(e) =>
      setUser({
        ...user,
        employeeId: e.target.value,
      })
    }
    style={inputStyle}
  />
</div>

<p><b>Email:</b> {user.email}</p>

<div style={{ marginBottom: 20 }}>
  <label>Phone</label>

  <input
    disabled={!editMode}
    value={user.phone || ""}
    onChange={(e) =>
      setUser({
        ...user,
        phone: e.target.value,
      })
    }
    style={inputStyle}
  />
</div>

<p><b>DOB:</b> {user.dob}</p>

<p><b>Gender:</b> {user.gender}</p>

<p><b>Blood Group:</b> {user.bloodGroup}</p>

<hr style={sectionDivider} />

<h2>💼 Job Information</h2>

<div
  style={{
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  columnGap: "40px",
  rowGap: "25px",
  marginTop: "20px",
}}
>

<div>
<label>Department</label>

<select
disabled={!editMode}
value={user.department || ""}
onChange={(e)=>
setUser({
...user,
department:e.target.value
})
}
style={inputStyle}
>

<option>Production</option>
<option>Editing</option>
<option>VFX</option>
<option>Animation</option>
<option>Marketing</option>
<option>HR</option>
<option>Accounts</option>
<option>IT</option>

</select>

</div>

<div>

<label>Designation</label>

<input
disabled={!editMode}
value={user.designation || ""}
onChange={(e)=>
setUser({
...user,
designation:e.target.value
})
}
style={inputStyle}
/>

</div>

<div>

<label>Joining Date</label>

<input
type="date"
disabled={!editMode}
value={user.joiningDate || ""}
onChange={(e)=>
setUser({
...user,
joiningDate:e.target.value
})
}
style={inputStyle}
/>

</div>

<div>

<label>Role</label>

<select
disabled={!editMode}
value={user.role || ""}
onChange={(e)=>
setUser({
...user,
role:e.target.value
})
}
style={inputStyle}
>

<option>employee</option>
<option>head</option>
<option>owner</option>
<option>admin</option>

</select>

</div>

<div>

<label>Status</label>

<select
disabled={!editMode}
value={user.status || ""}
onChange={(e)=>
setUser({
...user,
status:e.target.value
})
}
style={inputStyle}
>

<option>active</option>

<option>inactive</option>

</select>

</div>

</div>

<hr style={sectionDivider} />

<h2>💻 Company Access</h2>

<div
  style={{
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  columnGap: "40px",
  rowGap: "25px",
  marginTop: "20px",
}}
>

<div>
<label>Slack ID</label>

<input
disabled={!editMode}
value={user.slackId || ""}
onChange={(e)=>
setUser({
...user,
slackId:e.target.value
})
}
style={inputStyle}
/>
</div>

<div>
<label>Google Workspace Email</label>

<input
disabled={!editMode}
value={user.email || ""}
style={inputStyle}
/>
</div>

<div>
<label>Frame.io Email</label>

<input
disabled={!editMode}
value={user.frameioEmail || ""}
onChange={(e)=>
setUser({
...user,
frameioEmail:e.target.value
})
}
style={inputStyle}
/>
</div>

<div>
<label>Manager</label>

<input
disabled={!editMode}
value={user.manager || ""}
onChange={(e)=>
setUser({
...user,
manager:e.target.value
})
}
style={inputStyle}
/>
</div>

<div>
<label>Employment Type</label>

<select
disabled={!editMode}
value={user.employmentType || ""}
onChange={(e)=>
setUser({
...user,
employmentType:e.target.value
})
}
style={inputStyle}
>

<option value="">Select</option>
<option>Full Time</option>
<option>Intern</option>
<option>Contract</option>
<option>Freelancer</option>

</select>

</div>

<div>
<label>Work Location</label>

<select
disabled={!editMode}
value={user.workLocation || ""}
onChange={(e)=>
setUser({
...user,
workLocation:e.target.value
})
}
style={inputStyle}
>

<option value="">Select</option>
<option>Office</option>
<option>Remote</option>
<option>Hybrid</option>

</select>

</div>

</div>

<hr style={sectionDivider} />

<h2>🚨 Emergency Contact</h2>

<div
  style={{
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  columnGap: "40px",
  rowGap: "25px",
  marginTop: "20px",
}}
>

  <div>
    <label>Emergency Contact</label>

    <input
      disabled={!editMode}
      value={user.emergencyContact || ""}
      onChange={(e) =>
        setUser({
          ...user,
          emergencyContact: e.target.value,
        })
      }
      style={inputStyle}
    />
  </div>

  <div>
    <label>Emergency Phone</label>

    <input
      disabled={!editMode}
      value={user.emergencyPhone || ""}
      onChange={(e) =>
        setUser({
          ...user,
          emergencyPhone: e.target.value,
        })
      }
      style={inputStyle}
    />
  </div>

</div>

<hr style={sectionDivider} />

<h2>🏠 Address</h2>

<div
  style={{
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  columnGap: "40px",
  rowGap: "25px",
  marginTop: "20px",
}}
>

  <div style={{ gridColumn: "1 / span 2" }}>
    <label>Street Address</label>

    <input
      disabled={!editMode}
      value={user.address || ""}
      onChange={(e) =>
        setUser({
          ...user,
          address: e.target.value,
        })
      }
      style={inputStyle}
    />
  </div>

    <div>
    <label>City</label>

    <input
      disabled={!editMode}
      value={user.city || ""}
      onChange={(e) =>
        setUser({
          ...user,
          city: e.target.value,
        })
      }
      style={inputStyle}
    />
  </div>

  <div>
    <label>State</label>

    <input
      disabled={!editMode}
      value={user.state || ""}
      onChange={(e) =>
        setUser({
          ...user,
          state: e.target.value,
        })
      }
      style={inputStyle}
    />
  </div>
<div>
  <label>Country</label>

  <input
    disabled={!editMode}
    value={user.country || ""}
    onChange={(e) =>
      setUser({
        ...user,
        country: e.target.value,
      })
    }
    style={inputStyle}
  />
</div>

</div>   {/* <-- CLOSE THE ADDRESS GRID */}
<hr style={sectionDivider} />

<h2>📁 Documents & Assets</h2>

<div
  style={{
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  columnGap: "40px",
  rowGap: "25px",
  marginTop: "20px",
}}
>

<div>
  <label>Resume</label>

  {user.resume ? (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        marginTop: "10px",
      }}
    >
      <a
        href={user.resume}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          background: "#2563eb",
          color: "#fff",
          padding: "10px 18px",
          borderRadius: "10px",
          textDecoration: "none",
          fontWeight: 600,
        }}
      >
        📄 View Resume
      </a>

      <a
        href={user.resume}
        download
        style={{
          background: "#16a34a",
          color: "#fff",
          padding: "10px 18px",
          borderRadius: "10px",
          textDecoration: "none",
          fontWeight: 600,
        }}
      >
        ⬇ Download
      </a>
    </div>
  ) : (
    <p
      style={{
        color: "#64748b",
        marginTop: "12px",
      }}
    >
      No resume uploaded.
    </p>
  )}


{/* Only show when HR/Admin clicks Edit Employee */}

  {editMode && (
    <div style={{ marginTop: "15px" }}>
      <input
        type="file"
        accept=".pdf,.doc,.docx"
        onChange={handleResumeUpload}
      />
    </div>
  )}
</div>

<div>

<label>Offer Letter URL</label>

<input
disabled={!editMode}
value={user.offerLetter || ""}
onChange={(e)=>
setUser({
...user,
offerLetter:e.target.value
})
}
style={inputStyle}
/>

</div>

<div>

<label>ID Proof URL</label>

<input
disabled={!editMode}
value={user.idProof || ""}
onChange={(e)=>
setUser({
...user,
idProof:e.target.value
})
}
style={inputStyle}
/>

</div>

<div>

<label>Bank Account</label>

<input
disabled={!editMode}
value={user.bankAccount || ""}
onChange={(e)=>
setUser({
...user,
bankAccount:e.target.value
})
}
style={inputStyle}
/>

</div>

<div>

<label>Laptop Assigned</label>

<input
disabled={!editMode}
value={user.laptop || ""}
onChange={(e)=>
setUser({
...user,
laptop:e.target.value
})
}
style={inputStyle}
/>

</div>

<div>

<label>Laptop Serial No.</label>

<input
disabled={!editMode}
value={user.laptopSerial || ""}
onChange={(e)=>
setUser({
...user,
laptopSerial:e.target.value
})
}
style={inputStyle}
/>

</div>

</div>


<hr style={{ margin: "50px 0" }} />

<h2>📝 HR Notes</h2>

<textarea
disabled={!editMode}
value={user.hrNotes || ""}
onChange={(e)=>
setUser({
...user,
hrNotes:e.target.value
})
}
style={{
width:"100%",
height:"180px",
padding:"15px",
marginTop:"20px",
borderRadius:"10px",
border:"1px solid #d1d5db",
fontSize:"19px"
}}
placeholder="Private HR Notes..."
/>

<h2 style={{ marginTop: "40px" }}>
📅 Employee Timeline
</h2>

<div
style={{
background:"#f8fafc",
padding:"25px",
borderRadius:"15px",
marginTop:"20px"
}}
>

<p>✅ Joined Company : {user.joiningDate || "-"}</p>

<p>👤 Profile Completed</p>

<p>💼 Department Assigned</p>

<p>🖥 Laptop Assigned</p>

<p>📄 Offer Letter Uploaded</p>

<p>
  🎉 Last Updated :{" "}
  {user.updatedAt?.toDate?.().toLocaleDateString() || "-"}
</p>

</div>
{showLOI && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,.6)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 9999,
    }}
  >
    <div
      style={{
        width: "500px",
        background: "#fff",
        padding: "30px",
        borderRadius: "12px",
      }}
    >
      <h2>Generate Letter of Intent</h2>

      <p>
        <b>Employee</b>
      </p>

      <input
        value={`${user.firstName} ${user.lastName}`}
        disabled
        style={inputStyle}
      />

      <p>Email</p>

      <input
        value={user.email}
        disabled
        style={inputStyle}
      />

      <p>Designation</p>

      <input
        value={designation}
        onChange={(e) => setDesignation(e.target.value)}
        style={inputStyle}
      />

      <p>Joining Date</p>

      <input
        type="date"
        value={joiningDate}
        onChange={(e) => setJoiningDate(e.target.value)}
        style={inputStyle}
      />

      <div
        style={{
          display: "flex",
          gap: "15px",
          marginTop: "25px",
        }}
      >
        <button
  style={greenBtn}
  onClick={() => {
    setShowLOI(false);
    setShowPreview(true);
  }}
>
  Generate
</button>

        <button
          style={redBtn}
          onClick={() => setShowLOI(false)}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
)}
{showPreview && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,.7)",
      overflow: "auto",
      zIndex: 9999,
      padding: "40px",
    }}
  >
    <div
      style={{
        maxWidth: "900px",
        margin: "auto",
        background: "#fff",
        borderRadius: "10px",
        overflow: "hidden",
      }}
    >
      <div id="loi-document">
        <LetterOfIntent
          employeeName={`${user.firstName} ${user.lastName}`}
          designation={designation}
          joiningDate={joiningDate}
          currentDate={currentDate}
        />
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "20px",
          padding: "20px",
          borderTop: "1px solid #eee",
        }}
      >
        <button
          style={greenBtn}
          onClick={generatePDF}
        >
          📄 Download PDF
        </button>

        {/* <button
          style={greenBtn}
          onClick={sendLOI}
        >
          📧 Send LOI
        </button> */}

        <button
          style={redBtn}
          onClick={() => setShowPreview(false)}
        >
          Close
        </button>

        
      </div>
    </div>
  </div>
)}
</div>

);
}
const inputStyle = {
  width: "98%",
  padding: "14px 16px",
  marginTop: "8px",
  marginBottom: "15px",
  border: "1px solid #d1d5db",
  borderRadius: "10px",
  fontSize: "19px",
  boxSizing: "border-box",
};

const sectionDivider = {
  margin: "60px 0",
  border: "none",
  borderTop: "1px solid #d1d5db",
};

const cardStyle = {
  background: "#f8fafc",
  padding: "25px",
  borderRadius: "15px",
  textAlign: "center",
  boxShadow: "0 4px 15px rgba(0,0,0,.06)",
};

const purpleBtn = {
  background: "#7c3aed",
  color: "#fff",
  border: "none",
  padding: "12px 20px",
  borderRadius: "8px",
  cursor: "pointer",
   fontSize: "19px",
};

const blueBtn = {
  background: "#2563eb",
  color: "#fff",
  border: "none",
  padding: "10px 18px",
  borderRadius: "8px",
  cursor: "pointer",
   fontSize: "19px",
};
const greenBtn = {
  background: "#16a34a",
  color: "#fff",
  border: "none",
  padding: "10px 18px",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "600",
   fontSize: "19px",
};
const redBtn = {
  background: "#dc2626",
  color: "#fff",
  border: "none",
  padding: "10px 18px",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "600",
   fontSize: "19px",
};

const orangeBtn = {
  background: "#f59e0b",
  color: "#fff",
  border: "none",
  padding: "10px 18px",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "600",
   fontSize: "19px",
};

const grayBtn = {
  background: "#64748b",
  color: "#fff",
  border: "none",
  padding: "10px 18px",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "600",
   fontSize: "19px",
};