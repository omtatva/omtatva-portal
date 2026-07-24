"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";


export default function Payslip({

salary

}){


const generatePDF=()=>{


const doc=new jsPDF();



/*
 Company Header
*/


doc.setFontSize(18);

doc.text(
"Omtatva Digitals",
20,
20
);


doc.setFontSize(12);

doc.text(
"Salary Payslip",
20,
30
);



/*
 Employee Details
*/


doc.text(

`Employee Name : ${salary.employeeName}`,

20,

45

);


doc.text(

`Employee ID : ${salary.employeeId}`,

20,

55

);



doc.text(

`Department : ${salary.department}`,

20,

65

);



doc.text(

`Designation : ${salary.designation}`,

20,

75

);



doc.text(

`Salary Month : ${salary.salaryMonth}`,

20,

85

);





/*
 Earnings Table
*/


autoTable(doc,{

startY:95,


head:[

[
"Component",
"Amount"
]

],


body:[

[
"Basic Salary",
`₹ ${salary.basicSalary}`
],

[
"HRA",
`₹ ${salary.hra}`
],

[
"Special Allowance",
`₹ ${salary.specialAllowance}`
],

[
"Medical",
`₹ ${salary.medical}`
],

[
"Conveyance",
`₹ ${salary.conveyance}`
],

[
"Food Allowance",
`₹ ${salary.foodAllowance}`
],


[
"Internet Allowance",
`₹ ${salary.internetAllowance}`
]


]


});





/*
 Deduction Table
*/


autoTable(doc,{

startY:
doc.lastAutoTable.finalY + 10,


head:[

[
"Deduction",
"Amount"
]

],


body:[

[
"PF",
`₹ ${salary.pf}`
],


[
"ESI",
`₹ ${salary.esi}`
],


[
"Professional Tax",
`₹ ${salary.professionalTax}`
],


[
"TDS",
`₹ ${salary.tds}`
]


]


});





const netSalary =

Number(salary.grossSalary || 0)

-

(

Number(salary.pf || 0)+

Number(salary.esi || 0)+

Number(salary.professionalTax || 0)+

Number(salary.tds || 0)

);



doc.text(

`Gross Salary : ₹ ${salary.grossSalary}`,

20,

doc.lastAutoTable.finalY + 20

);



doc.text(

`Net Salary : ₹ ${netSalary}`,

20,

doc.lastAutoTable.finalY + 30

);





doc.save(

`${salary.employeeName}_Payslip.pdf`

);


};





return(

<button

onClick={generatePDF}

className="
bg-green-600
text-white
px-4
py-2
rounded-lg
"

>

Download Payslip

</button>

)


}