"use client";

import React, { useEffect, useState } from "react";

import { auth } from "../../../lib/firebase";
import { useProfile } from "../ProfileContext";

export default function BankDetails({
  back,
  next,
}: {
  back: () => void;
  next: () => void;
}) {


const { profile, setProfile, saveProfile } = useProfile();


const [isAdminOrIT, setIsAdminOrIT] = useState(false);

const [isSaving, setIsSaving] = useState(false);



useEffect(()=>{

const user = auth.currentUser;

if(!user) return;


const email = user.email?.toLowerCase();



const allowedEmails = [

"admin@omtatvadigitals.com",

"itsupport@omtatvadigitals.com"

];



if(
email &&
allowedEmails.includes(email)
){

setIsAdminOrIT(true);

}


},[]);




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




const handleNext = async ()=>{


if(!isAdminOrIT){


if(

!profile.bankAccountHolder ||

!profile.bankName ||

!profile.accountNumber ||

!profile.ifsc

){

alert(
"Please complete mandatory bank details"
);

return;

}


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
🏦 Bank Details
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
Account Holder Name 
{!isAdminOrIT && "*"}
</label>


<input

style={input}

value={
profile.bankAccountHolder || ""
}

onChange={(e)=>

updateField(
"bankAccountHolder",
e.target.value
)

}

/>

</div>





<div>

<label>
Bank Name 
{!isAdminOrIT && "*"}
</label>


<input

style={input}

value={
profile.bankName || ""
}

onChange={(e)=>

updateField(
"bankName",
e.target.value
)

}

/>

</div>





<div>

<label>
Account Number 
{!isAdminOrIT && "*"}
</label>


<input

style={input}

type="number"

value={
profile.accountNumber || ""
}

onChange={(e)=>

updateField(
"accountNumber",
e.target.value
)

}

/>

</div>





<div>

<label>
Confirm Account Number
</label>


<input

style={input}

type="number"

value={
profile.confirmAccountNumber || ""
}

onChange={(e)=>

updateField(
"confirmAccountNumber",
e.target.value
)

}

/>

</div>






<div>

<label>
IFSC Code 
{!isAdminOrIT && "*"}
</label>


<input

style={input}

placeholder="SBIN0001234"

value={
profile.ifsc || ""
}

onChange={(e)=>

updateField(
"ifsc",
e.target.value.toUpperCase()
)

}

/>

</div>






<div>

<label>
Branch Name
</label>


<input

style={input}

value={
profile.branch || ""
}

onChange={(e)=>

updateField(
"branch",
e.target.value
)

}

/>

</div>






<div>

<label>
UPI ID
</label>


<input

style={input}

placeholder="name@bank"

value={
profile.upi || ""
}

onChange={(e)=>

updateField(
"upi",
e.target.value
)

}

/>

</div>






<div>

<label>
Account Type
</label>


<select

style={input}

value={
profile.accountType || "Savings"
}

onChange={(e)=>

updateField(
"accountType",
e.target.value
)

}

>


<option>
Savings
</option>

<option>
Current
</option>

<option>
Salary
</option>


</select>


</div>






<div>

<label>
PF Number
</label>


<input

style={input}

value={
profile.pfNumber || ""
}

onChange={(e)=>

updateField(
"pfNumber",
e.target.value
)

}

/>

</div>






<div>

<label>
ESIC Number
</label>


<input

style={input}

value={
profile.esicNumber || ""
}

onChange={(e)=>

updateField(
"esicNumber",
e.target.value
)

}

/>

</div>





<div>

<label>
UAN Number
</label>


<input

style={input}

value={
profile.uanNumber || ""
}

onChange={(e)=>

updateField(
"uanNumber",
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

onClick={handleNext}

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