"use client";


export default function EmployeeSearch({

employees=[],
search,
setSearch,
setSelectedEmployee

}){


const filteredEmployees =
employees.filter((emp)=>


emp.employeeName
?.toLowerCase()
.includes(search.toLowerCase())

);



return (

<div>


<input

type="text"

placeholder="Search Employee..."

value={search}

onChange={(e)=>setSearch(e.target.value)}

className="
w-full
border
rounded-lg
p-3
outline-none
focus:ring-2
focus:ring-blue-500
"

/>



{
search &&

<div
className="
mt-2
border
rounded-lg
bg-white
shadow
max-h-60
overflow-y-auto
"
>


{
filteredEmployees.length > 0 ?


filteredEmployees.map((emp)=>(


<div

key={emp.employeeId}

onClick={()=>{

setSelectedEmployee(emp);

setSearch(emp.employeeName);

}}

className="
p-3
cursor-pointer
hover:bg-gray-100
border-b
"

>


<div className="font-semibold">

{emp.employeeName}

</div>


<div className="text-sm text-gray-500">

{emp.department} | {emp.designation}

</div>


</div>


))


:


<div className="p-3 text-gray-500">

No employee found

</div>


}


</div>

}


</div>

)

}