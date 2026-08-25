"use client";

import { useState } from "react";

import * as XLSX from "xlsx";

import {
collection,
getDocs,
addDoc,
updateDoc,
doc,
query,
where,
Timestamp
} from "firebase/firestore";


import { db } from "@/lib/firebase";



export default function BulkUpload({

loadSalary,
canEdit = true

}){


const [file,setFile]=useState(null);

const [uploading,setUploading]=useState(false);

const [result,setResult]=useState(null);





const uploadExcel=async()=>{

if(!canEdit){
alert("View only — you don't have edit access for Salary Structure");
return;
}


if(!file){

alert(
"Please select Excel file"
);

return;

}



try{


setUploading(true);



const data = await file.arrayBuffer();



const workbook = XLSX.read(

data

);



const sheetName =

workbook.SheetNames[0];



const worksheet =

workbook.Sheets[sheetName];



const rows =

XLSX.utils.sheet_to_json(

worksheet

);





let success=0;

let failed=0;






for(const row of rows){



try{



if(!row.Employee_ID){

failed++;

continue;

}






const empQuery=query(

collection(db,"salaryStructure"),

where(

"employeeId",

"==",

String(row.Employee_ID)

)

);



const existing=

await getDocs(empQuery);






const salaryData={


employeeId:

String(row.Employee_ID),



employeeName:

row.Employee_Name || "",



department:

row.Department || "",



designation:

row.Designation || "",




basicSalary:

Number(row.Basic_Salary || 0),



hra:

Number(row.HRA || 0),



specialAllowance:

Number(row.Special_Allowance || 0),



medical:

Number(row.Medical || 0),



conveyance:

Number(row.Conveyance || 0),



foodAllowance:

Number(row.Food_Allowance || 0),



internetAllowance:

Number(row.Internet_Allowance || 0),




pf:

Number(row.PF || 0),



esi:

Number(row.ESI || 0),



professionalTax:

Number(row.Professional_Tax || 0),



tds:

Number(row.TDS || 0),




grossSalary:


Number(row.Basic_Salary || 0)

+

Number(row.HRA || 0)

+

Number(row.Special_Allowance || 0)

+

Number(row.Medical || 0)

+

Number(row.Conveyance || 0)

+

Number(row.Food_Allowance || 0)

+

Number(row.Internet_Allowance || 0),




status:"Active",

updatedAt:

Timestamp.now()


};







if(!existing.empty){



await updateDoc(

doc(

db,

"salaryStructure",

existing.docs[0].id

),

salaryData

);



}

else{



await addDoc(

collection(db,"salaryStructure"),

{

...salaryData,

createdAt:

Timestamp.now()

}

);



}



success++;


}

catch(err){


console.log(err);

failed++;


}


}






setResult({

success,

failed

});




if(loadSalary){

loadSalary();

}




}

catch(error){


console.log(error);


alert(
"Upload Failed"
);


}


finally{


setUploading(false);


}


};






return(


<div className="
bg-white
rounded-xl
shadow
p-5
mt-8
">


<h2 className="
text-xl
font-bold
mb-4
">

Bulk Salary Upload

</h2>




<p className="
text-gray-500
mb-4
">

Upload employee salary Excel sheet

</p>





<input

type="file"

accept=".xlsx,.xls"

onChange={(e)=>

setFile(e.target.files[0])

}

className="
border
p-3
rounded-lg
"

/>







<button

onClick={uploadExcel}

disabled={uploading}

className="
ml-4
bg-blue-600
text-white
px-6
py-3
rounded-lg
"

>


{

uploading

?

"Uploading..."

:

"Upload Salary Sheet"

}


</button>







{

result &&

<div className="
mt-5
bg-gray-100
p-4
rounded-lg
">


<p>

✅ Successful:

{result.success}

</p>


<p>

❌ Failed:

{result.failed}

</p>


</div>


}





</div>


)

}