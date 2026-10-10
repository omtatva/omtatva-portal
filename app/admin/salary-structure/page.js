"use client";

import { useEffect, useState } from "react";

import SalaryForm from "@/components/salary/SalaryForm";
import SalaryDashboard from "@/components/salary/salaryDashboard";
import EmployeeSearch from "@/components/salary/EmployeeSearch";
import SalaryTable from "@/components/salary/SalaryTable";



import {
collection,
getDocs
} from "firebase/firestore";


import { db } from "@/lib/firebase";
import { usePermission } from "@/lib/usePermission";
import { postJson } from "@/lib/reportsClient";



export default function SalaryStructurePage(){


const { canEdit } = usePermission("salaryStructure");

const [employees,setEmployees]=useState([]);

const [salaryList,setSalaryList]=useState([]);


const [loading,setLoading]=useState(true);


const [search,setSearch]=useState("");

const [selectedEmployee,setSelectedEmployee]=useState(null);

const [editId,setEditId]=useState("");



const [form,setForm]=useState({

employeeId:"",
employeeName:"",
department:"",
designation:"",

salaryMonth:"",
salaryYear:"",

basicSalary:"",
hra:"",
specialAllowance:"",
medical:"",
conveyance:"",
foodAllowance:"",
internetAllowance:"",

pf:"",
esi:"",
professionalTax:"",
tds:""

});





const grossSalary =

Number(form.basicSalary || 0)

+

Number(form.hra || 0)

+

Number(form.specialAllowance || 0)

+

Number(form.medical || 0)

+

Number(form.conveyance || 0)

+

Number(form.foodAllowance || 0)

+

Number(form.internetAllowance || 0);





const totalDeduction =

Number(form.pf || 0)

+

Number(form.esi || 0)

+

Number(form.professionalTax || 0)

+

Number(form.tds || 0);





const netSalary =

grossSalary-totalDeduction;






useEffect(()=>{


loadEmployees();

loadSalary();



},[]);






const loadEmployees=async()=>{


const snapshot=

await getDocs(

collection(db,"users")

);



const list=snapshot.docs.map(doc=>({

id:doc.id,

...doc.data()

}))

.filter(emp=>

emp.status==="active"

);



setEmployees(list);


};








const loadSalary=async()=>{


const snapshot=

await getDocs(

collection(db,"salaryStructure")

);



const list=snapshot.docs.map(doc=>({

id:doc.id,

...doc.data()

}));



setSalaryList(list);

setLoading(false);


};








const selectEmployee=(emp)=>{


setSelectedEmployee(emp);



setForm({

...form,

employeeId:
emp.employeeId || emp.id,

employeeName:
emp.name,

department:
emp.department,

designation:
emp.designation

});


};








const handleChange=(e)=>{


setForm({

...form,

[e.target.name]:

e.target.value

});


};









// Saved through the server (/api/payroll/salary-save): it checks your access,
// keeps a backup of the old values and records who changed what and why.
const saveSalary=async()=>{

if(!canEdit){
alert("View only — you don't have edit access for Salary Structure");
return;
}

if(!form.employeeId){
alert("Select an employee first");
return;
}

if(!editId && salaryList.some(x=>x.employeeId===form.employeeId)){
alert("Salary already exists for this employee — use Edit on the existing record");
return;
}

const reason=window.prompt("Reason for this salary change (required, at least 5 characters):");

if(!reason || reason.trim().length<5){
alert("A reason is required to save a salary change.");
return;
}

try{

const values={};

for(const key of ["basicSalary","hra","specialAllowance","medical","conveyance","foodAllowance","internetAllowance","pf","esi","professionalTax","tds"]){
values[key]= form[key]===""||form[key]===undefined||form[key]===null ? 0 : form[key];
}

await postJson("/api/payroll/salary-save",{
employeeId:form.employeeId,
values,
reason
});

alert(editId?"Salary Updated":"Salary Saved");

resetForm();
loadSalary();

}
catch(error){
console.log(error);
alert(error?.message || "Salary Save Failed");
}

};

const editSalary=(salary)=>{


setEditId(

salary.id

);



setForm({

employeeId:
salary.employeeId,

employeeName:
salary.employeeName,

department:
salary.department,

designation:
salary.designation,


salaryMonth:
salary.salaryMonth || "",


salaryYear:
salary.salaryYear || "",


basicSalary:
salary.basicSalary,


hra:
salary.hra,


specialAllowance:
salary.specialAllowance,


medical:
salary.medical,


conveyance:
salary.conveyance,


foodAllowance:
salary.foodAllowance,


internetAllowance:
salary.internetAllowance,


pf:
salary.pf,


esi:
salary.esi,


professionalTax:
salary.professionalTax,


tds:
salary.tds


});


};








const deleteSalary=async(id)=>{

if(!canEdit){
alert("View only — you don't have edit access for Salary Structure");
return;
}

if(!confirm("Delete this salary structure? A backup is kept.")) return;

const reason=window.prompt("Reason for deleting (required, at least 5 characters):");

if(!reason || reason.trim().length<5){
alert("A reason is required.");
return;
}

try{
await postJson("/api/payroll/salary-delete",{structureId:id,reason});
alert("Salary Deleted");
loadSalary();
}
catch(error){
alert(error?.message || "Delete failed");
}

};

const resetForm=()=>{


setEditId("");

setSelectedEmployee(null);



setForm({

employeeId:"",

employeeName:"",

department:"",

designation:"",

salaryMonth:"",

salaryYear:"",

basicSalary:"",

hra:"",

specialAllowance:"",

medical:"",

conveyance:"",

foodAllowance:"",

internetAllowance:"",

pf:"",

esi:"",

professionalTax:"",

tds:""

});


};









return(

<div className="
min-h-screen
bg-gray-100
p-6
">


<h1 className="
text-3xl
font-bold
mb-6
">

Salary Structure Management

</h1>





<SalaryDashboard

employees={employees}

salaryList={salaryList}

/>







<div className="
bg-white
rounded-xl
shadow
p-5
mt-8
">


<EmployeeSearch

employees={employees}

search={search}

setSearch={setSearch}

setSelectedEmployee={selectEmployee}

/>



</div>






<div className="
mt-8
bg-white
rounded-xl
shadow
p-6
">


<SalaryForm

form={form}

setForm={setForm}

grossSalary={grossSalary}

saveSalary={saveSalary}

editId={editId}

/>



</div>







<SalaryTable

salaryList={salaryList}

editSalary={editSalary}

deleteSalary={deleteSalary}

/>







<div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mt-8">
<h2 className="text-xl font-bold mb-1">Bulk upload &amp; payroll have moved</h2>
<p className="text-gray-700 mb-3">Upload salary sheets (.xlsx / .csv with a preview), calculate payroll, approve it and generate payslips from the Payroll page.</p>
<a href="/admin/payroll" className="inline-block px-5 py-2.5 rounded-lg bg-blue-700 text-white font-semibold">Open Payroll</a>
</div>





</div>

)


}