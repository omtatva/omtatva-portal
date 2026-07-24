"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
const COLORS = {
  background: "#ffffff",
  text: "#111111",
  secondary: "#444444",

  primary: "#3d6fa8",   // Main Brand Blue
  accent: "#66a8e0",    // Accent Blue
  soft: "#eaf3ff",      // Light Background

  success: "#16a34a",
  warning: "#ea580c",
  danger: "#dc2626",

  border: "#d9e8f8",
  shadow: "rgba(61,111,168,0.15)",
};
export default function DashboardPage() {
const [myTimesheets, setMyTimesheets] = useState([]);
const [myAttendance, setMyAttendance] = useState([]);
const [userName, setUserName] = useState("");
const [userData, setUserData] = useState(null);
const [upcomingHolidays,setUpcomingHolidays]=useState([]);

useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "/login";
      return;
    }

    // Load user profile
    const userRef = doc(db, "users", user.uid);

const snap = await getDoc(userRef);

if (snap.exists()) {

    const data = snap.data();

    setUserData(data);

    setUserName(
        `${data.firstName || ""} ${data.lastName || ""}`.trim()
    );

}

    // Load dashboard data
    await loadMyData(user);
  });

  return () => unsubscribe();
}, []);

const loadMyData = async (user) => {
  try {
  const attendanceQuery = query(
  collection(db, "attendance"),
  where("userId", "==", user.uid)
);

const attendanceSnapshot = await getDocs(attendanceQuery);

const attendanceData = attendanceSnapshot.docs.map((doc) => ({
  id: doc.id,
  ...doc.data(),
}));

setMyAttendance(attendanceData);

const timesheetQuery = query(
  collection(db, "timesheets"),
  where("email", "==", user.email)
);

const timesheetSnapshot = await getDocs(timesheetQuery);

const timesheetData = timesheetSnapshot.docs.map((doc) => ({
  id: doc.id,
  ...doc.data(),
}));

setMyTimesheets(timesheetData);
} catch (error) {
  console.error(error);
}

};

const totalHours = myTimesheets.reduce(
(sum, item) => sum + Number(item.hours || 0),
0
);

const avgHours =
myAttendance.length > 0
? (totalHours / myAttendance.length).toFixed(1)
: 0;
const totalAttendance = myAttendance.length;

const totalTimesheets = myTimesheets.length;

const performance = userData?.performance || "Pending";

const performanceColor =
performance === "Outstanding"
? "#16a34a"
: performance === "Excellent"
? "#22c55e"
: performance === "Very Good"
? "#3b82f6"
: performance === "Good"
? "#f59e0b"
: performance === "Average"
? "#f97316"
: performance === "Needs Improvement"
? "#dc2626"
: "#64748b";


const cardStyle = {
  background: COLORS.background,
  borderRadius: 20,
  padding: "30px",
  textAlign: "center",
  border: `1px solid ${COLORS.soft}`,
  boxShadow: "0 10px 30px rgba(0,0,0,.06)",
  transition: ".3s",
};
useEffect(()=>{

loadUpcomingHolidays();

},[]);



const loadUpcomingHolidays=async()=>{


const snapshot =
await getDocs(
collection(db,"holidays")
);



const today=new Date();


const holidays=snapshot.docs
.map(doc=>({

id:doc.id,
...doc.data()

}))
.filter(item=>{

return new Date(item.date)>=today;

})
.sort((a,b)=>{

return new Date(a.date)-new Date(b.date);

})
.slice(0,5);



setUpcomingHolidays(holidays);


};

return (
<div
  style={{
    width: "100%",
    padding: "8px",
    background: "#F5F7FB",
    minHeight: "100%",
  }}
>
{/* Header */}
<div
  style={{
    background: COLORS.primary,
    color: "#fff",
    borderRadius: 22,
    padding: "35px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 35,
    boxShadow: "0 12px 30px rgba(61,111,168,.25)",
  }}
>
  <div>

    <h1
      style={{
        margin: 0,
        fontSize: 34,
        fontWeight: 700,
      }}
    >
      👋 Welcome Back
    
    </h1>

    <p
      style={{
        marginTop: 10,
        opacity: .9,
        fontSize: 16,
      }}
    >
      Track attendance, productivity and timesheets.
    </p>

  </div>

  <div
    style={{
      background: COLORS.accent,
      padding: "15px 25px",
      borderRadius: 15,
      fontWeight: 600,
      color: "#fff",
    }}
  >
    {new Date().toDateString()}
  </div>
</div>
{/* ================= QUICK ACTIONS ================= */}

<h2
  style={{
    marginBottom: "20px",
    color: "#0f172a",
    fontWeight: 700,
  }}
>
  🚀 Quick Actions
</h2>

<div
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
    gap: "20px",
    marginBottom: "35px",
  }}
>

  <div style={actionCard} onClick={() => window.location.href="/attendance"}>
    <h3>🕒 Attendance</h3>
    <p>View attendance history</p>
  </div>

  <div style={actionCard} onClick={() => window.location.href="/timesheet"}>
    <h3>📋 Timesheets</h3>
    <p>Submit & View Timesheets</p>
  </div>

  <div style={actionCard} onClick={() => window.location.href="/leave"}>
    <h3>🏖 Leave</h3>
    <p>Apply & Track Leave</p>
  </div>

  <div style={actionCard} onClick={() => window.location.href="/documents"}>
    <h3>📄 My Documents</h3>
    <p>Payslips & HR Documents</p>
  </div>

</div>

{/* ================= DASHBOARD STATS ================= */}

<h2
  style={{
    marginBottom: "20px",
    color: "#0f172a",
    fontWeight: 700,
  }}
>
  📊 Dashboard Overview
</h2>

<div
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(4,1fr)",
    gap: "20px",
    marginBottom: "35px",
  }}
>

<div style={cardStyle}>

<div
style={{
fontSize:42,
marginBottom:15
}}
>
📅
</div>

<h1
style={{
color:COLORS.primary,
marginBottom:10
}}
>
{totalAttendance}
</h1>

<h3
style={{
color:COLORS.text
}}
>
Attendance
</h3>

<p
style={{
color:COLORS.secondary
}}
>
Days Present
</p>

</div>

<div style={cardStyle}>

<div style={{fontSize:42}}>⏰</div>

<h1 style={{color:COLORS.primary}}>
{totalHours}
</h1>

<h3>Total Hours</h3>

<p
style={{
color:COLORS.secondary
}}
>
Working Hours
</p>

</div>

<div style={cardStyle}>

<div style={{fontSize:42}}>📝</div>

<h1 style={{color:COLORS.primary}}>
{totalTimesheets}
</h1>

<h3>Timesheets</h3>

<p
style={{
color:COLORS.secondary
}}
>
Submitted
</p>

</div>

<div style={cardStyle}>

<div style={{fontSize:42}}>📈</div>

<h1 style={{color:COLORS.primary}}>
{avgHours}
</h1>

<h3>Average Hours</h3>

<p
style={{
color:COLORS.secondary
}}
>
Per Attendance
</p>

</div>

</div>

{/* ================= PERFORMANCE ================= */}

<div
  style={{
    display: "grid",
    gridTemplateColumns: "350px 1fr",
    gap: "25px",
    marginBottom: "35px",
  }}
>

<div
  style={{
background:"#fff",
padding:35,
borderRadius:22,
border:`1px solid ${COLORS.soft}`,
boxShadow:"0 10px 30px rgba(0,0,0,.08)",
textAlign:"center"
}}
>

<div
style={{
width:85,
height:85,
margin:"auto",
borderRadius:"50%",
background:COLORS.primary,
display:"flex",
justifyContent:"center",
alignItems:"center",
fontSize:38,
color:"#fff"
}}
>
🏆
</div>

<h2
style={{
marginTop:20,
color:COLORS.text
}}
>
Performance
</h2>

<div
style={{
display:"inline-block",
marginTop:20,
padding:"14px 38px",
background:`${performanceColor}15`,
color:performanceColor,
border:`2px solid ${performanceColor}`,
borderRadius:"40px",
fontSize:"24px",
fontWeight:"700"
}}
>
{performance}
</div>

<p
style={{
marginTop:18,
fontSize:"17px",
fontWeight:"500",
color:COLORS.secondary
}}
>
{performance === "Pending"
? "Awaiting HR Review"
: "Rated by HR Department"}
</p>

<hr
style={{
margin:"30px 0",
borderColor:COLORS.soft
}}
/>

<small
style={{
display:"block",
marginTop:"15px",
color:COLORS.secondary,
fontSize:"15px"
}}
>
<b>Last Updated</b>

<br/>

{
userData?.performanceUpdatedAt?.seconds
? new Date(
userData.performanceUpdatedAt.seconds * 1000
).toLocaleDateString("en-IN")
: "--"
}
</small>

</div>

<div
style={{
background:"#fff",
borderRadius:"22px",
padding:"30px",
boxShadow:"0 12px 35px rgba(0,0,0,.08)"
}}
>

<h2>📢 Announcements</h2>

<div
style={{
marginTop:20,
padding:"20px",
background:"#f8fafc",
borderRadius:15
}}
>
No Announcements Yet
</div>
<div className="holiday-section">

    <div className="holiday-header">
        <h2>🎉 Upcoming Holidays</h2>
        <p>Plan your upcoming days off</p>
    </div>


    <div className="holiday-marquee">

        <div className="holiday-track">

        {
        upcomingHolidays.map(item=>(

            <span key={item.id}>
                🎉 {item.name || item.holidayName}
                &nbsp; 📅 {item.date}
                &nbsp;&nbsp; | &nbsp;&nbsp;
            </span>

        ))
        }

        </div>

    </div>



    <div className="holiday-list">

    {
    upcomingHolidays.length===0

    ?

    <p>No upcoming holidays</p>

    :

    upcomingHolidays.map(item=>(

        <div className="holiday-card" key={item.id}>


            <div className="holiday-icon">
                🎊
            </div>


            <div className="holiday-info">

                <h3>
                {item.name || item.holidayName}
                </h3>

                <p>
                📅 {item.date}
                </p>

            </div>


            <span className="holiday-category">

            {item.category || item.type}

            </span>


        </div>

    ))

    }

    </div>


</div>


</div>

</div>
<div
  style={actionCard}
  onClick={() => router.push("/workspace")}
>
    <h3>🤖 AI Workspace</h3>
    <p>Open AI Tools</p>
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

const toolStyle = {
  textDecoration: "none",
  background: "#eff6ff",
  color: "#1e3a8a",
  padding: "15px",
  borderRadius: "10px",
  textAlign: "center",
  fontWeight: "600",
  transition: "0.3s",
};

const actionCard = {
  background: "#fff",
  border: `1px solid ${COLORS.soft}`,
  borderRadius: 18,
  padding: "22px",
  cursor: "pointer",
  transition: ".3s",
  boxShadow: "0 6px 18px rgba(0,0,0,.05)",
};