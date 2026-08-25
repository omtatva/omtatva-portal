"use client";

import {
doc,
updateDoc,
Timestamp
} from "firebase/firestore";

import { db } from "@/lib/firebase";


export default function PayrollTable({

payrollList=[],
loadPayroll,
canEdit = true

}){



const updateStatus=async(id,status)=>{

if(!canEdit){
alert("View only — you don't have edit access for Salary Structure");
return;
}

try{


await updateDoc(

doc(
db,
"payroll",
id
),

{

status,

updatedAt:
Timestamp.now()

}

);



alert(
`Payroll ${status}`
);



loadPayroll();


}

catch(error){

console.log(error);

}



};






return(

<div className="
bg-white
rounded-xl
shadow
p-5
mt-8
">


<h2 className="
text-xl
font-semibold
mb-5
">

Payroll Records

</h2>




<div className="
overflow-x-auto
">


<table className="
w-full
border-collapse
">


<thead>


<tr className="
bg-gray-100
">


<th className="p-3">
Employee
</th>


<th className="p-3">
Month
</th>


<th className="p-3">
Gross
</th>


<th className="p-3">
Deduction
</th>


<th className="p-3">
Net Salary
</th>
<th>
Present Days
</th>

<th>
LOP
</th>

<th className="p-3">
Status
</th>


<th className="p-3">
Action
</th>


</tr>


</thead>





<tbody>


{

payrollList.length > 0 ?


payrollList.map((payroll)=>(



<tr

key={payroll.id}

className="
border-b
"


>


<td className="p-3">

{payroll.employeeName}

</td>




<td className="p-3">

{payroll.salaryMonth}

</td>




<td className="p-3">

₹ {payroll.grossSalary}

</td>




<td className="p-3 text-red-600">

₹ {payroll.deduction}

</td>




<td className="p-3 font-bold text-green-700">

₹ {payroll.netSalary}

</td>


<td>
{payroll.presentDays}
</td>


<td>
₹ {payroll.lopDeduction}
</td>

<td className="p-3">

<span className="
px-3
py-1
rounded-full
bg-yellow-100
">

{payroll.status}

</span>

</td>





<td className="
p-3
flex
gap-2
">


<button

onClick={()=>updateStatus(
payroll.id,
"Approved"
)}

className="
bg-blue-600
text-white
px-3
py-1
rounded
"

>

Approve

</button>




<button

onClick={()=>updateStatus(
payroll.id,
"Rejected"
)}

className="
bg-red-600
text-white
px-3
py-1
rounded
"

>

Reject

</button>




<button

onClick={()=>updateStatus(
payroll.id,
"Paid"
)}

className="
bg-green-600
text-white
px-3
py-1
rounded
"

>

Paid

</button>


</td>


</tr>



))


:


<tr>

<td

colSpan="7"

className="
text-center
p-5
text-gray-500
"

>

No Payroll Generated

</td>

</tr>


}



</tbody>


</table>


</div>


</div>


)

}