"use client";

import * as XLSX from "xlsx";


export default function PayrollExport({

payrollList=[]

}){


const downloadExcel=(data,name)=>{


const worksheet = XLSX.utils.json_to_sheet(data);


const workbook = XLSX.utils.book_new();


XLSX.utils.book_append_sheet(

workbook,

worksheet,

"Payroll"

);



XLSX.writeFile(

workbook,

name

);


};





// Complete Payroll Report

const exportPayroll=()=>{


const data = payrollList.map(item=>({

Employee:
item.employeeName,


Employee_ID:
item.employeeId,


Department:
item.department,


Month:
item.salaryMonth,


Gross_Salary:
item.grossSalary,


Deduction:
item.deduction,


Net_Salary:
item.netSalary,


Status:
item.status


}));



downloadExcel(

data,

"Payroll_Report.xlsx"

);


};







// Bank Transfer Format

const exportBankSheet=()=>{


const data = payrollList.map(item=>({

Employee_Name:
item.employeeName,


Employee_ID:
item.employeeId,


Salary_Month:
item.salaryMonth,


Amount:
item.netSalary,


Payment_Status:
item.status


}));



downloadExcel(

data,

"Bank_Transfer_Sheet.xlsx"

);


};







// Department Report

const exportDepartmentReport=()=>{


const department={};



payrollList.forEach(item=>{


const dept=item.department || "Other";


if(!department[dept]){

department[dept]=0;

}



department[dept]+=Number(

item.netSalary || 0

);


});





const data = Object.keys(department).map(dept=>({

Department:dept,


Total_Salary:

department[dept]


}));





downloadExcel(

data,

"Department_Salary_Report.xlsx"

);


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
font-bold
mb-5
">

Payroll Reports

</h2>




<div className="
flex
gap-4
flex-wrap
">


<button

onClick={exportPayroll}

className="
bg-blue-600
text-white
px-5
py-3
rounded-lg
"

>

Download Payroll Excel

</button>





<button

onClick={exportDepartmentReport}

className="
bg-green-600
text-white
px-5
py-3
rounded-lg
"

>

Department Report

</button>





<button

onClick={exportBankSheet}

className="
bg-purple-600
text-white
px-5
py-3
rounded-lg
"

>

Bank Transfer Sheet

</button>



</div>


</div>


)

}