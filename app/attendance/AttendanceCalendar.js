"use client";

import { useState } from "react";

export default function AttendanceCalendar({ history, holidayDates = new Set() }) {
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const years = [];
  for (let y = 2020; y <= 2035; y++) {
    years.push(y);
  }

  function changeMonth(value) {
    const d = new Date(calendarDate);
    d.setMonth(d.getMonth() + value);
    setCalendarDate(d);
  }

  function selectMonth(month) {
    const d = new Date(calendarDate);
    d.setMonth(month);
    setCalendarDate(d);
    setShowPicker(false);
  }

  function selectYear(year) {
    const d = new Date(calendarDate);
    d.setFullYear(year);
    setCalendarDate(d);
  }

  function daysInMonth() {
    return new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0).getDate();
  }

  function firstDay() {
    return new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1).getDay();
  }

  function getStatus(day) {
    const date = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return history.find((item) => item.date === date);
  }

  function getDateString(day) {
    return `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function isHoliday(dateStr) {
    return holidayDates.has(dateStr);
  }

  // Colors are keyed off displayStatus (Present / Late / Absent /
  // Incomplete), which AttendancePage.js computes per-record — NOT
  // the raw Firestore "status" field (which is only ever "Present" or
  // "Absent"; "Late" and "Incomplete" are derived, computed labels,
  // not something stored directly).
  // Holidays take priority over everything else — a holiday day should
  // never show as red/absent even if no attendance record exists.
  function dayColorClass(data, dateStr) {
    if (isHoliday(dateStr)) {
      return "bg-purple-100 text-purple-700";
    }

    if (!data) {
      // No record — either a future day, a weekend, or a day before
      // sync has run. Neutral color, not treated as absent.
      return "bg-[#eaf3ff] text-[#3d6fa8]";
    }

    if (data.displayStatus === "Absent") {
      return "bg-red-100 text-red-700";
    }

    if (data.displayStatus === "Late") {
      return "bg-yellow-100 text-yellow-700";
    }

    if (data.displayStatus === "Incomplete") {
      return "bg-orange-100 text-orange-700";
    }

    // Present (or any other known-good status)
    return "bg-green-100 text-green-700";
  }

  return (
    <div className="bg-white rounded-3xl p-4 sm:p-7 border border-[#eaf3ff] shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={() => changeMonth(-1)}
          className="text-[#3d6fa8] text-2xl px-3 py-1 rounded-lg hover:bg-[#eaf3ff] active:scale-95 transition"
        >
          ‹
        </button>

        <button
          onClick={() => setShowPicker(!showPicker)}
          className="font-bold text-base sm:text-lg lg:text-xl text-[#111] hover:text-[#3d6fa8] px-2"
        >
          {months[calendarDate.getMonth()]} {calendarDate.getFullYear()}
        </button>

        <button
          onClick={() => changeMonth(1)}
          className="text-[#3d6fa8] text-2xl px-3 py-1 rounded-lg hover:bg-[#eaf3ff] active:scale-95 transition"
        >
          ›
        </button>
      </div>

      {showPicker && (
        <div className="bg-[#eaf3ff] rounded-2xl p-4 sm:p-5 mb-6">
          <h3 className="font-bold mb-3 text-sm sm:text-base">Select Month</h3>

          <div className="grid grid-cols-3 gap-2 mb-5">
            {months.map((m, index) => (
              <button
                key={m}
                onClick={() => selectMonth(index)}
                className={`p-2 rounded-lg text-xs sm:text-sm ${
                  calendarDate.getMonth() === index
                    ? "bg-[#3d6fa8] text-white"
                    : "bg-white text-[#111]"
                }`}
              >
                {m.substring(0, 3)}
              </button>
            ))}
          </div>

          <h3 className="font-bold mb-3 text-sm sm:text-base">Select Year</h3>

          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-40 overflow-y-auto">
            {years.map((y) => (
              <button
                key={y}
                onClick={() => selectYear(y)}
                className={`p-2 rounded-lg text-xs sm:text-sm ${
                  calendarDate.getFullYear() === y ? "bg-[#3d6fa8] text-white" : "bg-white"
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-7 text-center mb-3">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="text-[10px] sm:text-sm font-semibold text-[#444]">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5 sm:gap-3">
        {Array.from({ length: firstDay() }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}

        {Array.from({ length: daysInMonth() }, (_, i) => i + 1).map((day) => {
          const dateStr = getDateString(day);
          const data = getStatus(day);
          const holiday = isHoliday(dateStr);

          return (
            <div
              key={day}
              className={`h-8 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center font-semibold text-xs sm:text-base cursor-pointer ${dayColorClass(
                data,
                dateStr
              )}`}
              title={holiday ? "Holiday" : data?.displayStatus || ""}
            >
              {day}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-3 sm:gap-4 flex-wrap mt-5 text-[11px] sm:text-sm">
        <span className="flex items-center gap-1.5 sm:gap-2">
          <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-green-200 inline-block" /> Present
        </span>
        <span className="flex items-center gap-1.5 sm:gap-2">
          <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-yellow-200 inline-block" /> Late
        </span>
        <span className="flex items-center gap-1.5 sm:gap-2">
          <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-orange-200 inline-block" /> Incomplete
        </span>
        <span className="flex items-center gap-1.5 sm:gap-2">
          <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-200 inline-block" /> Absent
        </span>
        <span className="flex items-center gap-1.5 sm:gap-2">
          <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-purple-200 inline-block" /> Holiday
        </span>
      </div>
    </div>
  );
}

// "use client";

// import {useState} from "react";


// export default function AttendanceCalendar({
// history
// }){


// const [calendarDate,setCalendarDate]=useState(
// new Date()
// );


// const [showPicker,setShowPicker]=useState(false);



// const months=[
// "January",
// "February",
// "March",
// "April",
// "May",
// "June",
// "July",
// "August",
// "September",
// "October",
// "November",
// "December"
// ];



// const years=[];

// for(let y=2020;y<=2035;y++){
// years.push(y);
// }



// function changeMonth(value){

// const d=new Date(calendarDate);

// d.setMonth(
// d.getMonth()+value
// );

// setCalendarDate(d);

// }



// function selectMonth(month){

// const d=new Date(calendarDate);

// d.setMonth(month);

// setCalendarDate(d);

// setShowPicker(false);

// }



// function selectYear(year){

// const d=new Date(calendarDate);

// d.setFullYear(year);

// setCalendarDate(d);

// }




// function daysInMonth(){

// return new Date(
// calendarDate.getFullYear(),
// calendarDate.getMonth()+1,
// 0
// ).getDate();

// }



// function firstDay(){

// return new Date(
// calendarDate.getFullYear(),
// calendarDate.getMonth(),
// 1
// ).getDay();

// }



// function getStatus(day){


// const date =
// `${calendarDate.getFullYear()}-${String(calendarDate.getMonth()+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;


// return history.find(
// item=>item.date===date
// );


// }




// return (

// <div className="
// bg-white
// rounded-3xl
// p-7
// border
// border-[#eaf3ff]
// shadow-sm
// ">


// <div className="
// flex
// justify-between
// items-center
// mb-6
// ">


// <button
// onClick={()=>changeMonth(-1)}
// className="
// text-[#3d6fa8]
// text-2xl
// "
// >
// ‹
// </button>




// <button

// onClick={()=>setShowPicker(!showPicker)}

// className="
// font-bold
// text-xl
// text-[#111]
// hover:text-[#3d6fa8]
// "
// >

// {
// months[calendarDate.getMonth()]
// }

// {" "}

// {calendarDate.getFullYear()}

// </button>




// <button
// onClick={()=>changeMonth(1)}
// className="
// text-[#3d6fa8]
// text-2xl
// "
// >
// ›
// </button>


// </div>





// {
// showPicker &&

// <div className="
// bg-[#eaf3ff]
// rounded-2xl
// p-5
// mb-6
// ">


// <h3 className="
// font-bold
// mb-3
// ">
// Select Month
// </h3>



// <div className="
// grid
// grid-cols-3
// gap-2
// mb-5
// ">


// {
// months.map((m,index)=>(

// <button

// key={m}

// onClick={()=>selectMonth(index)}

// className={`
// p-2
// rounded-lg
// text-sm

// ${
// calendarDate.getMonth()===index

// ?

// "bg-[#3d6fa8] text-white"

// :

// "bg-white text-[#111]"
// }

// `}

// >

// {m.substring(0,3)}

// </button>

// ))

// }


// </div>





// <h3 className="
// font-bold
// mb-3
// ">
// Select Year
// </h3>



// <div className="
// grid
// grid-cols-5
// gap-2
// ">


// {
// years.map(y=>(

// <button

// key={y}

// onClick={()=>selectYear(y)}

// className={`
// p-2
// rounded-lg

// ${
// calendarDate.getFullYear()===y

// ?

// "bg-[#3d6fa8] text-white"

// :

// "bg-white"
// }

// `}
// >

// {y}

// </button>


// ))

// }


// </div>


// </div>

// }




// <div className="
// grid
// grid-cols-7
// text-center
// mb-3
// ">


// {
// [
// "Sun",
// "Mon",
// "Tue",
// "Wed",
// "Thu",
// "Fri",
// "Sat"
// ]
// .map(day=>(

// <div
// key={day}
// className="
// text-sm
// font-semibold
// text-[#444]
// "
// >

// {day}

// </div>

// ))

// }


// </div>






// <div className="
// grid
// grid-cols-7
// gap-3
// ">


// {
// Array.from({
// length:firstDay()
// })
// .map((_,i)=>(

// <div key={i}/>

// ))
// }






// {
// Array.from({
// length:daysInMonth()
// },
// (_,i)=>i+1
// )
// .map(day=>{


// const data=getStatus(day);



// return(

// <div

// key={day}

// className={`
// h-11
// rounded-xl
// flex
// items-center
// justify-center
// font-semibold
// cursor-pointer

// ${
// data?.status==="Present"

// ?

// "bg-green-100 text-green-700"

// :

// data?.status==="Late"

// ?

// "bg-yellow-100 text-yellow-700"

// :

// "bg-[#eaf3ff] text-[#3d6fa8]"

// }

// `}

// >


// {day}


// </div>


// )

// })

// }


// </div>


// </div>


// )

// }