"use client";

import Payslip from "./Payslip";


export default function EmployeePayrollHistory({

payrollList=[],
employeeId

}){


const employeePayroll = payrollList.filter(

(payroll)=>

payroll.employeeId === employeeId

);



return (

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

My Salary History

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
Month
</th>


<th className="p-3">
Gross Salary
</th>


<th className="p-3">
Deduction
</th>


<th className="p-3">
Net Salary
</th>


<th className="p-3">
Status
</th>


<th className="p-3">
Payslip
</th>


</tr>


</thead>




<tbody>


{


employeePayroll.length > 0 ?


employeePayroll.map((salary)=>(


<tr

key={salary.id}

className="border-b"

>


<td className="p-3">

{salary.salaryMonth}

</td>



<td className="p-3">

₹ {salary.grossSalary}

</td>



<td className="p-3 text-red-600">

₹ {salary.deduction}

</td>



<td className="
p-3
font-bold
text-green-700
">

₹ {salary.netSalary}

</td>



<td className="p-3">


<span className="
bg-green-100
px-3
py-1
rounded-full
">

{salary.status}

</span>


</td>



<td className="p-3">


<Payslip

salary={salary}

/>


</td>



</tr>


))


:


<tr>

<td

colSpan="6"

className="
text-center
p-5
text-gray-500
"

>

No Salary History Found

</td>

</tr>



}


</tbody>


</table>


</div>


</div>


)

}