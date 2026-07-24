export function calculatePayroll({

basicSalary,

attendance,

grossSalary

}){


const totalDays=30;


const presentDays =
attendance.filter(
a=>a.status==="Present"
).length;



const leaveDays =
attendance.filter(
a=>a.status==="Leave"
).length;



const absentDays =
attendance.filter(
a=>a.status==="Absent"
).length;




// Per day salary

const perDaySalary =
Number(basicSalary)/totalDays;




// Loss of Pay

const lopDeduction =
absentDays * perDaySalary;




const finalSalary =
Number(grossSalary)
-
lopDeduction;



return {


presentDays,

leaveDays,

absentDays,


lopDeduction,


netSalary:
Math.round(finalSalary)


};


}