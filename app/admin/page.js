"use client";

import { useEffect, useState } from "react";

import { onAuthStateChanged } from "firebase/auth";

import {
  collection,
  getDocs,
  doc,
  getDoc,
  limit,
  query,
  orderBy,
} from "firebase/firestore";

import { auth, db } from "../../lib/firebase";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const DEPT_COLORS = ["#3d6fa8", "#66a8e0", "#f59e0b", "#16a34a", "#dc2626", "#7c3aed", "#0891b2"];

export default function AdminPage() {
  const [loading, setLoading] = useState(true);

  const [totalEmployees, setTotalEmployees] = useState(0);
  const [attendanceCount, setAttendanceCount] = useState(0);
  const [timesheetCount, setTimesheetCount] = useState(0);
  const [inactiveUsers, setInactiveUsers] = useState(0);
  const [pendingLeaveCount, setPendingLeaveCount] = useState(0);
  const [activities, setActivities] = useState([]);
  const [departmentData, setDepartmentData] = useState([]);
  const [trendData, setTrendData] = useState([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = "/admin/login";
        return;
      }

      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          alert("User not found");
          window.location.href = "/";
          return;
        }

        const data = userSnap.data();

        const allowedEmails = [
          "admin@omtatvadigitals.com",
          "hr@omtatvadigitals.com",
          "itsupport@omtatvadigitals.com",
        ];

        const allowedRoles = ["admin", "hr", "Developer"];

        const emailAllowed = allowedEmails.includes(user.email);
        const roleAllowed = allowedRoles.includes((data.role || "").toLowerCase());

        if (!emailAllowed && !roleAllowed) {
          alert("Access Denied");
          window.location.href = "/";
          return;
        }

        await loadDashboard();
        await loadActivities();

        setLoading(false);
      } catch (error) {
        console.error(error);
      }
    });

    return () => unsubscribe();
  }, []);

  const loadDashboard = async () => {
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      const users = usersSnap.docs.map((doc) => doc.data());

      setTotalEmployees(users.length);

      setInactiveUsers(
        users.filter((user) => (user.status || "").toLowerCase() === "inactive").length
      );

      // Department breakdown
      const deptCounts = {};
      users.forEach((u) => {
        const dept = u.department || "Unassigned";
        deptCounts[dept] = (deptCounts[dept] || 0) + 1;
      });
      setDepartmentData(
        Object.entries(deptCounts).map(([name, value]) => ({ name, value }))
      );

      const attendanceSnap = await getDocs(collection(db, "attendance"));
      const attendanceDocs = attendanceSnap.docs.map((d) => d.data());
      setAttendanceCount(attendanceSnap.size);

      const timesheetSnap = await getDocs(collection(db, "timesheets"));
      const timesheetDocs = timesheetSnap.docs.map((d) => d.data());
      setTimesheetCount(timesheetSnap.size);

      // Company-wide trend, last 14 days
      setTrendData(buildTrendData(attendanceDocs, timesheetDocs));

      // Pending leave requests (assumes a "leaves" collection with a "status" field)
      try {
        const leavesSnap = await getDocs(collection(db, "leaves"));
        const pending = leavesSnap.docs.filter(
          (d) => (d.data().status || "").toLowerCase() === "pending"
        ).length;
        setPendingLeaveCount(pending);
      } catch (e) {
        console.error("Leave count error:", e);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const loadActivities = async () => {
    try {
      const q = query(collection(db, "activityLogs"), orderBy("createdAt", "desc"), limit(10));
      const snap = await getDocs(q);
      const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setActivities(list);
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontSize: "22px",
          fontWeight: 700,
          color: "#3d6fa8",
        }}
      >
        Loading Admin Dashboard...
      </div>
    );
  }

  return (
    <div style={{ width: "90%", padding: "25px", background: "#f5f8fc", minHeight: "100vh" }}>
      {/* HEADER */}
      <div
        style={{
          background: "#ffffff",
          padding: "35px",
          borderRadius: "25px",
          marginBottom: "30px",
          boxShadow: "0 10px 30px rgba(61,111,168,0.12)",
          border: "1px solid #eaf3ff",
        }}
      >
        <h1 style={{ fontSize: "42px", fontWeight: 800, margin: 0, color: "#111111" }}>
          🏢 Admin Dashboard
        </h1>

        <p style={{ fontSize: "19px", color: "#444444", marginTop: "12px" }}>
          Manage HR, Payroll, Creative Production & AI Operations from one place.
        </p>

        <div
          style={{
            height: "5px",
            width: "180px",
            borderRadius: "10px",
            background: "linear-gradient(90deg,#3d6fa8,#66a8e0)",
          }}
        ></div>
      </div>

      {/* STATISTICS CARDS */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
          gap: "22px",
          marginBottom: "35px",
        }}
      >
        <StatCard title="Employees" value={totalEmployees} icon="👥" />
        <StatCard title="Attendance" value={attendanceCount} icon="🕒" />
        <StatCard title="Timesheets" value={timesheetCount} icon="📋" />
        <StatCard title="Inactive" value={inactiveUsers} icon="⚠️" />
        <StatCard
          title="Pending Leave Approvals"
          value={pendingLeaveCount}
          icon="🏖"
          highlight={pendingLeaveCount > 0}
          onClick={() => (window.location.href = "/admin/leave")}
        />
      </div>

      {/* TRENDS + DEPARTMENT BREAKDOWN */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: "25px",
          marginBottom: "35px",
        }}
      >
        <div
          style={{
            background: "#ffffff",
            padding: "30px",
            borderRadius: "22px",
            boxShadow: "0 10px 25px rgba(61,111,168,0.12)",
          }}
        >
          <h2 style={{ fontSize: "24px", fontWeight: 800, color: "#111111", marginBottom: 20 }}>
            📈 Activity Trend (Last 14 Days)
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eaf3ff" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="attendance" name="Attendance" fill="#3d6fa8" radius={[6, 6, 0, 0]} />
              <Bar dataKey="timesheets" name="Timesheets" fill="#66a8e0" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div
          style={{
            background: "#ffffff",
            padding: "30px",
            borderRadius: "22px",
            boxShadow: "0 10px 25px rgba(61,111,168,0.12)",
          }}
        >
          <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#111111", marginBottom: 20 }}>
            🏢 Department Breakdown
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={departmentData} dataKey="value" nameKey="name" outerRadius={80}>
                {departmentData.map((entry, index) => (
                  <Cell key={index} fill={DEPT_COLORS[index % DEPT_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
            {departmentData.map((d, i) => (
              <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: DEPT_COLORS[i % DEPT_COLORS.length],
                    display: "inline-block",
                  }}
                ></span>
                {d.name} ({d.value})
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div
        style={{
          background: "#ffffff",
          padding: "30px",
          borderRadius: "22px",
          boxShadow: "0 10px 25px rgba(61,111,168,0.12)",
          marginBottom: "30px",
        }}
      >
        <h2 style={{ fontSize: "28px", fontWeight: 800, color: "#111111", marginBottom: "25px" }}>
          ⚡ Quick Actions
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
            gap: "20px",
          }}
        >
          {[
            ["👥 Employee Management", "/admin/users"],
            ["🕒 Attendance", "/admin/attendance"],
            ["🏖 Leave", "/admin/leave"],
            ["💰 Payroll", "/admin/payroll"],
            ["📋 Timesheets", "/admin/timesheet"],
            ["📄 Documents", "/admin/documents"],
            ["📊 Reports", "/admin/tools-report"],
            ["🎬 AI Production", "/admin/production"],
            ["📅 Holidays", "/admin/holidays"],
          ].map(([title, link]) => (
            <button
              key={title}
              onClick={() => (window.location.href = link)}
              style={{
                padding: "25px",
                borderRadius: "18px",
                background: "#eaf3ff",
                border: "1px solid #66a8e0",
                fontSize: "17px",
                fontWeight: 700,
                color: "#111111",
                cursor: "pointer",
                transition: "0.3s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#3d6fa8";
                e.currentTarget.style.color = "#ffffff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#eaf3ff";
                e.currentTarget.style.color = "#111111";
              }}
            >
              {title}
            </button>
          ))}
        </div>
      </div>

      {/* ACTIVITY + OVERVIEW */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "25px" }}>
        {/* RECENT ACTIVITY */}
        <div
          style={{
            background: "#ffffff",
            padding: "30px",
            borderRadius: "22px",
            boxShadow: "0 10px 25px rgba(61,111,168,0.12)",
          }}
        >
          <h2 style={{ fontSize: "26px", fontWeight: 800, color: "#111111" }}>
            📢 Recent Activity
          </h2>

          <table style={{ width: "100%", marginTop: "20px", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Employee</th>
                <th style={thStyle}>Activity</th>
                <th style={thStyle}>Time</th>
              </tr>
            </thead>

            <tbody>
              {activities.length === 0 ? (
                <tr>
                  <td colSpan="3" style={{ textAlign: "center", padding: "25px", color: "#444" }}>
                    No Activity Found
                  </td>
                </tr>
              ) : (
                activities.map((item) => (
                  <tr key={item.id}>
                    <td style={tdStyle}>
                      <b>{item.employeeName || "-"}</b>
                    </td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          background: "#eaf3ff",
                          color: "#3d6fa8",
                          padding: "8px 14px",
                          borderRadius: "20px",
                          fontWeight: 600,
                        }}
                      >
                        {item.activity}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString() : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* OVERVIEW */}
        <div
          style={{
            background: "#ffffff",
            padding: "30px",
            borderRadius: "22px",
            boxShadow: "0 10px 25px rgba(61,111,168,0.12)",
          }}
        >
          <h2 style={{ fontSize: "26px", fontWeight: 800, color: "#111111" }}>📌 Overview</h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "18px", marginTop: "25px" }}>
            <OverviewItem title="Today's Attendance" value={`${attendanceCount} Records`} />
            <OverviewItem title="Total Employees" value={totalEmployees} />
            <OverviewItem title="Inactive Employees" value={inactiveUsers} />
            <OverviewItem title="Timesheets Submitted" value={timesheetCount} />
            <OverviewItem title="Pending Leave Approvals" value={pendingLeaveCount} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, highlight, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "#ffffff",
        padding: "28px",
        borderRadius: "22px",
        border: highlight ? "1px solid #dc2626" : "1px solid #eaf3ff",
        boxShadow: "0 8px 25px rgba(61,111,168,0.12)",
        position: "relative",
        overflow: "hidden",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div
        style={{
          position: "absolute",
          right: "-25px",
          top: "-25px",
          width: "100px",
          height: "100px",
          borderRadius: "50%",
          background: highlight ? "#fee2e2" : "#eaf3ff",
        }}
      ></div>

      <div style={{ fontSize: "42px", marginBottom: "15px" }}>{icon}</div>

      <p style={{ margin: 0, fontSize: "17px", fontWeight: 600, color: "#444444" }}>{title}</p>

      <h1
        style={{
          fontSize: "42px",
          fontWeight: 800,
          color: highlight ? "#dc2626" : "#3d6fa8",
          margin: "10px 0",
        }}
      >
        {value}
      </h1>

      <div
        style={{
          height: "5px",
          width: "70px",
          borderRadius: "10px",
          background: highlight
            ? "linear-gradient(90deg,#dc2626,#f59e0b)"
            : "linear-gradient(90deg,#3d6fa8,#66a8e0)",
        }}
      ></div>
    </div>
  );
}

function OverviewItem({ title, value }) {
  return (
    <div
      style={{
        background: "#eaf3ff",
        padding: "18px",
        borderRadius: "15px",
        border: "1px solid #66a8e0",
      }}
    >
      <p style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "#444444" }}>{title}</p>
      <h2 style={{ margin: "8px 0 0", fontSize: "28px", fontWeight: 800, color: "#3d6fa8" }}>
        {value}
      </h2>
    </div>
  );
}

/**
 * Builds a 14-day company-wide trend of attendance and timesheet record counts.
 * Expects a "date" field on each doc (Firestore Timestamp or date string) —
 * adjust if your schema differs.
 */
function buildTrendData(attendanceDocs, timesheetDocs) {
  const days = [];
  const today = new Date();

  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().split("T")[0];
    days.push({
      key,
      label: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      attendance: 0,
      timesheets: 0,
    });
  }

  const dayMap = Object.fromEntries(days.map((d) => [d.key, d]));

  attendanceDocs.forEach((a) => {
    const key = normalizeDate(a.date);
    if (key && dayMap[key]) dayMap[key].attendance += 1;
  });

  timesheetDocs.forEach((t) => {
    const key = normalizeDate(t.date);
    if (key && dayMap[key]) dayMap[key].timesheets += 1;
  });

  return days;
}

function normalizeDate(value) {
  if (!value) return null;
  if (value.seconds) return new Date(value.seconds * 1000).toISOString().split("T")[0];
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[0];
}

const thStyle = {
  padding: "15px",
  textAlign: "left",
  background: "#eaf3ff",
  color: "#111111",
  fontWeight: 700,
  borderBottom: "1px solid #66a8e0",
};

const tdStyle = {
  padding: "15px",
  color: "#444444",
  borderBottom: "1px solid #edf2f7",
};

// "use client";

// import { useEffect, useState } from "react";

// import { 
//   onAuthStateChanged 
// } from "firebase/auth";

// import {
//   collection,
//   getDocs,
//   doc,
//   getDoc,
//   limit,
//   query,
//   orderBy
// } from "firebase/firestore";

// import { auth, db } from "../../lib/firebase";


// export default function AdminPage() {


// const [loading,setLoading] = useState(true);

// const [totalEmployees,setTotalEmployees] = useState(0);

// const [attendanceCount,setAttendanceCount] = useState(0);

// const [timesheetCount,setTimesheetCount] = useState(0);

// const [inactiveUsers,setInactiveUsers] = useState(0);

// const [activities,setActivities] = useState([]);



// useEffect(()=>{


// const unsubscribe = onAuthStateChanged(
// auth,

// async(user)=>{


// if(!user){

// window.location.href="/admin/login";

// return;

// }



// try{


// const userRef = doc(
// db,
// "users",
// user.uid
// );


// const userSnap = await getDoc(userRef);



// if(!userSnap.exists()){


// alert("User not found");

// window.location.href="/";

// return;

// }



// const data = userSnap.data();



// const allowedEmails=[

// "admin@omtatvadigitals.com",
// "hr@omtatvadigitals.com",
// "itsupport@omtatvadigitals.com"

// ];



// const allowedRoles=[

// "admin",
// "hr",
// "Developer"

// ];



// const emailAllowed =
// allowedEmails.includes(user.email);



// const roleAllowed =
// allowedRoles.includes(
// (data.role || "").toLowerCase()
// );



// if(!emailAllowed && !roleAllowed){


// alert("Access Denied");

// window.location.href="/";

// return;


// }



// await loadDashboard();

// await loadActivities();


// setLoading(false);



// }

// catch(error){

// console.log(error);

// }


// }

// );


// return ()=>unsubscribe();


// },[]);






// const loadDashboard = async()=>{


// try{


// const usersSnap =
// await getDocs(
// collection(db,"users")
// );



// const users =
// usersSnap.docs.map(
// doc=>doc.data()
// );



// setTotalEmployees(
// users.length
// );



// setInactiveUsers(

// users.filter(
// user=>
// (user.status || "")
// .toLowerCase()
// ==="inactive"

// ).length

// );




// const attendanceSnap =
// await getDocs(
// collection(db,"attendance")
// );



// setAttendanceCount(
// attendanceSnap.size
// );





// const timesheetSnap =
// await getDocs(
// collection(db,"timesheets")
// );



// setTimesheetCount(
// timesheetSnap.size
// );



// }

// catch(error){

// console.log(error);

// }


// };







// const loadActivities = async()=>{


// try{


// const q=query(

// collection(
// db,
// "activityLogs"
// ),

// orderBy(
// "createdAt",
// "desc"
// ),

// limit(10)

// );



// const snap =
// await getDocs(q);



// const list =
// snap.docs.map(doc=>({

// id:doc.id,
// ...doc.data()

// }));



// setActivities(list);



// }

// catch(error){

// console.log(error);

// }


// };







// if(loading){


// return(

// <div

// style={{

// minHeight:"100vh",

// display:"flex",

// justifyContent:"center",

// alignItems:"center",

// fontSize:"22px",

// fontWeight:700,

// color:"#3d6fa8"

// }}

// >

// Loading Admin Dashboard...

// </div>


// )


// }






// return(


// <div

// style={{

// width:"90%",

// padding:"25px",

// background:"#f5f8fc",

// minHeight:"100vh"

// }}

// >



// {/* HEADER */}


// <div

// style={{

// background:"#ffffff",

// padding:"35px",

// borderRadius:"25px",

// marginBottom:"30px",

// boxShadow:
// "0 10px 30px rgba(61,111,168,0.12)",

// border:
// "1px solid #eaf3ff"

// }}

// >


// <h1

// style={{

// fontSize:"42px",

// fontWeight:800,

// margin:0,

// color:"#111111"

// }}

// >

// 🏢 Admin Dashboard

// </h1>



// <p

// style={{

// fontSize:"19px",

// color:"#444444",

// marginTop:"12px"

// }}

// >

// Manage HR, Payroll, Creative Production & AI Operations from one place.

// </p>



// <div

// style={{

// height:"5px",

// width:"180px",

// borderRadius:"10px",

// background:
// "linear-gradient(90deg,#3d6fa8,#66a8e0)"

// }}

// ></div>



// </div>





// {/* STATISTICS CARDS */}


// <div

// style={{

// display:"grid",

// gridTemplateColumns:
// "repeat(auto-fit,minmax(220px,1fr))",

// gap:"22px",

// marginBottom:"35px"

// }}

// >


// <StatCard

// title="Employees"

// value={totalEmployees}

// icon="👥"

// />


// <StatCard

// title="Attendance"

// value={attendanceCount}

// icon="🕒"

// />


// <StatCard

// title="Timesheets"

// value={timesheetCount}

// icon="📋"

// />


// <StatCard

// title="Inactive"

// value={inactiveUsers}

// icon="⚠️"

// />


// </div>

// // QUICK ACTIONS

// <div
// style={{
// background:"#ffffff",
// padding:"30px",
// borderRadius:"22px",
// boxShadow:"0 10px 25px rgba(61,111,168,0.12)",
// marginBottom:"30px"
// }}
// >


// <h2

// style={{

// fontSize:"28px",

// fontWeight:800,

// color:"#111111",

// marginBottom:"25px"

// }}

// >

// ⚡ Quick Actions

// </h2>



// <div

// style={{

// display:"grid",

// gridTemplateColumns:
// "repeat(auto-fit,minmax(220px,1fr))",

// gap:"20px"

// }}

// >


// {

// [

// ["👥 Employee Management","/admin/users"],

// ["🕒 Attendance","/admin/attendance"],

// ["🏖 Leave","/admin/leave"],

// ["💰 Payroll","/admin/payroll"],

// ["📋 Timesheets","/admin/timesheet"],

// ["📄 Documents","/admin/documents"],

// ["📊 Reports","/admin/reports"],

// ["🎬 AI Production","/admin/production"],

// ["📅 Holidays","/admin/holidays"]

// ].map(([title,link])=>(


// <button

// key={title}

// onClick={()=>window.location.href=link}

// style={{

// padding:"25px",

// borderRadius:"18px",

// background:"#eaf3ff",

// border:"1px solid #66a8e0",

// fontSize:"17px",

// fontWeight:700,

// color:"#111111",

// cursor:"pointer",

// transition:"0.3s"

// }}


// onMouseEnter={(e)=>{

// e.currentTarget.style.background="#3d6fa8";

// e.currentTarget.style.color="#ffffff";

// }}


// onMouseLeave={(e)=>{

// e.currentTarget.style.background="#eaf3ff";

// e.currentTarget.style.color="#111111";

// }}


// >

// {title}

// </button>


// ))


// }


// </div>


// </div>







// {/* ACTIVITY + OVERVIEW */}



// <div

// style={{

// display:"grid",

// gridTemplateColumns:"2fr 1fr",

// gap:"25px"

// }}

// >



// {/* RECENT ACTIVITY */}



// <div

// style={{

// background:"#ffffff",

// padding:"30px",

// borderRadius:"22px",

// boxShadow:
// "0 10px 25px rgba(61,111,168,0.12)"

// }}

// >


// <h2

// style={{

// fontSize:"26px",

// fontWeight:800,

// color:"#111111"

// }}

// >

// 📢 Recent Activity

// </h2>




// <table

// style={{

// width:"100%",

// marginTop:"20px",

// borderCollapse:"collapse"

// }}

// >


// <thead>

// <tr>


// <th style={thStyle}>
// Employee
// </th>


// <th style={thStyle}>
// Activity
// </th>


// <th style={thStyle}>
// Time
// </th>


// </tr>

// </thead>




// <tbody>


// {

// activities.length===0 ?


// <tr>

// <td

// colSpan="3"

// style={{

// textAlign:"center",

// padding:"25px",

// color:"#444"

// }}

// >

// No Activity Found

// </td>

// </tr>



// :


// activities.map((item)=>(


// <tr key={item.id}>


// <td style={tdStyle}>

// <b>
// {item.employeeName || "-"}
// </b>

// </td>



// <td style={tdStyle}>


// <span

// style={{

// background:"#eaf3ff",

// color:"#3d6fa8",

// padding:"8px 14px",

// borderRadius:"20px",

// fontWeight:600

// }}

// >

// {item.activity}

// </span>


// </td>




// <td style={tdStyle}>


// {

// item.createdAt?.toDate

// ?

// item.createdAt
// .toDate()
// .toLocaleString()

// :

// "-"

// }


// </td>



// </tr>


// ))


// }



// </tbody>


// </table>



// </div>








// {/* OVERVIEW */}



// <div

// style={{

// background:"#ffffff",

// padding:"30px",

// borderRadius:"22px",

// boxShadow:
// "0 10px 25px rgba(61,111,168,0.12)"

// }}

// >


// <h2

// style={{

// fontSize:"26px",

// fontWeight:800,

// color:"#111111"

// }}

// >

// 📌 Overview

// </h2>



// <div

// style={{

// display:"flex",

// flexDirection:"column",

// gap:"18px",

// marginTop:"25px"

// }}

// >


// <OverviewItem

// title="Today's Attendance"

// value={`${attendanceCount} Records`}

// />



// <OverviewItem

// title="Total Employees"

// value={totalEmployees}

// />



// <OverviewItem

// title="Inactive Employees"

// value={inactiveUsers}

// />



// <OverviewItem

// title="Timesheets Submitted"

// value={timesheetCount}

// />



// </div>


// </div>





// </div>



// </div>



// );

// }


// function StatCard({
// title,
// value,
// icon
// }){

// return(

// <div

// style={{

// background:"#ffffff",

// padding:"28px",

// borderRadius:"22px",

// border:"1px solid #eaf3ff",

// boxShadow:
// "0 8px 25px rgba(61,111,168,0.12)",

// position:"relative",

// overflow:"hidden"

// }}

// >


// <div

// style={{

// position:"absolute",

// right:"-25px",

// top:"-25px",

// width:"100px",

// height:"100px",

// borderRadius:"50%",

// background:"#eaf3ff"

// }}

// ></div>



// <div

// style={{

// fontSize:"42px",

// marginBottom:"15px"

// }}

// >

// {icon}

// </div>




// <p

// style={{

// margin:0,

// fontSize:"17px",

// fontWeight:600,

// color:"#444444"

// }}

// >

// {title}

// </p>




// <h1

// style={{

// fontSize:"42px",

// fontWeight:800,

// color:"#3d6fa8",

// margin:"10px 0"

// }}

// >

// {value}

// </h1>




// <div

// style={{

// height:"5px",

// width:"70px",

// borderRadius:"10px",

// background:
// "linear-gradient(90deg,#3d6fa8,#66a8e0)"

// }}

// ></div>



// </div>


// )

// }







// function OverviewItem({

// title,

// value

// }){


// return(


// <div

// style={{

// background:"#eaf3ff",

// padding:"18px",

// borderRadius:"15px",

// border:"1px solid #66a8e0"

// }}

// >


// <p

// style={{

// margin:0,

// fontSize:"15px",

// fontWeight:600,

// color:"#444444"

// }}

// >

// {title}

// </p>



// <h2

// style={{

// margin:"8px 0 0",

// fontSize:"28px",

// fontWeight:800,

// color:"#3d6fa8"

// }}

// >

// {value}

// </h2>



// </div>


// )


// }







// const thStyle = {

// padding:"15px",

// textAlign:"left",

// background:"#eaf3ff",

// color:"#111111",

// fontWeight:700,

// borderBottom:"1px solid #66a8e0"

// };




// const tdStyle = {

// padding:"15px",

// color:"#444444",

// borderBottom:"1px solid #edf2f7"

// };


// "use client";

// import { useEffect, useState } from "react";
// import { onAuthStateChanged } from "firebase/auth";
// import {
//   collection,
//   getDocs,
//   doc,
//   getDoc,
//   limit,
//   query,
//   orderBy
// } from "firebase/firestore";

// import { auth, db } from "../../lib/firebase";

// export default function AdminPage() {
//   const [loading, setLoading] = useState(true);

//   const [totalEmployees, setTotalEmployees] = useState(0);
//   const [attendanceCount, setAttendanceCount] = useState(0);
//   const [timesheetCount, setTimesheetCount] = useState(0);
//   const [inactiveUsers, setInactiveUsers] = useState(0);
// const [activities, setActivities] = useState([]);
//   useEffect(() => {
//   const unsubscribe = onAuthStateChanged(auth, async (user) => {
//     if (!user) {
//       window.location.href = "/admin/login";
//       return;
//     }

//     try {
//       const userRef = doc(db, "users", user.uid);
//       const userSnap = await getDoc(userRef);

//       if (!userSnap.exists()) {
//         alert("User not found");
//         window.location.href = "/";
//         return;
//       }

//       const data = userSnap.data();

//       const allowedEmails = [
//         "admin@omtatvadigitals.com",
//         "hr@omtatvadigitals.com",
//         "owner@omtatvadigitals.com",
//       ];

//       const allowedRoles = [
//         "admin",
//         "owner",
//         "hr",
//       ];

//       const emailAllowed = allowedEmails.includes(user.email || "");

//       const roleAllowed = allowedRoles.includes(
//         (data.role || "").toLowerCase()
//       );

//       if (!emailAllowed && !roleAllowed) {
//         alert("Access Denied");
//         window.location.href = "/";
//         return;
//       }

//       await loadDashboard();
//       setLoading(false);

//     } catch (error) {
//       console.error(error);
//     }
//   });

//   return () => unsubscribe();
// }, []);

// useEffect(() => {
//   loadActivities();
// }, []);

// const loadActivities = async () => {

//   const q = query(
//     collection(db, "activityLogs"),
//     orderBy("createdAt", "desc"),
//     limit(10)
//   );

//   const snapshot = await getDocs(q);

//   const list = snapshot.docs.map(doc => ({
//     id: doc.id,
//     ...doc.data(),
//   }));

//   setActivities(list);

// };

// const loadDashboard = async () => {
//   try {
//     const usersSnapshot = await getDocs(collection(db, "users"));

//     const users = usersSnapshot.docs.map((doc) => doc.data());

//     setTotalEmployees(users.length);

//     setInactiveUsers(
//         users.filter(
//   (user) =>
//     (user.status || "").toLowerCase() === "inactive"
// ).length

//     );

//     const attendanceSnapshot = await getDocs(
//       collection(db, "attendance")
//     );

//     setAttendanceCount(attendanceSnapshot.size);

//     const timesheetSnapshot = await getDocs(
//       collection(db, "timesheets")
//     );

//     setTimesheetCount(timesheetSnapshot.size);

//   } catch (error) {
//     console.error(error);
//   }
// };

//   if (loading) {
//   return (
//     <div
//       style={{
//         minHeight: "100vh",
//         display: "flex",
//         justifyContent: "center",
//         alignItems: "center",
//         fontSize: "22px",
//         fontWeight: "600",
//       }}
//     >
//       Loading Admin Dashboard...
//     </div>
//   );
// }

// return (
// <div
// style={{
//     width: "100%",
//     padding: "8px",
//     background: "#F5F7FB",
//     minHeight: "100%",
//   }}
// // style={{
// // maxWidth:"1500px",
// // margin:"30px auto",
// // padding:"25px"
// // }}
// >

// <h1
// style={{
// fontSize:"38px",
// fontWeight:"700",
// marginBottom:"8px"
// }}
// >
// 🏢 Admin Dashboard
// </h1>

// <p
// style={{
// color:"#64748b",
// marginBottom:"35px"
// }}
// >
// Manage HR, Production & AI Operations from one place.
// </p>


// {/* Statistics */}

// <div
// style={{
// display:"grid",
// gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",
// gap:"20px",
// marginBottom:"35px"
// }}
// >

// {[
// {
// title:"Employees",
// value:totalEmployees,
// color:"#2563eb",
// icon:"👥"
// },
// {
// title:"Attendance",
// value:attendanceCount,
// color:"#16a34a",
// icon:"🕒"
// },
// {
// title:"Timesheets",
// value:timesheetCount,
// color:"#9333ea",
// icon:"📋"
// },
// {
// title:"Inactive",
// value:inactiveUsers,
// color:"#dc2626",
// icon:"⚠️"
// }
// ].map((card)=>(

// <div
// key={card.title}
// style={{
// background:"#fff",
// borderRadius:"18px",
// padding:"25px",
// boxShadow:"0 10px 25px rgba(0,0,0,.08)"
// }}
// >

// <div
// style={{
// display:"flex",
// justifyContent:"space-between",
// alignItems:"center"
// }}
// >

// <div>

// <p
// style={{
// margin:0,
// color:"#64748b"
// }}
// >
// {card.title}
// </p>

// <h1
// style={{
// margin:"10px 0 0",
// fontSize:"40px",
// color:card.color
// }}
// >
// {card.value}
// </h1>

// </div>

// <div
// style={{
// fontSize:"45px"
// }}
// >
// {card.icon}
// </div>

// </div>

// </div>

// ))

// }

// </div>


// {/* Quick Actions */}

// <div
// style={{
// background:"#fff",
// padding:"30px",
// borderRadius:"18px",
// boxShadow:"0 10px 25px rgba(0,0,0,.08)",
// marginBottom:"30px"
// }}
// >

// <h2
// style={{
// marginBottom:"25px"
// }}
// >
// ⚡ Quick Actions
// </h2>

// <div
// style={{
// display:"grid",
// gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",
// gap:"20px"
// }}
// >

// {[
// ["👥 Employee Management","/admin/users"],
// ["🕒 Attendance","/admin/attendance"],
// ["🏖 Leave","/admin/leave"],
// ["💰 Payroll","/admin/payroll"],
// ["📋 Timesheets","/admin/timesheet"],
// ["📄 Documents","/admin/documents"],
// ["📊 Reports","/admin/reports"],
// ["🎬 AI Production","/admin/production"],
// ["📅 Holidays", "/admin/holidays"]
// ].map(([title,link])=>(

// <button
// key={title}
// onClick={()=>window.location.href=link}
// style={{
// padding:"25px",
// borderRadius:"15px",
// background:"#f8fbff",
// border:"1px solid #dbeafe",
// fontSize:"17px",
// fontWeight:"600",
// cursor:"pointer",
// transition:".3s"
// }}
// >

// {title}

// </button>

// ))

// }

// </div>

// </div>


// {/* Activity */}

// <div
// style={{
// display:"grid",
// gridTemplateColumns:"2fr 1fr",
// gap:"25px"
// }}
// >

// <div
// style={{
// background:"#fff",
// padding:"30px",
// borderRadius:"18px",
// boxShadow:"0 10px 25px rgba(0,0,0,.08)"
// }}
// >

// <h2>📢 Recent Activity</h2>

// <table
// style={{
// width:"100%",
// marginTop:"20px",
// borderCollapse:"collapse"
// }}
// >

// <thead>

// <tr>

// <th style={thStyle}>Employee</th>

// <th style={thStyle}>Activity</th>

// <th style={thStyle}>Time</th>

// </tr>

// </thead>

// <tbody>

// {activities.map((item) => (

// <tr key={item.id}>

// <td style={tdStyle}>
// {item.employeeName}
// </td>

// <td style={tdStyle}>
// {item.activity}
// </td>

// <td style={tdStyle}>
// {item.createdAt?.toDate().toLocaleString()}
// </td>

// </tr>

// ))}

// </tbody>

// </table>

// </div>


// <div
// style={{
// background:"#fff",
// padding:"30px",
// borderRadius:"18px",
// boxShadow:"0 10px 25px rgba(0,0,0,.08)"
// }}
// >

// <h2>📌 Overview</h2>

// <div
// style={{
// marginTop:"20px",
// display:"flex",
// flexDirection:"column",
// gap:"20px"
// }}
// >

// <div>

// <h3>Today's Attendance</h3>

// <p>{attendanceCount} Records</p>

// </div>

// <div>

// <h3>Employees</h3>

// <p>{totalEmployees}</p>

// </div>

// <div>

// <h3>Inactive</h3>

// <p>{inactiveUsers}</p>

// </div>

// <div>

// <h3>Timesheets</h3>

// <p>{timesheetCount}</p>

// </div>

// </div>

// </div>

// </div>

// </div>
// );
// }

// const buttonStyle = {
// background: "#2563eb",
// color: "#fff",
// border: "none",
// padding: "12px 20px",
// borderRadius: "8px",
// cursor: "pointer",
// fontWeight: "600",
// };

// const thStyle = {
// padding: "15px",
// textAlign: "left",
// background: "#f8fafc",
// borderBottom: "1px solid #e5e7eb",
// };

// const tdStyle = {
// padding: "15px",
// borderBottom: "1px solid #f1f5f9",
// };