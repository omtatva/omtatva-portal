"use client";

import {useState} from "react";


export default function AttendanceCalendar({
history
}){


const [calendarDate,setCalendarDate]=useState(
new Date()
);


const [showPicker,setShowPicker]=useState(false);



const months=[
"January",
"February",
"March",
"April",
"May",
"June",
"July",
"August",
"September",
"October",
"November",
"December"
];



const years=[];

for(let y=2020;y<=2035;y++){
years.push(y);
}



function changeMonth(value){

const d=new Date(calendarDate);

d.setMonth(
d.getMonth()+value
);

setCalendarDate(d);

}



function selectMonth(month){

const d=new Date(calendarDate);

d.setMonth(month);

setCalendarDate(d);

setShowPicker(false);

}



function selectYear(year){

const d=new Date(calendarDate);

d.setFullYear(year);

setCalendarDate(d);

}




function daysInMonth(){

return new Date(
calendarDate.getFullYear(),
calendarDate.getMonth()+1,
0
).getDate();

}



function firstDay(){

return new Date(
calendarDate.getFullYear(),
calendarDate.getMonth(),
1
).getDay();

}



function getStatus(day){


const date =
`${calendarDate.getFullYear()}-${String(calendarDate.getMonth()+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;


return history.find(
item=>item.date===date
);


}




return (

<div className="
bg-white
rounded-3xl
p-7
border
border-[#eaf3ff]
shadow-sm
">


<div className="
flex
justify-between
items-center
mb-6
">


<button
onClick={()=>changeMonth(-1)}
className="
text-[#3d6fa8]
text-2xl
"
>
‹
</button>




<button

onClick={()=>setShowPicker(!showPicker)}

className="
font-bold
text-xl
text-[#111]
hover:text-[#3d6fa8]
"
>

{
months[calendarDate.getMonth()]
}

{" "}

{calendarDate.getFullYear()}

</button>




<button
onClick={()=>changeMonth(1)}
className="
text-[#3d6fa8]
text-2xl
"
>
›
</button>


</div>





{
showPicker &&

<div className="
bg-[#eaf3ff]
rounded-2xl
p-5
mb-6
">


<h3 className="
font-bold
mb-3
">
Select Month
</h3>



<div className="
grid
grid-cols-3
gap-2
mb-5
">


{
months.map((m,index)=>(

<button

key={m}

onClick={()=>selectMonth(index)}

className={`
p-2
rounded-lg
text-sm

${
calendarDate.getMonth()===index

?

"bg-[#3d6fa8] text-white"

:

"bg-white text-[#111]"
}

`}

>

{m.substring(0,3)}

</button>

))

}


</div>





<h3 className="
font-bold
mb-3
">
Select Year
</h3>



<div className="
grid
grid-cols-5
gap-2
">


{
years.map(y=>(

<button

key={y}

onClick={()=>selectYear(y)}

className={`
p-2
rounded-lg

${
calendarDate.getFullYear()===y

?

"bg-[#3d6fa8] text-white"

:

"bg-white"
}

`}
>

{y}

</button>


))

}


</div>


</div>

}




<div className="
grid
grid-cols-7
text-center
mb-3
">


{
[
"Sun",
"Mon",
"Tue",
"Wed",
"Thu",
"Fri",
"Sat"
]
.map(day=>(

<div
key={day}
className="
text-sm
font-semibold
text-[#444]
"
>

{day}

</div>

))

}


</div>






<div className="
grid
grid-cols-7
gap-3
">


{
Array.from({
length:firstDay()
})
.map((_,i)=>(

<div key={i}/>

))
}






{
Array.from({
length:daysInMonth()
},
(_,i)=>i+1
)
.map(day=>{


const data=getStatus(day);



return(

<div

key={day}

className={`
h-11
rounded-xl
flex
items-center
justify-center
font-semibold
cursor-pointer

${
data?.status==="Present"

?

"bg-green-100 text-green-700"

:

data?.status==="Late"

?

"bg-yellow-100 text-yellow-700"

:

"bg-[#eaf3ff] text-[#3d6fa8]"

}

`}

>


{day}


</div>


)

})

}


</div>


</div>


)

}