"use client";

import React from "react";
import { useProfile } from "../ProfileContext";


export default function EmploymentDetails({
  back,
  next,
}: {
  back: () => void;
  next: () => void;
}) {


const {
 profile,
 setProfile
}=useProfile();



const input:React.CSSProperties={

width:"100%",
height:52,
border:"1px solid #d1d5db",
borderRadius:12,
padding:"0 15px",
fontSize:15,
marginTop:8,
boxSizing:"border-box",

};



const updateField=(field:string,value:string)=>{

setProfile({

...profile,

[field]:value

});

};



return (

<div>


<h2
style={{
color:"#2563eb",
marginBottom:30
}}
>
💼 Employment Details
</h2>



<div

style={{

display:"grid",

gridTemplateColumns:
"repeat(2,minmax(0,1fr))",

gap:25

}}

>



<div>

<label>
Employee Code
</label>

<input

style={input}

value={
profile.employeeCode || ""
}

onChange={(e)=>
updateField(
"employeeCode",
e.target.value
)
}

/>

</div>





<div>

<label>
Department
</label>


<select

style={input}

value={
profile.department || ""
}

onChange={(e)=>

updateField(
"department",
e.target.value
)

}

>


<option value="">
Select
</option>

<option>
Production
</option>

<option>
HR
</option>

<option>
Marketing
</option>

<option>
Finance
</option>

<option>
Operations
</option>

<option>
Creative
</option>


</select>

</div>






<div>

<label>
Designation
</label>


<input

style={input}

value={
profile.designation || ""
}

onChange={(e)=>

updateField(
"designation",
e.target.value
)

}

/>


</div>





<div>

<label>
Reporting Manager
</label>


<input

style={input}

value={
profile.reportingManager || ""
}

onChange={(e)=>

updateField(
"reportingManager",
e.target.value
)

}

/>


</div>







<div>

<label>
Employment Type
</label>


<select

style={input}

value={
profile.employmentType || ""
}

onChange={(e)=>

updateField(
"employmentType",
e.target.value
)

}

>


<option value="">
Select
</option>


<option>
Permanent
</option>

<option>
Contract
</option>

<option>
Intern
</option>

<option>
Freelancer
</option>


</select>


</div>






<div>

<label>
Work Mode
</label>


<select

style={input}

value={
profile.workMode || ""
}

onChange={(e)=>

updateField(
"workMode",
e.target.value
)

}

>


<option>
Office
</option>

<option>
Hybrid
</option>

<option>
Remote
</option>


</select>


</div>








<div>

<label>
Office Location
</label>


<input

style={input}

value={
profile.officeLocation || ""
}

onChange={(e)=>

updateField(
"officeLocation",
e.target.value
)

}

/>


</div>






<div>

<label>
Joining Date
</label>


<input

type="date"

style={input}

value={
profile.joiningDate || ""
}

onChange={(e)=>

updateField(
"joiningDate",
e.target.value
)

}

/>


</div>







<div>

<label>
Confirmation Date
</label>


<input

type="date"

style={input}

value={
profile.confirmationDate || ""
}

onChange={(e)=>

updateField(
"confirmationDate",
e.target.value
)

}

/>


</div>







<div>

<label>
Notice Period
</label>


<select

style={input}

value={
profile.noticePeriod || ""
}

onChange={(e)=>

updateField(
"noticePeriod",
e.target.value
)

}

>


<option>
15 Days
</option>

<option>
30 Days
</option>

<option>
60 Days
</option>

<option>
90 Days
</option>


</select>


</div>







<div>

<label>
Employee Status
</label>


<select

style={input}

value={
profile.employeeStatus || ""
}

onChange={(e)=>

updateField(
"employeeStatus",
e.target.value
)

}

>


<option>
Active
</option>

<option>
Probation
</option>

<option>
On Leave
</option>

<option>
Resigned
</option>


</select>


</div>








<div>

<label>
Official Email
</label>


<input

style={{
...input,
background:"#f3f4f6"
}}

value={
profile.officialEmail || ""
}

disabled

/>


</div>



</div>







<div

style={{

display:"flex",

justifyContent:"space-between",

marginTop:45

}}

>



<button

onClick={back}

style={{

background:"#64748b",

color:"#fff",

border:"none",

padding:"14px 30px",

borderRadius:12,

cursor:"pointer",

fontWeight:700

}}

>

← Back

</button>





<button

onClick={next}

style={{

background:"#2563eb",

color:"#fff",

border:"none",

padding:"14px 30px",

borderRadius:12,

cursor:"pointer",

fontWeight:700

}}

>

Save & Continue →

</button>



</div>



</div>

);

}