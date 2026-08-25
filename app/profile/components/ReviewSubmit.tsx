"use client";

import { useState } from "react";
import { useProfile } from "../ProfileContext";
import { useRouter } from "next/navigation";

import {
  auth,
  db,
} from "../../../lib/firebase";

import {
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

import toast from "react-hot-toast";


export default function ReviewSubmit({

back,

}:{

back:()=>void;

}){


const { profile } = useProfile();

const [loading,setLoading]=useState(false);

const router = useRouter();





const submitProfile = async()=>{


const user = auth.currentUser;


if(!user){

toast.error(
"User not logged in"
);

return;

}



try{


setLoading(true);




// 1. Save Employee Master Profile

await setDoc(

doc(
db,
"employees",
user.uid
),

{


uid:user.uid,

email:user.email,


...profile,


profileCompleted:true,


// NOTE: no "status" field here on purpose. This used to always write
// status: "Pending HR Verification" on every submit/resubmit — a
// completely separate vocabulary from the real HR approval workflow
// (hrApprovalStatus: Pending/Approved/Rejected + status: active/
// inactive, set from Admin -> Users). Because employees/{uid} is
// merged in LAST when the admin page loads an employee, resubmitting
// a profile after HR had already approved it silently flipped their
// status back to "pending" on that screen.


createdAt:
serverTimestamp(),


updatedAt:
serverTimestamp()


},

{
merge:true
}

);







// 2. Save Employee Profile Details


await setDoc(

doc(
db,
"employeeProfiles",
user.uid
),


{


uid:user.uid,


email:user.email,


...profile,


profileCompleted:true,


updatedAt:
serverTimestamp()


},


{
merge:true
}

);








// 3. Create User Access Record


await setDoc(

doc(
db,
"users",
user.uid
),

{


uid:user.uid,


email:user.email,


firstName:
profile.firstName || "",


lastName:
profile.lastName || "",


profilePhoto:
profile.profilePhoto || "",


department:
profile.department || "",


designation:
profile.designation || "",


// NOTE: "role" and "status" are intentionally NOT written here. This
// used to unconditionally set role:"employee" and status:"active" on
// every submit/resubmit — which meant an HR/Admin/Head account that
// re-saved their OWN profile (e.g. just updating a phone number) got
// silently demoted back to "employee", and anyone HR had marked
// inactive could reactivate themselves just by resubmitting. Both
// fields are owned by Settings -> Access Management / Admin -> Users
// now; merge:true leaves whatever is already there untouched.


profileCompleted:true,


updatedAt:
serverTimestamp()


},


{
merge:true
}

);






toast.success(
"Profile submitted successfully"
);




// Redirect Employee Dashboard

setTimeout(()=>{

router.push(
"/dashboard"
);


},1000);



}



catch(error:any){


console.log(
"Submit Error:",
error
);


toast.error(
"Profile submission failed"
);


}



finally{


setLoading(false);


}


};







return (

<div>


<h2
style={{
color:"#3d6fa8",
marginBottom:25
}}
>
✅ Review & Submit
</h2>





<div

style={{

background:"#f8fafc",

border:"1px solid #dbeafe",

borderRadius:20,

padding:35,

lineHeight:2

}}

>


<h3>
Profile Summary
</h3>



<p>
👤 Name :
{" "}
{profile.firstName}
{" "}
{profile.lastName}
</p>



<p>
📧 Email :
{" "}
{profile.personalEmail}
</p>



<p>
💼 Department :
{" "}
{profile.department}
</p>



<p>
🎯 Designation :
{" "}
{profile.designation}
</p>



<p>
📱 Mobile :
{" "}
{profile.mobile}
</p>



<p>
🏠 City :
{" "}
{profile.currentCity}
</p>




<hr/>


<h4>
Completed Sections
</h4>


<ul>

<li>
✔ Personal Information
</li>

<li>
✔ Address Information
</li>

<li>
✔ Emergency Contact
</li>

<li>
✔ Employment Details
</li>

<li>
✔ Bank Details
</li>

<li>
✔ Documents Uploaded
</li>


</ul>




<p
style={{
color:"#64748b"
}}
>

After submission HR will verify your profile.

</p>



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

disabled={loading}

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

onClick={submitProfile}

disabled={loading}

style={{

background:"#16a34a",

color:"#fff",

border:"none",

padding:"15px 40px",

borderRadius:12,

cursor:"pointer",

fontWeight:700,

fontSize:16

}}

>


{

loading

?

"Submitting..."

:

"🚀 Submit Profile"

}


</button>





</div>


</div>

);

}