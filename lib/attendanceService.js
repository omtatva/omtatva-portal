import {
collection,
getDocs,
query,
where
} from "firebase/firestore";

import {db} from "./firebase";



export async function getEmployeeAttendance(
employeeId,
month
){


const q=query(

collection(db,"attendance"),

where(
"employeeId",
"==",
employeeId
)

);



const snapshot=await getDocs(q);


const records=snapshot.docs.map(doc=>({

id:doc.id,

...doc.data()

}));



return records.filter(item=>

item.date.startsWith(month)

);


}