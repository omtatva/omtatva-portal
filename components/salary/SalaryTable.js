"use client";

import { useState } from "react";


export default function SalaryTable({

salaryList=[],

editSalary,

deleteSalary

}){


const [search,setSearch]=useState("");

const [department,setDepartment]=useState("");

const [viewSalary,setViewSalary]=useState(null);




const departments=[

...new Set(

salaryList.map(

item=>item.department

)

)

];





const filteredSalary = salaryList.filter(item=>{


const searchMatch =

item.employeeName

?.toLowerCase()

.includes(

search.toLowerCase()

)

||

item.employeeId

?.toLowerCase()

.includes(

search.toLowerCase()

);




const deptMatch =

department

?

item.department===department

:

true;




return searchMatch && deptMatch;


});





return(


<div className="
bg-white
rounded-xl
shadow
p-6
mt-8
">


<h2 className="
text-2xl
font-bold
mb-5
">

Salary Structure List

</h2>





<div className="
flex
gap-4
mb-6
">


<input

placeholder="Search Employee..."

value={search}

onChange={(e)=>

setSearch(e.target.value)

}

className="
border
p-3
rounded-lg
flex-1
"

/>





<select

value={department}

onChange={(e)=>

setDepartment(e.target.value)

}

className="
border
p-3
rounded-lg
"


>


<option value="">

All Departments

</option>



{

departments.map(dep=>(


<option

key={dep}

value={dep}

>

{dep}

</option>


))


}


</select>



</div>






<div className="
overflow-x-auto
">


<table className="
w-full
border-collapse
">


<thead>


<tr className="bg-gray-100">


<th className="p-3 text-left">
Employee
</th>


<th className="p-3 text-left">
Department
</th>


<th className="p-3 text-left">
Designation
</th>


<th className="p-3 text-left">
Gross Salary
</th>


<th className="p-3 text-left">
Actions
</th>


</tr>


</thead>






<tbody>


{

filteredSalary.length===0 ?


<tr>

<td

colSpan="5"

className="
text-center
p-6
"

>

No Salary Records

</td>

</tr>





:

filteredSalary.map(item=>(


<tr

key={item.id}

className="
border-b
"


>



<td className="p-3">


<div className="font-semibold">

{item.employeeName}

</div>


<div className="text-sm text-gray-500">

{item.employeeId}

</div>


</td>




<td className="p-3">

{item.department}

</td>




<td className="p-3">

{item.designation}

</td>





<td className="
p-3
font-bold
text-green-600
">

₹ {

Number(

item.grossSalary || 0

).toLocaleString()

}

</td>





<td className="p-3">


<button

onClick={()=>setViewSalary(item)}

className="
bg-gray-700
text-white
px-3
py-2
rounded-lg
mr-2
"

>

View

</button>





<button

onClick={()=>editSalary(item)}

className="
bg-blue-600
text-white
px-3
py-2
rounded-lg
mr-2
"

>

Edit

</button>






<button

onClick={()=>{


const confirmDelete=

window.confirm(

"Delete this salary structure?"

);



if(confirmDelete){

deleteSalary(item.id);

}


}}

className="
bg-red-600
text-white
px-3
py-2
rounded-lg
"

>

Delete

</button>



</td>





</tr>


))


}


</tbody>


</table>


</div>









{

viewSalary &&

<div className="
fixed
inset-0
bg-black/40
flex
items-center
justify-center
">


<div className="
bg-white
rounded-xl
p-6
w-[500px]
">


<h2 className="
text-xl
font-bold
mb-5
">

Salary Breakup

</h2>




<p>
Employee:
<b>
{viewSalary.employeeName}
</b>
</p>


<p>
Basic:
₹ {viewSalary.basicSalary}
</p>


<p>
HRA:
₹ {viewSalary.hra}
</p>


<p>
Special Allowance:
₹ {viewSalary.specialAllowance}
</p>


<p>
Medical:
₹ {viewSalary.medical}
</p>


<p>
Conveyance:
₹ {viewSalary.conveyance}
</p>



<hr className="my-4"/>



<h3 className="
text-xl
font-bold
text-green-600
">

Gross Salary:

₹ {

Number(

viewSalary.grossSalary || 0

).toLocaleString()

}

</h3>




<button

onClick={()=>setViewSalary(null)}

className="
mt-5
bg-blue-600
text-white
px-5
py-2
rounded-lg
"

>

Close

</button>



</div>


</div>


}



</div>


)

}