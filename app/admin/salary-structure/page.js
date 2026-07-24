"use client";

import { useEffect, useState } from "react";

import BulkUpload from "@/components/salary/BulkUpload";
import SalaryForm from "@/components/salary/SalaryForm";
import SalaryDashboard from "@/components/salary/salaryDashboard";
import EmployeeSearch from "@/components/salary/EmployeeSearch";
import SalaryTable from "@/components/salary/SalaryTable";

import PayrollProcess from "@/components/salary/PayrollProcess";
import PayrollTable from "@/components/salary/PayrollTable";
import PayrollDashboard from "@/components/salary/PayrollDashboard";
import PayrollExport from "@/components/salary/PayrollExport";


import {
collection,
getDocs,
addDoc,
updateDoc,
deleteDoc,
doc,
query,
where,
Timestamp
} from "firebase/firestore";


import { db } from "@/lib/firebase";



export default function SalaryStructurePage(){



const [employees,setEmployees]=useState([]);

const [salaryList,setSalaryList]=useState([]);

const [payrollList,setPayrollList]=useState([]);

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

loadPayroll();


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








const loadPayroll=async()=>{


const snapshot=

await getDocs(

collection(db,"payroll")

);



const list=snapshot.docs.map(doc=>({

id:doc.id,

...doc.data()

}));



setPayrollList(list);


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









const saveSalary=async()=>{


try{



if(editId){



await updateDoc(

doc(

db,

"salaryStructure",

editId

),

{


...form,

grossSalary,

netSalary,

updatedAt:

Timestamp.now()


}

);



alert(
"Salary Updated"
);



}

else{



const q=query(

collection(db,"salaryStructure"),

where(

"employeeId",

"==",

form.employeeId

)

);



const existing=

await getDocs(q);



if(!existing.empty){


alert(

"Salary already exists"

);


return;

}



await addDoc(

collection(db,"salaryStructure"),

{


...form,

grossSalary,

netSalary,

status:"Active",

createdAt:

Timestamp.now(),

updatedAt:

Timestamp.now()


}

);



alert(

"Salary Saved"

);


}



resetForm();

loadSalary();



}


catch(error){


console.log(error);

alert(

"Salary Save Failed"

);


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


await deleteDoc(

doc(

db,

"salaryStructure",

id

)

);


alert(

"Salary Deleted"

);


loadSalary();


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







<BulkUpload

loadSalary={loadSalary}

/>








<hr className="
my-10
"/>





<h2 className="
text-3xl
font-bold
">

Payroll Management

</h2>







<PayrollDashboard

payrollList={payrollList}

/>






<PayrollProcess

salaryList={salaryList}

loadSalary={loadPayroll}

/>






<PayrollTable

payrollList={payrollList}

loadPayroll={loadPayroll}

/>






<PayrollExport

payrollList={payrollList}

/>





</div>

)


}