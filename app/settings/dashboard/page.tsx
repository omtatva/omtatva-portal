"use client";

import { useState } from "react";
import { appSettings, updateAppSettings } from "@/config/appSettings";
import {
  LayoutDashboard,
  CheckCircle,
} from "lucide-react";


export default function DashboardSettingsPage(){


const [attendance,setAttendance] =
useState(
appSettings.dashboard.showAttendance
);


const [leave,setLeave] =
useState(
appSettings.dashboard.showLeave
);


const [holiday,setHoliday] =
useState(
appSettings.dashboard.showHoliday
);


const [employee,setEmployee] =
useState(
appSettings.dashboard.showEmployee
);



function save(){

updateAppSettings({

dashboard:{
showAttendance:attendance,
showLeave:leave,
showHoliday:holiday,
showEmployee:employee
}

});


alert("Dashboard Layout Updated");

}




return(

<div
style={{
padding:"30px",
background:"#f8fbff",
minHeight:"100vh"
}}
>


<h1
style={{
fontSize:"30px",
fontWeight:700
}}
>
🏠 Dashboard Layout
</h1>


<p
style={{
color:"#64748B",
marginBottom:30
}}
>
Control which widgets appear on dashboard
</p>




<div
style={{
background:"#fff",
padding:25,
borderRadius:18,
maxWidth:600,
boxShadow:"0 8px 25px rgba(0,0,0,.05)"
}}
>


<Widget
title="Attendance Card"
value={attendance}
setValue={setAttendance}
/>


<Widget
title="Leave Card"
value={leave}
setValue={setLeave}
/>


<Widget
title="Holiday Card"
value={holiday}
setValue={setHoliday}
/>


<Widget
title="Employee Card"
value={employee}
setValue={setEmployee}
/>



<button

onClick={save}

style={{
marginTop:25,
background:"#2563EB",
color:"#fff",
padding:"14px 35px",
borderRadius:12,
border:"none",
cursor:"pointer",
fontWeight:600
}}

>

Save Layout

</button>


</div>


</div>

)

}





function Widget({
title,
value,
setValue
}:any){

return(

<div
style={{
display:"flex",
justifyContent:"space-between",
alignItems:"center",
padding:"15px 0",
borderBottom:"1px solid #eee"
}}
>


<div
style={{
display:"flex",
alignItems:"center",
gap:10
}}
>

<CheckCircle
size={20}
color={
value
?"#2563EB"
:"#94A3B8"
}
/>

{title}

</div>



<input

type="checkbox"

checked={value}

onChange={(e)=>setValue(e.target.checked)}

/>


</div>

)

}