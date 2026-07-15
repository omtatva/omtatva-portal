"use client";

import { useEffect, useState } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../../../lib/firebase";
import { generatePayslip } from "../../../lib/generatePayslip";
import {
  collection,
  getDocs,
  addDoc,
  Timestamp,
} from "firebase/firestore";

import { db } from "../../../lib/firebase";
export default function PayrollPage() {
    const [employees, setEmployees] = useState([]);
const [userUid, setUserUid] = useState("");
const [payroll, setPayroll] = useState([]);

const [employeeId, setEmployeeId] = useState("");

const [employeeName, setEmployeeName] = useState("");

const [month, setMonth] = useState("");

const [basicSalary, setBasicSalary] = useState("");

const [allowance, setAllowance] = useState("");

const [tax, setTax] = useState("");
const [leaveDeduction, setLeaveDeduction] = useState("");
const [loading, setLoading] = useState(true);

useEffect(() => {

loadEmployees();

loadPayroll();

}, []);

const loadEmployees = async () => {
  const snapshot = await getDocs(collection(db, "users"));

  const list = snapshot.docs
    .map(doc => ({
      id: doc.id,
      ...doc.data(),
    }))
    .filter(user =>
      user.name &&
      user.employeeId &&
      user.status === "active"
    );

  setEmployees(list);
};


const loadPayroll = async () => {

const snapshot = await getDocs(
collection(db,"payroll")
);

const list = snapshot.docs.map(doc=>({

id:doc.id,

...doc.data()

}));

setPayroll(list);

setLoading(false);

};

const grossSalary =
  Number(basicSalary || 0) +
  Number(allowance || 0);

const totalDeduction =
  Number(tax || 0) +
  Number(leaveDeduction || 0);

const netSalary = grossSalary - totalDeduction;

const generatePayroll = async () => {

  if (!employeeId || !month || !basicSalary) {
    alert("Fill all fields");
    return;
  }

  try {

    await addDoc(collection(db, "payroll"), {
      userUid,
      employeeId,

      employeeName,

      month,

      basicSalary: Number(basicSalary),

      allowance: Number(allowance),

      tax: Number(tax),

      leaveDeduction: Number(leaveDeduction),

      grossSalary,

      netSalary,

      generatedOn: Timestamp.now(),

    });

    alert("Payroll Generated Successfully");

    setEmployeeId("");
    setEmployeeName("");
    setMonth("");
    setBasicSalary("");
    setAllowance("");
    setTax("");
    setLeaveDeduction("");

    loadPayroll();

  } catch (error) {

    console.error(error);

    alert("Failed to Generate Payroll");

  }

};


if(loading){

return(

<div style={{padding:40}}>

Loading Payroll...

</div>

);

}



return (

<div
style={{
maxWidth:"1400px",
margin:"40px auto",
padding:"30px"
}}
>

    <h1
style={{
fontSize:"36px",
marginBottom:"10px"
}}
>
💰 Payroll Management
</h1>
<button
        onClick={() => (window.location.href = "/admin")}
        style={{
          background: "#2563eb",
          color: "#fff",
          border: "none",
          padding: "10px 20px",
          borderRadius: "10px",
          cursor: "pointer",
          fontWeight: "600",
        }}
      >
        ← Dashboard
      </button>
<p
style={{
color:"#64748b",
marginBottom:"30px"
}}
>
Generate monthly salary and manage payroll records.
</p>

<div
style={{
display:"grid",
gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",
gap:20,
marginBottom:30
}}
>

<div style={card}>
<h3>Employees</h3>
<h1>{employees.length}</h1>
</div>

<div style={card}>
<h3>Payroll Records</h3>
<h1>{payroll.length}</h1>
</div>

<div style={card}>
<h3>Total Salary</h3>
<h1>
₹{
payroll.reduce(
(sum,p)=>sum+(p.netSalary||0),
0
).toLocaleString()
}
</h1>
</div>

<div style={card}>
<h3>Average Salary</h3>
<h1>
₹{
payroll.length
?
Math.round(
payroll.reduce(
(sum,p)=>sum+(p.netSalary||0),
0
)/payroll.length
).toLocaleString()
:0
}
</h1>
</div>

</div>

<div
style={{
background:"#fff",
padding:"30px",
borderRadius:"15px",
boxShadow:"0 8px 20px rgba(0,0,0,.08)"
}}
>

<h2>Generate Payroll</h2>

<div
style={{
display:"grid",
gridTemplateColumns:"1fr 1fr",
gap:"20px",
marginTop:"20px"
}}
>


<div>
  <label>Employee</label>

  <input
    list="employeeList"
    style={inputStyle}
    placeholder="Search Employee..."
    value={employeeName}
    onChange={(e) => {
      setEmployeeName(e.target.value);

      const emp = employees.find(
        (x) => x.name === e.target.value
      );

      if (emp) {
        setEmployeeId(emp.employeeId);
      }
    }}
  />

  <datalist id="employeeList">
    {employees.map((emp) => (
      <option
        key={emp.id}
        value={emp.name}
      >
        {emp.employeeId}
      </option>
    ))}
  </datalist>
</div>



<div>

<label>Month</label>

<input
type="month"
style={inputStyle}
value={month}
onChange={(e)=>
setMonth(e.target.value)
}
/>

</div>
<div>

<label>Basic Salary</label>

<input
type="number"
style={inputStyle}
value={basicSalary}
onChange={(e)=>
setBasicSalary(e.target.value)
}
/>

</div>
<div>

<label>Allowance</label>

<input
type="number"
style={inputStyle}
value={allowance}
onChange={(e)=>
setAllowance(e.target.value)
}
/>

</div>
<div>
<label>Leave Deduction</label>

<input
type="number"
style={inputStyle}
value={leaveDeduction}
onChange={(e)=>setLeaveDeduction(e.target.value)}
/>
</div>

<div>

<label>Gross Salary</label>

<input
disabled
style={{
...inputStyle,
background:"#f1f5f9",
fontWeight:"bold"
}}
value={`₹ ${grossSalary.toLocaleString()}`}
/>

</div>

<div>

<label>Net Salary</label>

<input
disabled
style={{
...inputStyle,
background:"#f1f5f9",
fontWeight:"bold"
}}
value={`₹ ${netSalary.toLocaleString()}`}
/>

</div>

</div>
<button
onClick={generatePayroll}
style={{
marginTop:"30px",
padding:"15px 30px",
background:"#2563eb",
color:"#fff",
border:"none",
borderRadius:"10px",
cursor:"pointer",
fontWeight:"bold"
}}
>

Generate Payroll

</button>

</div>
<div
style={{
marginTop:"40px",
background:"#fff",
padding:"30px",
borderRadius:"15px",
boxShadow:"0 8px 20px rgba(0,0,0,.08)"
}}
>

<h2>Payroll Records</h2>

<table
style={{
width:"100%",
borderCollapse:"collapse",
marginTop:"20px"
}}
>

<thead>

<tr>

<th style={th}>Employee</th>

<th style={th}>Employee ID</th>

<th style={th}>Month</th>

<th style={th}>Basic</th>

<th style={th}>Allowance</th>

<th style={th}>Leave Deduction</th>

<th style={th}>Tax</th>

<th style={th}>Net Salary</th>

</tr>

</thead>

<tbody>

{
payroll.length===0 ?

<tr>

<td
colSpan="6"
style={{
padding:"30px",
textAlign:"center"
}}
>

No Payroll Generated

</td>

</tr>

:

payroll.map(item=>(

<tr key={item.id}>

<td style={td}>{item.employeeName}</td>

<td style={td}>{item.employeeId}</td>

<td style={td}>{item.month}</td>

<td style={td}>₹ {item.basicSalary?.toLocaleString()}</td>

<td style={td}>₹ {item.allowance?.toLocaleString()}</td>

<td style={td}>₹ {item.leaveDeduction?.toLocaleString()}</td>

<td style={td}>₹ {item.tax?.toLocaleString()}</td>

<td style={{ ...td, fontWeight:"bold", color:"#16a34a" }}>
₹ {item.netSalary?.toLocaleString()}
</td>

</tr>

))

}

</tbody>

</table>

</div>

</div>


);

}

const card={
background:"#fff",
padding:"20px",
borderRadius:"15px",
textAlign:"center",
boxShadow:"0 8px 20px rgba(0,0,0,.08)"
};

const inputStyle={
width:"100%",
padding:"12px",
marginTop:"8px",
border:"1px solid #d1d5db",
borderRadius:"10px"
};

const th={
padding:"15px",
background:"#f8fafc",
textAlign:"left"
};

const td={
padding:"15px",
borderBottom:"1px solid #eee"
};