"use client";

import React, { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useReportingLine } from "@/lib/useReportingLine";
import { departmentOptions } from "@/lib/departments";
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
 setProfile,
 saveProfile,
}=useProfile();


const [isSaving,setIsSaving]=useState(false);


// Reporting manager is assigned by HR (Admin -> Organization Hierarchy)
// and read live from there — employees can't edit it, so the profile can
// never disagree with the hierarchy shown on the dashboard.
const [myUid,setMyUid]=useState<string|null>(null);

useEffect(()=>{
const unsub=onAuthStateChanged(auth,(u)=>setMyUid(u?u.uid:null));
return ()=>unsub();
},[]);

// Only my own reporting line is loaded (never the whole company).
const {index:orgIndex,ready:orgReady}=useReportingLine(myUid);

const myManager=(()=>{
const me=myUid?orgIndex?.byId.get(myUid):undefined;
return me?.managerId?orgIndex?.byId.get(me.managerId):undefined;
})();



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



const handleSaveAndContinue = async () => {
  setIsSaving(true);
  const ok = await saveProfile(profile);
  setIsSaving(false);
  if (ok) next();
};



return (

<div>


<h2
style={{
color:"#3d6fa8",
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

{departmentOptions([profile.department]).map((d)=>(
<option key={d}>{d}</option>
))}


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

readOnly

style={{...input,background:"#f1f5f9",cursor:"not-allowed"}}

value={
!orgReady
?"Loading…"
:myManager
?`${myManager.name}${myManager.designation?` — ${myManager.designation}`:""}`
:"Not assigned yet (set by HR)"
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
NA
</option>
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

onClick={handleSaveAndContinue}

disabled={isSaving}

style={{

background:"#3d6fa8",

color:"#fff",

border:"none",

padding:"14px 30px",

borderRadius:12,

cursor:"pointer",

fontWeight:700,

opacity: isSaving ? 0.7 : 1,

}}

>

{isSaving ? "Saving..." : "Save & Continue →"}

</button>



</div>



</div>

);

}