"use client";

import { useEffect, useState } from "react";

import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  doc,
  Timestamp,
} from "firebase/firestore";

import { db } from "../../../lib/firebase";
import { usePermission } from "../../../lib/usePermission";

export default function HolidaysPage() {
  const { canEdit } = usePermission("holidays");
  const [holidays, setHolidays] = useState([]);

  const [holidayName, setHolidayName] = useState("");
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayType, setHolidayType] = useState("");
  const [description, setDescription] = useState("");

  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadHolidays();
  }, []);

  const loadHolidays = async () => {
    try {
      const snapshot = await getDocs(collection(db, "holidays"));

      const data = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }));

      data.sort((a, b) => new Date(a.date) - new Date(b.date));

      setHolidays(data);
    } catch (error) {
      console.log(error);
    }
  };

  const saveHoliday = async () => {
    if (!holidayName || !holidayDate) {
      alert("Please fill required fields");
      return;
    }

    try {
      setLoading(true);

      const holidayData = {
        name: holidayName,
        date: holidayDate,
        year: new Date(holidayDate).getFullYear(),
        category: holidayType || "Optional",
        description,
        updatedAt: Timestamp.now(),
      };

      if (editId) {
        await updateDoc(doc(db, "holidays", editId), holidayData);
        alert("Holiday Updated");
      } else {
        await addDoc(collection(db, "holidays"), {
          ...holidayData,
          createdAt: Timestamp.now(),
        });
        alert("Holiday Added");
      }

      clearForm();
      loadHolidays();
    } catch (error) {
      console.log(error);
      alert("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const clearForm = () => {
    setHolidayName("");
    setHolidayDate("");
    setHolidayType("");
    setDescription("");
    setEditId(null);
  };

  const editHoliday = (item) => {
    setEditId(item.id);
    setHolidayName(item.name);
    setHolidayDate(item.date);
    setHolidayType(item.category);
    setDescription(item.description || "");

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteHoliday = async (id) => {
    if (!confirm("Delete holiday?")) return;

    await deleteDoc(doc(db, "holidays", id));
    loadHolidays();
  };

  // Local YYYY-MM-DD string (not a UTC-parsed Date timestamp) — avoids
  // timezone drift when comparing against the stored "date" string.
  const getLocalDateString = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getStatus = (date) => {
    const todayStr = getLocalDateString(new Date());

    if (date === todayStr) return "Today";
    if (date < todayStr) return "Completed";
    return "Upcoming";
  };

  const daysUntil = (dateStr) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    const target = new Date(y, m - 1, d);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  };

  const filtered = holidays.filter((item) =>
    item.name?.toLowerCase().includes(search.toLowerCase())
  );

  const todayStr = getLocalDateString(new Date());
  const upcoming = holidays.find((item) => item.date >= todayStr);

  return (
    <div className="page">
      <div className="header">
        <h1 className="pageTitle">📅 Holiday Dashboard</h1>

        <button className="dashboard" onClick={() => (window.location.href = "/admin")}>
          ← Dashboard
        </button>
      </div>

      <div className="cards">
        <Card title="Total Holidays" value={holidays.length} />
        <Card
          title="National"
          value={holidays.filter((x) => x.category === "National").length}
        />
        <Card
          title="Festival"
          value={holidays.filter((x) => x.category === "Festival").length}
        />
        <Card
          title="Upcoming"
          value={holidays.filter((x) => getStatus(x.date) === "Upcoming").length}
        />
      </div>

      {upcoming && (
        <div className="next">
          <div>
            <h2>🎉 Next Holiday</h2>
            <h1>{upcoming.name || upcoming.holidayName}</h1>
            <p>📅 {upcoming.date}</p>
            <p>🏷️ {upcoming.category || upcoming.type}</p>
          </div>

          <div className="days">
            {daysUntil(upcoming.date)}
            <br />
            <small>Days Left</small>
          </div>
        </div>
      )}

      <div className="box">
        <h2>{editId ? "✏️ Edit Holiday" : "➕ Add Holiday"}</h2>

        <div className="form">
          <input
            placeholder="Holiday Name"
            value={holidayName}
            onChange={(e) => setHolidayName(e.target.value)}
          />

          <input
            type="date"
            value={holidayDate}
            onChange={(e) => setHolidayDate(e.target.value)}
          />

          <select value={holidayType} onChange={(e) => setHolidayType(e.target.value)}>
            <option value="">Category</option>
            <option>National</option>
            <option>Festival</option>
            <option>Company</option>
            <option>Optional</option>
          </select>

          <input
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <button className="save" onClick={saveHoliday} disabled={!canEdit} title={canEdit ? undefined : "View only — you don't have edit access for Holidays"}>
          {loading ? "Saving..." : editId ? "Update Holiday" : "Add Holiday"}
        </button>

        {editId && (
          <button className="cancel" onClick={clearForm}>
            Cancel
          </button>
        )}
      </div>

      {/* Holiday List */}
      <div className="box">
        <h2>📋 Holiday List</h2>

        <input
          className="search"
          placeholder="Search holiday..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Holiday</th>
                <th>Date</th>
                <th>Category</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="5" className="empty">
                    No holidays found
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.name}</strong>
                      <br />
                      <small>{item.description}</small>
                    </td>

                    <td>{item.date}</td>

                    <td>
                      <span className={"badge " + item.category}>{item.category}</span>
                    </td>

                    <td>
                      <span className={"status " + getStatus(item.date)}>
                        {getStatus(item.date)}
                      </span>
                    </td>

                    <td>
                      {canEdit ? (
                        <>
                          <button className="edit" onClick={() => editHoliday(item)}>
                            ✏️
                          </button>

                          <button className="delete" onClick={() => deleteHoliday(item.id)}>
                            🗑
                          </button>
                        </>
                      ) : (
                        <span style={{ color: "#94a3b8", fontSize: 13 }}>View only</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Card({ title, value }) {
  return (
    <div className="card">
      <h3>{title}</h3>
      <h1>{value}</h1>
    </div>
  );
}

const styles = `
.header h1{
font-size:52px;
font-weight:800;
color:#111111;
margin:0;
}

.page{
max-width:1800px;
margin:40px auto;
padding:35px;
font-family:Arial,sans-serif;
}

.header{
display:flex;
justify-content:space-between;
align-items:center;
margin-bottom:35px;
background:#ffffff;
padding:35px;
border-radius:25px;
box-shadow:0 10px 30px rgba(61,111,168,0.12);
border:1px solid #eaf3ff;
}

.dashboard{
background:#3d6fa8;
color:#ffffff;
border:none;
padding:15px 28px;
border-radius:14px;
cursor:pointer;
font-size:16px;
font-weight:700;
box-shadow:0 6px 15px rgba(61,111,168,0.25);
transition:0.3s;
}

.dashboard:hover{
background:#66a8e0;
transform:translateY(-2px);
}

.cards{
display:grid;
grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
gap:20px;
margin-bottom:30px;
}

.card{
background:white;
padding:25px;
border-radius:18px;
box-shadow:0 10px 25px rgba(0,0,0,.08);
}

.card h3{
color:#3d6fa8;
margin:0;
}

.card h1{
font-size:35px;
margin-top:15px;
}

.next{
background:linear-gradient(135deg,#3d6fa8,#60a5fa);
color:white;
padding:30px;
border-radius:20px;
margin-bottom:30px;
display:flex;
justify-content:space-between;
align-items:center;
flex-wrap:wrap;
gap:20px;
}

.next .days{
font-size:40px;
font-weight:800;
text-align:center;
}

.box{
background:white;
padding:30px;
border-radius:18px;
box-shadow:0 10px 25px rgba(0,0,0,.08);
margin-bottom:30px;
}

.form{
display:grid;
grid-template-columns:repeat(auto-fit,minmax(250px,1fr));
gap:20px;
margin-top:20px;
}

.form input,
.form select,
.search{
padding:13px;
border:1px solid #ddd;
border-radius:10px;
font-size:15px;
}

.save{
margin-top:25px;
background:#16a34a;
color:white;
border:none;
padding:14px 25px;
border-radius:10px;
cursor:pointer;
font-weight:bold;
}

.cancel{
margin-left:15px;
padding:14px 25px;
border:none;
background:#64748b;
color:white;
border-radius:10px;
}

.search{
width:300px;
margin:20px 0;
}

.tableWrap{
overflow-x:auto;
}

table{
width:100%;
border-collapse:collapse;
min-width:900px;
}

th{
background:#f8fafc;
padding:15px;
text-align:left;
}

td{
padding:15px;
border-bottom:1px solid #eee;
}

.badge,
.status{
padding:7px 14px;
border-radius:20px;
font-size:13px;
font-weight:bold;
}

.National{
background:#dbeafe;
color:#1d4ed8;
}

.Festival{
background:#f3e8ff;
color:#7e22ce;
}

.Company{
background:#dcfce7;
color:#15803d;
}

.Optional{
background:#ffedd5;
color:#c2410c;
}

.status.Upcoming{
background:#dcfce7;
color:#15803d;
}

.status.Completed{
background:#e5e7eb;
color:#374151;
}

.status.Today{
background:#fee2e2;
color:#dc2626;
}

.edit{
background:#3d6fa8;
color:white;
border:none;
padding:8px;
border-radius:8px;
cursor:pointer;
margin-right:8px;
}

.delete{
background:#dc2626;
color:white;
border:none;
padding:8px;
border-radius:8px;
cursor:pointer;
}

.empty{
text-align:center;
padding:30px;
color:#64748b;
}

@media(max-width:700px){
.page{
padding:15px;
}
.header{
flex-direction:column;
gap:20px;
align-items:flex-start;
}
.search{
width:100%;
}
}

`;

if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.innerHTML = styles;
  document.head.appendChild(style);
}