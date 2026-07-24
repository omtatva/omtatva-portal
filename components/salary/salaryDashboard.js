"use client";

export default function SalaryDashboard({
    employees = [],
    salaryList = []
}) {


const cards = [
    {
        title:"Total Employees",
        value:employees.length,
        icon:"👥"
    },

    {
        title:"Salary Structures",
        value:salaryList.length,
        icon:"💰"
    },

    {
        title:"Pending Setup",
        value:
        employees.length - salaryList.length > 0
        ?
        employees.length - salaryList.length
        :
        0,
        icon:"⏳"
    },

    {
        title:"Average Salary",
        value:"₹0",
        icon:"📊"
    }

];


return (

<div className="grid grid-cols-1 md:grid-cols-4 gap-5">


{
cards.map((card,index)=>(

<div
key={index}
className="
bg-white
rounded-xl
shadow-sm
border
p-5
hover:shadow-md
transition
"
>


<div className="flex justify-between items-center">


<div>

<p className="text-gray-500 text-sm">
{card.title}
</p>


<h2 className="text-2xl font-bold mt-2">
{card.value}
</h2>

</div>


<div className="text-3xl">
{card.icon}
</div>


</div>


</div>

))

}


</div>

)

}