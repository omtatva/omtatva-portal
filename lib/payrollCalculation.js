export function calculatePayroll({

basicSalary,

attendance,

grossSalary

}){


const totalDays=30;


// Demo/generated attendance (isDemo: true, test project only) must never
// affect pay — real records only.
const records=(attendance||[]).filter(a=>a.isDemo!==true);


const presentDays =
records.filter(
a=>a.status==="Present"
).length;



const leaveDays =
records.filter(
a=>a.status==="Leave"
).length;



const absentDays =
records.filter(
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