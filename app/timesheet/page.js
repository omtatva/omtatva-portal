"use client";

import { useEffect, useState } from "react";
import { addDoc, collection } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

export default function TimesheetPage() {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [client, setClient] = useState("");
  const [episode, setEpisode] = useState("");
  const [task, setTask] = useState("");
  const [minutes, setMinutes] = useState("");
  const [tool, setTool] = useState("");
  const [hours, setHours] = useState("");
  const [status, setStatus] = useState("Completed");
  const [notes, setNotes] = useState("");
  const [myTimesheets, setMyTimesheets] = useState([]);

  // Same guard as AttendancePage.js — this page shouldn't be viewable
  // (even the form/history) until we know the user is logged in.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        window.location.href = "/login";
        return;
      }
      setCheckingAuth(false);
    });

    return () => unsubscribe();
  }, []);

  const saveTimesheet = async () => {
    const user = auth.currentUser;

    if (!user) {
      alert("Please login first");
      return;
    }

    if (!client || !task || !hours || !minutes) {
      alert("Please fill required fields");
      return;
    }

    try {
      await addDoc(collection(db, "timesheets"), {
        userId: user.uid,
        employeeName: user.displayName,
        email: user.email,

        client,
        episodeName: episode,
        task,
        aiTool: tool,
        hours: Number(hours),
        minutesWorked: Number(minutes),
        status,
        notes,

        workDate: new Date().toISOString().split("T")[0],
        createdAt: new Date(),
      });

      alert("Timesheet Saved Successfully");

      setClient("");
      setEpisode("");
      setTask("");
      setTool("");
      setHours("");
      setMinutes("");
      setStatus("Completed");
      setNotes("");

    } catch (error) {
      console.error(error);
      alert("Failed to save timesheet");
    }
  };

  if (checkingAuth) {
    return null;
  }

  return (
  <div
    style={{
    width: "100%",
    padding: "8px",
    background: "var(--bg-color)",
    minHeight: "100%",
  }}
  >

    <style jsx global>{`
      .timesheet-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 20px;
      }
      .ts-history-desktop {
        display: block;
      }
      .ts-history-mobile {
        display: none;
        flex-direction: column;
        gap: 12px;
      }
      @media (max-width: 700px) {
        .ts-header {
          padding: 20px !important;
        }
        .ts-header h1 {
          font-size: 24px !important;
        }
        .ts-header p {
          font-size: 14px !important;
        }
        .ts-form-card,
        .ts-history-card {
          padding: 20px !important;
        }
        .ts-form-card h2,
        .ts-history-card h2 {
          font-size: 22px !important;
        }
        .timesheet-grid {
          grid-template-columns: 1fr !important;
          gap: 14px !important;
        }
        .ts-save-btn {
          width: 100% !important;
        }
        .ts-history-desktop {
          display: none !important;
        }
        .ts-history-mobile {
          display: flex !important;
        }
      }
    `}</style>

    {/* Header */}
    <div
      className="ts-header"
      style={{
        background: "var(--card-bg)",
        padding:"35px",
        borderRadius:"25px",
        boxShadow:"0 10px 30px rgba(0,0,0,.08)",
        marginBottom:"25px",
      }}
    >

      <h1
        style={{
          fontSize:"clamp(24px, 5vw, 42px)",
          margin:0,
          color:"#1e3a8a",
          fontWeight:800,
        }}
      >
        🎬 Creative Workflow Dashboard
      </h1>

      <p
        style={{
          fontSize:"16px",
          color: "var(--text-muted)",
          marginTop:"12px",
        }}
      >
        Update your current projects, creative tasks, AI tools used and work progress.
      </p>

    </div>



    {/* Form Card */}

    <div
      className="ts-form-card"
      style={{
        background: "var(--card-bg)",
        padding:"30px",
        borderRadius:"25px",
        boxShadow:"0 10px 30px rgba(0,0,0,.08)",
      }}
    >

      <h2
        style={{
          fontSize:"26px",
          marginBottom:"25px",
          color: "var(--text-color)",
        }}
      >
        Add Work Update
      </h2>


      <div className="timesheet-grid">


      {/* Client */}

      <div>
      <label style={labelStyle}>
        Client *
      </label>

      <select
        value={client}
        onChange={(e)=>setClient(e.target.value)}
        style={inputStyle}
      >
        <option value="">
          Select Client
        </option>

        <option>Dashverse</option>
        <option>Internal Project</option>
        <option>Quick TV</option>
        <option>PocketFM</option>

      </select>
      </div>



      {/* Episode */}

      <div>
      <label style={labelStyle}>
        Episode
      </label>

      <input
        style={inputStyle}
        placeholder="Episode Name"
        value={episode}
        onChange={(e)=>setEpisode(e.target.value)}
      />

      </div>




      {/* Task */}

      <div>

      <label style={labelStyle}>
        Task *
      </label>

      <select
        value={task}
        onChange={(e)=>setTask(e.target.value)}
        style={inputStyle}
      >

      <option value="">
        Select Task
      </option>

      <option>Script Writing</option>
      <option>Prompt Engineering</option>
      <option>Image Generation</option>
      <option>Video Generation</option>
      <option>Voice Generation</option>
      <option>Video Editing</option>
      <option>Quality Check</option>

      </select>

      </div>




      {/* AI Tool */}

      <div>

      <label style={labelStyle}>
        AI Tool
      </label>

      <select
        value={tool}
        onChange={(e)=>setTool(e.target.value)}
        style={inputStyle}
      >

      <option value="">
        Select Tool
      </option>

      <option>ChatGPT</option>
      <option>Seedance 2.0</option>
      <option>Higgsfield</option>
      <option>Frameo AI</option>
      <option>Premier Pro</option>
      <option>FCP</option>

      </select>

      </div>



      {/* Hours */}

      <div>

      <label style={labelStyle}>
        Hours Worked *
      </label>

      <input
        type="number"
        min="0"
        step="0.5"
        style={inputStyle}
        placeholder="Example: 5"
        value={hours}
        onChange={(e)=>setHours(e.target.value)}
      />

      </div>

        {/*MINUTES*/}
        <div>

<label style={labelStyle}>
Minutes Worked *
</label>


<input
type="number"
min="0"
placeholder="Example: 45"
style={inputStyle}
value={minutes}
onChange={(e)=>setMinutes(e.target.value)}
/>

</div>

      {/* Status */}

      <div>

      <label style={labelStyle}>
        Current Status
      </label>

      <select
        value={status}
        onChange={(e)=>setStatus(e.target.value)}
        style={inputStyle}
      >

      <option>
        Completed
      </option>

      <option>
        In Progress
      </option>

      <option>
        Pending Review
      </option>

      <option>
        Blocked
      </option>

      </select>

      </div>


      </div>



      <label style={labelStyle}>
        Notes
      </label>


      <textarea
        rows={5}
        style={{
          ...inputStyle,
          height:"130px",
        }}
        placeholder="Describe your work update..."
        value={notes}
        onChange={(e)=>setNotes(e.target.value)}
      />



      <button
        onClick={saveTimesheet}
        className="ts-save-btn"
        style={{
          marginTop:"25px",
          background:"#3d6fa8",
          color:"#fff",
          border:"none",
          padding:"16px 40px",
          borderRadius:"12px",
          fontSize:"18px",
          fontWeight:700,
          cursor:"pointer",
        }}
      >
        💾 Save Work Update
      </button>


    </div>




    {/* History */}

    <div
      className="ts-history-card"
      style={{
        marginTop:"30px",
        background: "var(--card-bg)",
        padding:"30px",
        borderRadius:"25px",
        boxShadow:"0 10px 30px rgba(0,0,0,.08)",
      }}
    >

    <h2
      style={{
        fontSize:"26px",
        marginBottom:"20px",
        color: "var(--text-color)",
      }}
    >
      📋 Creative Work History
    </h2>

    {/* MOBILE cards */}
    <div className="ts-history-mobile">
      {myTimesheets.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>No work updates yet</p>
      ) : (
        myTimesheets.map((item) => (
          <div
            key={item.id}
            style={{
              border: "1px solid var(--border-color)",
              borderRadius: 14,
              padding: 14,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text-color)" }}>{item.client}</span>
              <span style={{ fontSize: 12.5, color: "#3d6fa8", fontWeight: 600 }}>{item.status}</span>
            </div>
            {item.episodeName && (
              <p style={{ margin: "2px 0", fontSize: 13, color: "var(--text-muted)" }}>Episode: {item.episodeName}</p>
            )}
            <p style={{ margin: "2px 0", fontSize: 13, color: "var(--text-muted)" }}>Task: {item.task}</p>
            {item.aiTool && (
              <p style={{ margin: "2px 0", fontSize: 13, color: "var(--text-muted)" }}>Tool: {item.aiTool}</p>
            )}
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
              {item.hours || 0} hrs {item.minutesWorked || 0} min
            </p>
          </div>
        ))
      )}
    </div>

    {/* DESKTOP table */}
    <div className="ts-history-desktop" style={{ overflowX: "auto" }}>
    <table
      style={{
        width:"100%",
        minWidth:"800px",
        marginTop:"5px",
        borderCollapse:"collapse",
        fontSize:"16px",
        color: "var(--text-color)",
      }}
    >

    <thead>

    <tr>

    <th style={thStyle}>
      Client
    </th>

    <th style={thStyle}>
      Episode
    </th>

    <th style={thStyle}>
      Task
    </th>

    <th style={thStyle}>
      AI Tool
    </th>

    <th style={thStyle}>
      Hours
    </th>
      <th style={thStyle}>
Minutes
</th>
    <th style={thStyle}>
      Status
    </th>

    </tr>

    </thead>


    <tbody>

    {myTimesheets.map((item)=>(
      <tr key={item.id}>

      <td style={tdStyle}>
        {item.client}
      </td>

      <td style={tdStyle}>
        {item.episodeName}
      </td>

      <td style={tdStyle}>
        {item.task}
      </td>

      <td style={tdStyle}>
        {item.aiTool}
      </td>

      <td style={tdStyle}>
        {item.hours}
      </td>
      <td style={tdStyle}>
{item.minutesWorked || 0} min
</td>

      <td style={tdStyle}>
        {item.status}
      </td>

      </tr>
    ))}

    </tbody>

    </table>
    </div>

    </div>


  </div>
);
}

const labelStyle = {
  fontSize:"15px",
  fontWeight:700,
  color: "var(--text-color)",
  display:"block",
  marginBottom:"10px",
};


const inputStyle = {
  width:"100%",
  boxSizing:"border-box",
  padding:"14px",
  marginTop:"8px",
  border: "1px solid var(--border-color)",
  borderRadius:"12px",
  fontSize:"15px",
  background: "var(--accent-bg)",
  color: "var(--text-color)",
};


const thStyle = {
  padding:"14px",
  textAlign:"left",
  background: "var(--accent-bg)",
  borderBottom: "1px solid var(--border-color)",
  color: "var(--text-color)",
};


const tdStyle = {
  padding:"14px",
  borderBottom: "1px solid var(--border-color)",
};