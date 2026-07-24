"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { CSSProperties } from "react";

export default function AdminTimesheetDashboard() {


const [timesheets,setTimesheets] = useState<any[]>([]);


useEffect(()=>{

fetchData();

},[]);



const fetchData = async()=>{

const q=query(
collection(db,"timesheets"),
orderBy("createdAt","desc")
);


const snap=await getDocs(q);


setTimesheets(
snap.docs.map(doc=>({
id:doc.id,
...doc.data()
}))
);


};



const totalHours = timesheets.reduce(
(total,item)=> total + Number(item.hours || 0),
0
);


const completed =
timesheets.filter(
(item)=>item.status==="Completed"
).length;


const pending =
timesheets.filter(
(item)=>item.status==="Pending Review"
).length;



return(

<div
style={{
padding:"30px",
background:"#f5f7fb",
minHeight:"100vh"
}}
>


{/* Header */}

<div
style={{
background:"#ffffff",
padding:"35px",
borderRadius:"25px",
marginBottom:"30px",
boxShadow:"0 10px 30px rgba(0,0,0,.08)"
}}
>

<h1
style={{
fontSize:"36px",
fontWeight:800,
color:"#1e3a8a"
}}
>

🎬 Creative Workflow Admin Dashboard

</h1>


<p
style={{
fontSize:"18px",
color:"#64748b"
}}
>

Monitor employee creative work, AI usage and productivity.

</p>


</div>




{/* Cards */}

<div
style={{
display:"grid",
gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",
gap:"25px",
marginBottom:"35px"
}}
>


<Card
title="Total Entries"
value={timesheets.length}
icon="📋"
/>


<Card
title="Total Working Hours"
value={`${totalHours} hrs`}
icon="⏱️"
/>


<Card
title="Completed"
value={completed}
icon="✅"
/>


<Card
title="Pending Review"
value={pending}
icon="🕒"
/>



</div>





{/* Table */}

<div
style={{
background:"#fff",
padding:"30px",
borderRadius:"25px",
boxShadow:"0 10px 30px rgba(0,0,0,.08)",
overflowX:"auto"
}}
>


<h2
style={{
fontSize:"28px",
fontWeight:700,
marginBottom:"25px"
}}
>

Employee Work Updates

</h2>



<table
style={{
width:"100%",
borderCollapse:"collapse"
}}
>


<thead>

<tr>

{
[
"Employee",
"Client",
"Task",
"AI Tool",
"Hours",
"Minutes",
"Status",
"Date"
].map(head=>(

<th key={head}
style={th}
>
{head}
</th>

))
}


</tr>

</thead>



<tbody>


{
timesheets.map(item=>(

<tr key={item.id}>


<td style={td}>
{item.employeeName}
</td>


<td style={td}>
{item.client}
</td>


<td style={td}>
{item.task}
</td>


<td style={td}>
{item.aiTool || "-"}
</td>


<td style={td}>
{item.hours} hrs
</td>

<td style={td}>
{item.minutesWorked || 0} min
</td>
<td style={td}>

<span
style={{
padding:"6px 12px",
borderRadius:"20px",
background:
item.status==="Completed"
?
"#dcfce7"
:
"#fef3c7"
}}
>

{item.status}

</span>

</td>


<td style={td}>
{item.workDate}
</td>



</tr>

))

}


</tbody>


</table>


</div>



</div>


)

}


const th: CSSProperties = {

padding:"15px",
background:"#f1f5f9",
textAlign:"left",
borderBottom:"1px solid #ddd"

};


const td: CSSProperties = {

padding:"15px",
borderBottom:"1px solid #eee"

};



function Card({
  title,
  value,
  icon,
}: {
  title:string;
  value:string | number;
  icon:string;
}) {

return(
  <div
    style={{
      background:"#fff",
      padding:"25px",
      borderRadius:"20px",
      boxShadow:"0 8px 25px rgba(0,0,0,.08)"
    }}
  >

    <div style={{fontSize:"30px"}}>
      {icon}
    </div>


    <h3>
      {title}
    </h3>


    <h1>
      {value}
    </h1>


  </div>
)

}