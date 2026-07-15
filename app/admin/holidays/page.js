"use client";

import { useEffect, useState } from "react";
import {
collection,
addDoc,
getDocs,
deleteDoc,
doc,
Timestamp
} from "firebase/firestore";

import { db } from "../../../lib/firebase";

export default function HolidaysPage() {

const [holidayName,setHolidayName]=useState("");
const [holidayDate,setHolidayDate]=useState("");
const [holidayType,setHolidayType]=useState("");

const [holidays,setHolidays]=useState([]);

useEffect(()=>{
loadHolidays();
},[]);

const loadHolidays = async()=>{

const snapshot=await getDocs(collection(db,"holidays"));

const list=snapshot.docs.map(doc=>({
id:doc.id,
...doc.data()
}));

list.sort((a,b)=>a.date.localeCompare(b.date));

setHolidays(list);

};

const addHoliday = async()=>{

if(!holidayName || !holidayDate){

alert("Fill all fields");

return;

}

await addDoc(collection(db,"holidays"),{

holidayName,

date:holidayDate,

type:holidayType,

createdAt:Timestamp.now()

});

alert("Holiday Added");

setHolidayName("");
setHolidayDate("");
setHolidayType("");

loadHolidays();

};

const removeHoliday=async(id)=>{

if(!confirm("Delete Holiday?")) return;

await deleteDoc(doc(db,"holidays",id));

loadHolidays();

};

return(

<div
style={{
width: "100%",
maxWidth: "1800px",
padding: "40px",
margin:"40px auto",
padding:"35px"
}}
>

<div
style={{
display:"flex",
justifyContent:"space-between",
alignItems:"center",
marginBottom:"30px"
}}
>

<h1>📅 Holiday Management</h1>

<button
onClick={()=>window.location.href="/admin"}
style={blueBtn}
>

← Dashboard

</button>

</div>

<div
style={{
background:"#fff",
padding:"30px",
borderRadius:"18px",
boxShadow:"0 10px 25px rgba(0,0,0,.08)",
marginBottom:"30px"
}}
>

<h2>Add Holiday</h2>

<div
style={{
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "20px",
  marginTop: "25px",
}}
>

<input
placeholder="Holiday Name"
value={holidayName}
onChange={(e)=>setHolidayName(e.target.value)}
style={inputStyle}
/>

<input
type="date"
value={holidayDate}
onChange={(e)=>setHolidayDate(e.target.value)}
style={inputStyle}
/>

<select
value={holidayType}
onChange={(e)=>setHolidayType(e.target.value)}
style={inputStyle}
>

<option value="">Type</option>

<option>National</option>

<option>Festival</option>

<option>Company</option>

<option>Optional</option>

</select>

<div
  style={{
    background: "#fff",
    padding: "35px",
    borderRadius: "18px",
    boxShadow: "0 10px 25px rgba(0,0,0,.08)",
    marginBottom: "30px",
  }}
>
  <h2>Add Holiday</h2>

  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
      gap: "20px",
      marginTop: "25px",
    }}
  >
    <input
      placeholder="Holiday Name"
      value={holidayName}
      onChange={(e) => setHolidayName(e.target.value)}
      style={inputStyle}
    />

    <input
      type="date"
      value={holidayDate}
      onChange={(e) => setHolidayDate(e.target.value)}
      style={inputStyle}
    />

    <select
      value={holidayType}
      onChange={(e) => setHolidayType(e.target.value)}
      style={inputStyle}
    >
      <option value="">Select Type</option>
      <option>National</option>
      <option>Festival</option>
      <option>Company</option>
      <option>Optional</option>
    </select>
  </div>

  <button
    style={{
      marginTop: "25px",
      padding: "14px 28px",
      background: "#3d6fa8",
      color: "#fff",
      border: "none",
      borderRadius: "10px",
      fontSize: "18px",
      fontWeight: "600",
      cursor: "pointer",
    }}
    onClick={addHoliday}
  >
    ➕ Add Holiday
  </button>
</div>

</div>

</div>

<div
style={{
background:"#fff",
padding:"30px",
borderRadius:"18px",
boxShadow:"0 10px 25px rgba(0,0,0,.08)"
}}
>

<h2>Holiday List</h2>
<div
style={{
overflowX:"auto",
marginTop:"20px"
}}
>
<table
style={{
width:"100%",
minWidth:"900px",
borderCollapse:"collapse",
marginTop:"20px"
}}
>

<thead>

<tr>

<th style={th}>Holiday</th>

<th style={th}>Date</th>

<th style={th}>Type</th>

<th style={th}>Action</th>

</tr>

</thead>

<tbody>

{holidays.map(item=>(

<tr key={item.id}>

<td style={td}>{item.holidayName}</td>

<td style={td}>{item.date}</td>

<td style={td}>{item.type}</td>

<td style={td}>

<button
style={redBtn}
onClick={()=>removeHoliday(item.id)}
>

Delete

</button>

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

const inputStyle={
width:"100%",
padding:"12px",
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

const blueBtn={
background:"#2563eb",
color:"#fff",
border:"none",
padding:"12px 18px",
borderRadius:"10px",
cursor:"pointer"
};

const greenBtn={
background:"#16a34a",
color:"#fff",
border:"none",
padding:"12px 18px",
borderRadius:"10px",
cursor:"pointer"
};

const redBtn={
background:"#dc2626",
color:"#fff",
border:"none",
padding:"8px 16px",
borderRadius:"8px",
cursor:"pointer"
};