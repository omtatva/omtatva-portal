"use client";

import { useState } from "react";
import { addDoc, collection } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

export default function TimesheetPage() {
  const [client, setClient] = useState("");
  const [episode, setEpisode] = useState("");
  const [task, setTask] = useState("");
  const [tool, setTool] = useState("");
  const [hours, setHours] = useState("");
  const [status, setStatus] = useState("Completed");
  const [notes, setNotes] = useState("");
  const [myTimesheets, setMyTimesheets] = useState([]);
  const saveTimesheet = async () => {
    const user = auth.currentUser;

    if (!user) {
      alert("Please login first");
      return;
    }

    if (!client || !task || !hours) {
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
      setStatus("Completed");
      setNotes("");

    } catch (error) {
      console.error(error);
      alert("Failed to save timesheet");
    }
  };

  return (
  <div
    style={{
      width: "95%",
      maxWidth: "1800px",
      margin: "50px auto",
      padding: "40px",
    }}
  >

    {/* Header */}
    <div
      style={{
        background:"#ffffff",
        padding:"35px",
        borderRadius:"25px",
        boxShadow:"0 10px 30px rgba(0,0,0,.08)",
        marginBottom:"35px",
      }}
    >

      <h1
        style={{
          fontSize:"42px",
          margin:0,
          color:"#1e3a8a",
          fontWeight:800,
        }}
      >
        🎬 Creative Workflow Dashboard
      </h1>

      <p
        style={{
          fontSize:"20px",
          color:"#64748b",
          marginTop:"12px",
        }}
      >
        Update your current projects, creative tasks, AI tools used and work progress.
      </p>

    </div>



    {/* Form Card */}

    <div
      style={{
        background:"#fff",
        padding:"50px",
        borderRadius:"25px",
        boxShadow:"0 10px 30px rgba(0,0,0,.08)",
      }}
    >

      <h2
        style={{
          fontSize:"30px",
          marginBottom:"30px",
          color:"#111827",
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
        placeholder="Episode Number"
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
        style={{
          marginTop:"30px",
          background:"#2563eb",
          color:"#fff",
          border:"none",
          padding:"16px 40px",
          borderRadius:"12px",
          fontSize:"20px",
          fontWeight:700,
          cursor:"pointer",
        }}
      >
        💾 Save Work Update
      </button>


    </div>




    {/* History */}

    <div
      style={{
        marginTop:"40px",
        background:"#fff",
        padding:"35px",
        borderRadius:"25px",
        boxShadow:"0 10px 30px rgba(0,0,0,.08)",
      }}
    >

    <h2
      style={{
        fontSize:"30px",
      }}
    >
      📋 Creative Work History
    </h2>


    <table
      style={{
        width:"100%",
        marginTop:"25px",
        borderCollapse:"collapse",
        fontSize:"18px",
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
        {item.status}
      </td>

      </tr>
    ))}

    </tbody>

    </table>

    </div>


  </div>
);
}

const labelStyle = {
  fontSize:"18px",
  fontWeight:700,
  color:"#334155",
  display:"block",
  marginBottom:"12px",
};


const inputStyle = {
  width:"100%",
  boxSizing:"border-box",
  padding:"16px",
  marginTop:"8px",
  border:"1px solid #cbd5e1",
  borderRadius:"12px",
  fontSize:"17px",
  background:"#f8fafc",
};


const thStyle = {
  padding:"16px",
  textAlign:"left",
  background:"#f1f5f9",
  borderBottom:"2px solid #ddd",
};


const tdStyle = {
  padding:"16px",
  borderBottom:"1px solid #eee",
};