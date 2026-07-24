"use client";

import { useState } from "react";
import { UserPlus, Trash2 } from "lucide-react";
import { appSettings, updateAppSettings } from "../../../config/appSettings";

const modules = [
  "Dashboard",
  "Attendance",
  "Timesheet",
  "Leave",
  "Holiday",
  "Employees",
  "Reports",
  "Settings",
];


export default function AccessManagement(){

const [admins,setAdmins] = useState([
  {
    name:"Main Admin",
    email:"admin@omtavta.com",
    role:"Super Admin",
  }
]);


const [email,setEmail] = useState("");
const [name,setName] = useState("");
const [role,setRole] = useState("Admin");


const [permissions,setPermissions] = useState<string[]>([]);


function addAdmin(){

if(!email || !name) return;


const newUser = {

name,
email,
role,
permissions

};


updateAppSettings({

access:{

users:[

...appSettings.access.users,

newUser

]

}

});


setAdmins([

...admins,

newUser

]);


setName("");
setEmail("");
setPermissions([]);

}



function togglePermission(item:string){

if(permissions.includes(item)){

setPermissions(
 permissions.filter(
 p=>p!==item
 )
);

}
else{

setPermissions([
 ...permissions,
 item
]);

}

}



return(

<div
style={{
padding:"25px"
}}
>


<h1
style={{
fontSize:"28px",
fontWeight:700
}}
>
👥 Access Management
</h1>



<div
style={{
display:"grid",
gridTemplateColumns:"1fr 1fr",
gap:20,
marginTop:25
}}
>


{/* Add Admin */}

<div
style={card}
>

<h2>
<UserPlus size={20}/>
 Add New Admin
</h2>


<input
placeholder="Name"
value={name}
onChange={(e)=>setName(e.target.value)}
style={input}
/>


<input
placeholder="Email ID"
value={email}
onChange={(e)=>setEmail(e.target.value)}
style={input}
/>



<select
style={input}
value={role}
onChange={(e)=>setRole(e.target.value)}
>

<option>
Admin
</option>

<option>
HR Admin
</option>

<option>
Manager
</option>

<option>
Employee
</option>

</select>



<h3>
Module Access
</h3>


{
modules.map(item=>(

<label
key={item}
style={{
display:"block",
marginBottom:8
}}
>

<input
type="checkbox"
checked={permissions.includes(item)}
onChange={()=>togglePermission(item)}
/>

{" "}
{item}

</label>

))

}



<button
onClick={addAdmin}
style={button}
>
Save Access
</button>


</div>





{/* Admin List */}

<div
style={card}
>

<h2>
Existing Admins
</h2>


{
admins.map((admin,index)=>(

<div
key={index}
style={{
borderBottom:"1px solid #eee",
padding:"12px 0",
display:"flex",
justifyContent:"space-between"
}}
>

<div>

<b>{admin.name}</b>

<br/>

<span>
{admin.email}
</span>

<br/>

<small>
{admin.role}
</small>

</div>


<button
style={{
border:"none",
background:"transparent",
color:"red"
}}
>

<Trash2 size={18}/>

</button>


</div>

))

}


</div>


</div>

</div>

)

}




const card={
background:"#fff",
padding:"25px",
borderRadius:"16px",
boxShadow:"0 5px 20px rgba(0,0,0,.05)"
};


const input={
width:"100%",
padding:"12px",
margin:"8px 0",
border:"1px solid #ddd",
borderRadius:"8px"
};


const button={
marginTop:20,
background:"#2563EB",
color:"#fff",
padding:"12px 25px",
border:"none",
borderRadius:"10px",
cursor:"pointer"
};