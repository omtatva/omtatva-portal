"use client";


export default function SalaryForm({

form,
setForm,
grossSalary,
saveSalary,
editId

})
{


const totalDeduction =

Number(form.pf || 0)+
Number(form.esi || 0)+
Number(form.professionalTax || 0)+
Number(form.tds || 0);



const netSalary =
grossSalary - totalDeduction;


const fields=[


{
label:"Basic Salary",
name:"basicSalary"
},

{
label:"HRA",
name:"hra"
},

{
label:"Special Allowance",
name:"specialAllowance"
},

{
label:"Medical Allowance",
name:"medical"
},

{
label:"Conveyance",
name:"conveyance"
},

{
label:"Food Allowance",
name:"foodAllowance"
},

{
label:"Internet Allowance",
name:"internetAllowance"
},


{
label:"PF",
name:"pf"
},

{
label:"ESI",
name:"esi"
},

{
label:"Professional Tax",
name:"professionalTax"
},

{
label:"TDS",
name:"tds"
}


];



const handleChange=(e)=>{


setForm({

...form,

[e.target.name]:e.target.value

});


};





return (

<div>


<h2 className="text-xl font-semibold mb-5">

Salary Details

</h2>




{/* Employee Information */}

<div className="grid grid-cols-2 gap-4 mb-6">


<div>

<label>
Employee ID
</label>


<input

value={form.employeeId}

readOnly

className="
border
p-3
rounded
w-full
bg-gray-100
"

/>

</div>



<div>

<label>
Employee Name
</label>


<input

value={form.employeeName}

readOnly

className="
border
p-3
rounded
w-full
bg-gray-100
"

/>

</div>




<div>

<label>
Department
</label>


<input

value={form.department}

readOnly

className="
border
p-3
rounded
w-full
bg-gray-100
"

/>

</div>



<div>

<label>
Designation
</label>


<input

value={form.designation}

readOnly

className="
border
p-3
rounded
w-full
bg-gray-100
"

/>

</div>


</div>

{/* Salary Month */}

<div>

<label className="block mb-1">
Salary Month
</label>


<input

type="month"

name="salaryMonth"

value={form.salaryMonth}

onChange={handleChange}

className="
border
p-3
rounded
w-full
"

/>

</div>



{/* Salary Fields */}


<div className="
grid
grid-cols-2
gap-4
">


{

fields.map((field)=>(


<div key={field.name}>


<label className="block mb-1">

{field.label}

</label>


<input

type="number"

name={field.name}

value={form[field.name]}

onChange={handleChange}

className="
border
p-3
rounded
w-full
"

/>


</div>


))


}


</div>





{/* Gross Salary */}


<div className="
mt-6
bg-green-50
p-5
rounded-xl
">


<p className="text-gray-600">

Gross Salary

</p>


<h1 className="
text-3xl
font-bold
text-green-700
">

₹ {grossSalary}

</h1>


</div>

<div className="
mt-4
bg-blue-50
p-5
rounded-xl
">


<p className="text-gray-600">

Net Salary

</p>


<h1 className="
text-3xl
font-bold
text-blue-700
">

₹ {netSalary}

</h1>


</div>



<button

onClick={saveSalary}

className="
mt-6
bg-blue-600
text-white
px-8
py-3
rounded-lg
"

>


{

editId

?

"Update Salary"

:

"Save Salary"

}


</button>



</div>

)

}