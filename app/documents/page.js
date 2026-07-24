"use client";

import { useEffect, useState } from "react";
import { auth, db } from "../../lib/firebase";

import {
collection,
query,
where,
onSnapshot
} from "firebase/firestore";


export default function DocumentsPage(){

const [documents,setDocuments] = useState([]);


useEffect(()=>{

const unsubscribeAuth = auth.onAuthStateChanged((user)=>{

if(!user) return;


const q=query(
collection(db,"documents"),
where(
"employeeEmail",
"==",
user.email
)
);


const unsubscribe = onSnapshot(q,(snapshot)=>{


const list=snapshot.docs.map(doc=>({

id:doc.id,
...doc.data()

}));


setDocuments(list);


});


return ()=>unsubscribe();


});


return ()=>unsubscribeAuth();


},[]);



const payroll = documents.filter(
d=>d.category==="Payroll"
);


const creative = documents.filter(
d=>d.category==="Creative Script"
);


const office = documents.filter(
d=>d.category==="Office Documents"
);


const offer = documents.filter(
d=>d.category==="Offer Letter"
);



return(

<div
style={{
padding:"25px",
background:"#f5f7fb",
minHeight:"100vh"
}}
>


<h1
style={{
fontSize:"36px",
fontWeight:"800",
color:"#1e3a8a"
}}
>
📁 My Documents
</h1>



<DocumentSection
title="💰 Payroll Documents"
data={payroll}
/>



<DocumentSection
title="🎬 Script Documents"
data={creative}
/>



<DocumentSection
title="🏢 Office Complete Documents"
data={office}
/>



<DocumentSection
title="✉ Offer Letter"
data={offer}
/>



</div>

)

}




function DocumentSection({
title,
data=[]
}){


return(

<div
style={{
background:"#fff",
padding:"25px",
borderRadius:"20px",
marginBottom:"25px",
boxShadow:"0 10px 25px rgba(0,0,0,.08)"
}}
>


<h2
style={{
fontSize:"24px",
fontWeight:800,
marginBottom:"20px"
}}
>

{title}

</h2>



{
data.length===0 ?

<p>
No Documents Available
</p>


:


data.map(item=>(

<div
key={item.id}
style={{
display:"flex",
justifyContent:"space-between",
alignItems:"center",
padding:"15px",
borderBottom:"1px solid #eee"
}}
>


<div>

<h3>
{item.fileName || item.title}
</h3>


<p>
Uploaded By: {item.uploadedBy || "HR"}
</p>

</div>



<div
style={{
display:"flex",
gap:"10px"
}}
>


<a
href={item.url}
target="_blank"
style={viewBtn}
>
👁 View
</a>



<a
href={item.url}
download
style={downloadBtn}
>
⬇ Download
</a>


</div>


</div>


))


}


</div>

)

}




const viewBtn={

background:"#2563eb",
color:"#fff",
padding:"10px 18px",
borderRadius:"8px",
textDecoration:"none",
fontWeight:"600"

};


const downloadBtn={

background:"#16a34a",
color:"#fff",
padding:"10px 18px",
borderRadius:"8px",
textDecoration:"none",
fontWeight:"600"

};