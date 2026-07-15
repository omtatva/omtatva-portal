"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";

import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
  updateDoc,
} from "firebase/firestore";

import { auth, db } from "../../lib/firebase";


export default function AttendancePage() {

  const [attendance, setAttendance] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  
const [myAttendance, setMyAttendance] = useState([]);
  const [attendanceHistory, setAttendanceHistory] = useState([]);

  const [presentDays, setPresentDays] = useState(0);
  const [absentDays, setAbsentDays] = useState(0);
  const [lateDays, setLateDays] = useState(0);
  const [workingHours, setWorkingHours] = useState(0);

  const today = new Date().toISOString().split("T")[0];

useEffect(() => {

  const unsubscribe = onAuthStateChanged(auth, async (user) => {

    if (!user) {
      window.location.href = "/login";
      return;
    }

    setCurrentUser(user);

    await loadAttendance(user.uid);

    await loadAttendanceHistory(user.uid);

  });

  return () => unsubscribe();

}, []);

const loadAttendance = async (uid) => {

  const q = query(
    collection(db, "attendance"),
    where("userId", "==", uid),
    where("date", "==", today)
  );

  const snapshot = await getDocs(q);

  if (!snapshot.empty) {

    setAttendance({
      id: snapshot.docs[0].id,
      ...snapshot.docs[0].data(),
    });

  } else {

    setAttendance(null);

  }

};

const loadAttendanceHistory = async (uid) => {

  const q = query(
    collection(db, "attendance"),
    where("userId", "==", uid)
  );

  const snapshot = await getDocs(q);

  const list = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));

  setAttendanceHistory(list);
setMyAttendance(list);

  // Present Days
  setPresentDays(list.length);

  // Absent Days (you can improve this later)
  setAbsentDays(0);

  let late = 0;
  let totalHours = 0;

  list.forEach(item => {

    if (item.PunchIn) {

      const punchIn = item.PunchIn.toDate
        ? item.PunchIn.toDate()
        : new Date(item.PunchIn);

      // Late after 9:15 AM
      if (
        punchIn.getHours() > 9 ||
        (punchIn.getHours() === 9 &&
          punchIn.getMinutes() > 15)
      ) {
        late++;
      }

    }

    if (item.PunchIn && item.PunchOut) {

      const inTime = item.PunchIn.toDate
        ? item.PunchIn.toDate()
        : new Date(item.PunchIn);

      const outTime = item.PunchOut.toDate
        ? item.PunchOut.toDate()
        : new Date(item.PunchOut);

      totalHours +=
        (outTime - inTime) /
        (1000 * 60 * 60);

    }

  });

  setLateDays(late);
  setWorkingHours(totalHours.toFixed(1));

};

const PunchIn = async () => {

  const user = auth.currentUser;

  if (!user) {
    alert("Please login first");
    return;
  }

  if (attendance) {
    alert("Already Punched In Today");
    return;
  }

  try {

    await addDoc(collection(db, "attendance"), {
  userId: user.uid,
  employeeName: user.displayName || user.email,
  email: user.email,

  date: today,

  PunchIn: new Date(),
  PunchOut: null,

  PunchIn: new Date(),
  PunchOut: null,

  totalHours: 0,

  status: "Present",
});

    await loadAttendance(user.uid);
    await loadAttendanceHistory(user.uid);

    alert("Punch In Successful");

  } catch (error) {

    console.error(error);
    alert("Punch In Failed");

  }

};

const PunchOut = async () => {

  const user = auth.currentUser;

  if (!user) {
    alert("Please login first");
    return;
  }

  if (!attendance) {
    alert("Please Punch In First");
    return;
  }

  if (attendance.PunchOut) {
    alert("Already Punched Out");
    return;
  }

  try {

    const q = query(
      collection(db, "attendance"),
      where("userId", "==", user.uid),
      where("date", "==", today)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      alert("Attendance record not found.");
      return;
    }

    const docRef = snapshot.docs[0].ref;

    const outTime = new Date();

const inTime = attendance.PunchIn.toDate
  ? attendance.PunchIn.toDate()
  : new Date(attendance.PunchIn);

const hours =
  ((outTime - inTime) / (1000 * 60 * 60)).toFixed(2);

await updateDoc(docRef,{
  PunchOut: outTime,

  PunchOut: outTime,

  totalHours: hours,

  status: "Present",
});

    await loadAttendance(user.uid);
    await loadAttendanceHistory(user.uid);

    alert("Punch Out Successful");

  } catch (error) {

    console.error(error);
    alert("Punch Out Failed");

  }

};

const totalHours =
  attendance?.PunchIn && attendance?.PunchOut
    ? (
        (
          (
            (attendance.PunchOut.toDate
              ? attendance.PunchOut.toDate()
              : new Date(attendance.PunchOut))
            -
            (attendance.PunchIn.toDate
              ? attendance.PunchIn.toDate()
              : new Date(attendance.PunchIn))
          ) /
          (1000 * 60 * 60)
        ).toFixed(2)
      )
    : "--";

return (
  <div
    style={{
      maxWidth: "1400px",
      margin: "40px auto",
      padding: "30px",
    }}
  >
    <h1>📅 Attendance Dashboard</h1>

    <p
      style={{
        color: "#64748b",
        marginBottom: "30px",
      }}
    >
      Track your attendance, working hours and attendance history.
    </p>

    {/* Summary Cards */}

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4,1fr)",
        gap: "20px",
        marginBottom: "30px",
      }}
    >

      <div style={cardStyle}>
        <h3>Present Days</h3>
        <h1>{presentDays}</h1>
      </div>

      <div style={cardStyle}>
        <h3>Absent Days</h3>
        <h1>{absentDays}</h1>
      </div>

      <div style={cardStyle}>
        <h3>Late Days</h3>
        <h1>{lateDays}</h1>
      </div>

      <div style={cardStyle}>
        <h3>Working Hours</h3>
        <h1>{workingHours} hrs</h1>
      </div>

    </div>

    {/* Today's Attendance */}

    <div
      style={{
        background: "#fff",
        padding: "30px",
        borderRadius: "15px",
        boxShadow: "0 10px 25px rgba(0,0,0,.08)",
      }}
    >

      <h2>🟢 Today's Attendance</h2>

      <p>
        <b>Employee :</b> {currentUser?.displayName || currentUser?.email}
      </p>

      <p>
        <b>Date :</b> {today}
      </p>

      <p>
        <b>Status :</b> {attendance?.status || "Not Punched In"}
      </p>

      <p>
        <b>Punch In :</b>{" "}
        {attendance?.PunchIn
          ? (attendance.PunchIn.toDate
              ? attendance.PunchIn.toDate()
              : new Date(attendance.PunchIn)
            ).toLocaleTimeString()
          : "--"}
      </p>

      <p>
        <b>Punch Out :</b>{" "}
        {attendance?.PunchOut
          ? (attendance.PunchOut.toDate
              ? attendance.PunchOut.toDate()
              : new Date(attendance.PunchOut)
            ).toLocaleTimeString()
          : "--"}
      </p>

      <p>
        <b>Total Hours :</b> {totalHours} {totalHours !== "--" && "hrs"}
      </p>

      <div
        style={{
          display: "flex",
          gap: "15px",
          marginTop: "20px",
        }}
      >

        <button
          onClick={PunchIn}
          style={greenBtn}
          disabled={attendance && !attendance?.PunchOut}
        >
          Punch In
        </button>

        <button
          onClick={PunchOut}
          style={redBtn}
          disabled={!attendance || attendance?.PunchOut}
        >
          Punch Out
        </button>

      </div>

    </div>
{/* Attendance History */}
  <div
    style={{
      background: "#fff",
      padding: "25px",
      borderRadius: "15px",
      boxShadow:
        "0 5px 20px rgba(0,0,0,0.08)",
      marginBottom: "30px",
    }}
  >
    <h2>📅 Attendance History</h2>

    <table
      style={{
        width: "100%",
        marginTop: "20px",
        borderCollapse: "collapse",
      }}
    >
      <thead>
        <tr>
          <th style={thStyle}>Date</th>
          <th style={thStyle}>Punch In</th>
          <th style={thStyle}>Punch Out</th>
        </tr>
      </thead>

      <tbody>
        {myAttendance.map((item) => (
          <tr key={item.id}>
            <td style={tdStyle}>{item.date}</td>

            <td style={tdStyle}>
              {item.PunchIn
                ? item.PunchIn
                    .toDate()
                    .toLocaleTimeString()
                : "-"}
            </td>

            <td style={tdStyle}>
              {item.PunchOut
                ? item.PunchOut
                    .toDate()
                    .toLocaleTimeString()
                : "-"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>

 
  </div>
);
}


const thStyle = {
borderBottom: "1px solid #ddd",
padding: "12px",
textAlign: "left",
background: "#f8fafc",
};

const tdStyle = {
borderBottom: "1px solid #eee",
padding: "12px",
}; 
const cardStyle = {
  background: "#fff",
  padding: "25px",
  borderRadius: "15px",
  textAlign: "center",
  boxShadow: "0 10px 20px rgba(0,0,0,.08)",
};

const greenBtn = {
  background: "#22c55e",
  color: "#fff",
  padding: "12px 24px",
  border: "none",
  borderRadius: "10px",
  cursor: "pointer",
  fontWeight: "bold",
};

const redBtn = {
  background: "#ef4444",
  color: "#fff",
  padding: "12px 24px",
  border: "none",
  borderRadius: "10px",
  cursor: "pointer",
  fontWeight: "bold",
};
