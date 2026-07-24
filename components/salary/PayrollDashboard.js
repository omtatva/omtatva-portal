"use client";


export default function PayrollDashboard({

payrollList=[]

}){


const totalPayroll = payrollList.reduce(

(total,item)=>

total + Number(item.netSalary || 0),

0

);



const paidPayroll = payrollList.filter(

item=>

item.status==="Paid"

)
.reduce(

(total,item)=>

total + Number(item.netSalary || 0),

0

);



const pendingPayroll = payrollList.filter(

item=>

item.status==="Pending"

)
.reduce(

(total,item)=>

total + Number(item.netSalary || 0),

0

);





const cards=[

{
title:"Total Payroll",
value:`₹ ${totalPayroll}`
},

{
title:"Paid Salary",
value:`₹ ${paidPayroll}`
},

{
title:"Pending Salary",
value:`₹ ${pendingPayroll}`
},

{
title:"Employees",
value:payrollList.length
}

];





return(

<div className="
grid
grid-cols-4
gap-5
mt-6
">


{

cards.map((card,index)=>(


<div

key={index}

className="
bg-white
rounded-xl
shadow
p-5
"


>


<h3 className="
text-gray-500
">

{card.title}

</h3>


<p className="
text-2xl
font-bold
mt-3
">

{card.value}

</p>


</div>


))


}


</div>


)

}