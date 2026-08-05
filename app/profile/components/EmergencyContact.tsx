"use client";

import React, { useState } from "react";
import { useProfile } from "../ProfileContext";


export default function EmergencyContact({
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



const input: React.CSSProperties = {

width:"100%",
height:52,
border:"1px solid #d1d5db",
borderRadius:12,
padding:"0 15px",
fontSize:15,
marginTop:8,
boxSizing:"border-box",

};



const updateField = (
field:string,
value:string
)=>{

setProfile({

...profile,

[field]:value

});

};





const saveAndContinue = async ()=>{


if(!profile.emergencyName){

alert(
"Please enter emergency contact name"
);

return;

}


if(!profile.emergencyPhone){

alert(
"Please enter emergency phone number"
);

return;

}


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
🚨 Emergency Contact
</h2>




<div

style={{

display:"grid",

gridTemplateColumns:
"repeat(2,minmax(0,1fr))",

gap:25

}}

>




{/* Name */}

<div>

<label>
Contact Name *
</label>


<input

style={input}

value={
profile.emergencyName || ""
}

onChange={(e)=>

updateField(
"emergencyName",
e.target.value
)

}

/>


</div>





{/* Relationship */}

<div>

<label>
Relationship *
</label>


<select

style={input}

value={
profile.emergencyRelation || ""
}

onChange={(e)=>

updateField(
"emergencyRelation",
e.target.value
)

}

>


<option value="">
Select
</option>


<option>
Father
</option>

<option>
Mother
</option>

<option>
Spouse
</option>

<option>
Brother
</option>

<option>
Sister
</option>

<option>
Friend
</option>

<option>
Guardian
</option>

<option>
Other
</option>


</select>


</div>





{/* Country Code */}


<div>


<label>
Country Code
</label>


<select

style={input}

value={
profile.emergencyCountryCode || "+91"
}

onChange={(e)=>

updateField(
"emergencyCountryCode",
e.target.value
)

}

>


<option value="+91">
🇮🇳 +91 India
</option>


<option value="+1">
🇺🇸 +1 USA
</option>


<option value="+44">
🇬🇧 +44 UK
</option>


<option value="+971">
🇦🇪 +971 UAE
</option>


</select>


</div>






{/* Mobile */}


<div>

<label>
Primary Mobile *
</label>


<input

type="tel"

placeholder="10 digit number"

style={input}

value={
profile.emergencyPhone || ""
}

onChange={(e)=>

updateField(
"emergencyPhone",
e.target.value
)

}

/>


</div>






{/* Alternate Mobile */}

<div>


<label>
Alternate Mobile
</label>


<input

type="tel"

style={input}

value={
profile.emergencyAlternatePhone || ""
}

onChange={(e)=>

updateField(
"emergencyAlternatePhone",
e.target.value
)

}

/>


</div>





{/* Email */}

<div>


<label>
Email Address
</label>


<input

type="email"

style={input}

value={
profile.emergencyEmail || ""
}

onChange={(e)=>

updateField(
"emergencyEmail",
e.target.value
)

}

/>


</div>





{/* Occupation */}

<div>


<label>
Occupation
</label>


<input

style={input}

value={
profile.emergencyOccupation || ""
}

onChange={(e)=>

updateField(
"emergencyOccupation",
e.target.value
)

}

/>


</div>






{/* Address */}

<div
style={{
gridColumn:"1 / span 2"
}}
>


<label>
Address
</label>


<textarea

style={{

...input,

height:120,

padding:"15px"

}}

value={
profile.emergencyAddress || ""
}

onChange={(e)=>

updateField(
"emergencyAddress",
e.target.value
)

}

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

onClick={saveAndContinue}

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