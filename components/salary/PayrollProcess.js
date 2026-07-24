"use client";

import { useState } from "react";

import {
collection,
addDoc,
Timestamp,
getDocs,
query,
where
} from "firebase/firestore";

import { db } from "@/lib/firebase";



export default function PayrollProcess({

salaryList,
loadSalary

}){


const [month,setMonth]=useState("");

const [processing,setProcessing]=useState(false);





/*
 Get Attendance Data
*/

const getEmployeeAttendance = async(
employeeId,
month
)=>{


const q=query(

collection(db,"attendance"),

where(
"employeeId",
"==",
employeeId
)

);



const snapshot = await getDocs(q);



const attendance = snapshot.docs.map(doc=>({

id:doc.id,

...doc.data()

}));



return attendance.filter(
  (item) =>
    item.date &&
    item.date.startsWith(month)
);


};





/*
 Get Approved Leaves
*/


const getEmployeeLeaves = async(
employeeId
)=>{


const q=query(

collection(db,"leaves"),

where(
"employeeId",
"==",
employeeId
),

where(
"status",
"==",
"Approved"
)

);



const snapshot = await getDocs(q);



return snapshot.docs.map(doc=>({

id:doc.id,

...doc.data()

}));


};






/*
 Payroll Calculation
*/


const calculatePayroll=(

salary,

attendance,

leaves

)=>{


const totalDays=30;



const presentDays = attendance.filter(

item=>item.status==="Present"

).length;




const absentDays = attendance.filter(

item=>item.status==="Absent"

).length;





const leaveDays = leaves.reduce(

(total,item)=>

total + Number(item.totalDays || 0),

0

);





const unpaidLeaveDays = leaves

.filter(

item=>

item.leaveType==="Unpaid Leave"

)

.reduce(

(total,item)=>

total + Number(item.totalDays || 0),

0

);






const perDaySalary =

Number(salary.basicSalary || 0)

/

totalDays;





const lopDeduction =

(absentDays + unpaidLeaveDays)

*

perDaySalary;





const fixedDeduction =

Number(salary.pf || 0)+

Number(salary.esi || 0)+

Number(salary.professionalTax || 0)+

Number(salary.tds || 0);





const netSalary =

Number(salary.grossSalary || 0)

-

fixedDeduction

-

lopDeduction;





return{


presentDays,

absentDays,

leaveDays,

unpaidLeaveDays,

lopDeduction,

fixedDeduction,

netSalary


};



};








const generatePayroll=async()=>{


if(!month){

alert(
"Select payroll month"
);

return;

}



try{


setProcessing(true);





for(const salary of salaryList){



// Attendance

const attendance =

await getEmployeeAttendance(

salary.employeeId,

month

);




// Leaves

const leaves =

await getEmployeeLeaves(

salary.employeeId

);





// Calculate Salary

const payroll =

calculatePayroll(

salary,

attendance,

leaves

);
const existingPayroll = await getDocs(
  query(
    collection(db, "payroll"),
    where("employeeId", "==", salary.employeeId),
    where("salaryMonth", "==", month)
  )
);

if (!existingPayroll.empty) {
  continue;
}






await addDoc(

collection(db,"payroll"),

{


employeeId:

salary.employeeId,



employeeName:

salary.employeeName,



department:

salary.department,



designation:

salary.designation,



salaryMonth:

month,





// nndance Details

presentDays:

payroll.presentDays,


absentDays:

payroll.absentDays,


leaveDays:

payroll.leaveDays,


unpaidLeaveDays:

payroll.unpaidLeaveDays,





// Salary Details


grossSalary:

salary.grossSalary,



fixedDeduction:

payroll.fixedDeduction,



lopDeduction:

Math.round(payroll.lopDeduction),



deduction:

Math.round(

payroll.fixedDeduction +

payroll.lopDeduction

),



netSalary:

Math.round(payroll.netSalary),


basicSalary: salary.basicSalary,
hra: salary.hra,
specialAllowance: salary.specialAllowance,
medical: salary.medical,
conveyance: salary.conveyance,
foodAllowance: salary.foodAllowance,
internetAllowance: salary.internetAllowance,

pf: salary.pf,
esi: salary.esi,
professionalTax: salary.professionalTax,
tds: salary.tds,


status:

"Pending",





createdAt:

Timestamp.now(),



updatedAt:

Timestamp.now()


}

);


}




alert(

"Payroll Generated Successfully"

);


if(loadSalary){

loadSalary();

}


}


catch(error){


console.log(
"Payroll Error:",
error
);


alert(

"Payroll generation failed"

);


}


finally{


setProcessing(false);


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
mb-4
">

Payroll Processing

</h2>





<div className="
flex
gap-4
items-center
">


<input


type="month"


value={month}


onChange={(e)=>

setMonth(e.target.value)

}


className="
border
p-3
rounded-lg
"


/>







<button


onClick={generatePayroll}


disabled={processing}


className="
bg-purple-600
text-white
px-6
py-3
rounded-lg
"


>


{

processing

?

"Processing..."

:

"Generate Payroll"

}



</button>



</div>



</div>


)

}