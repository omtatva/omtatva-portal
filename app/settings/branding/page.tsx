"use client";

import { useState } from "react";
import { appSettings, updateAppSettings } from "@/config/appSettings";
import {
  Building2,
  Image,
  Upload,
} from "lucide-react";


export default function BrandingPage(){

const [companyName,setCompanyName] =
useState(
appSettings.branding.companyName
);


const [logo,setLogo] =
useState(
appSettings.branding.logo
);


const [loginImage,setLoginImage] =
useState(
appSettings.branding.loginImage
);


const [background,setBackground] =
useState(
appSettings.branding.backgroundImage
);



function save(){

updateAppSettings({

branding:{
companyName,
logo,
loginImage,
backgroundImage:background
}

});


alert("Branding Updated");

}



return(

<div
style={{
padding:"30px",
background:"#f8fbff",
minHeight:"100vh"
}}
>


<h1
style={{
fontSize:"30px",
fontWeight:700
}}
>
🏢 Branding
</h1>


<p
style={{
color:"#64748B",
marginBottom:30
}}
>
Manage your company identity and visuals
</p>




<div
style={{
display:"grid",
gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))",
gap:25
}}
>




<Card
title="Company Identity"
icon={<Building2/>}
>


<label>
Company Name
</label>


<input

value={companyName}

onChange={(e)=>setCompanyName(e.target.value)}

style={input}

/>



<label>
Company Logo URL
</label>


<input

value={logo}

onChange={(e)=>setLogo(e.target.value)}

placeholder="Paste logo URL"

style={input}

/>


{
logo &&

<img

src={logo}

style={{
width:100,
height:100,
objectFit:"contain",
marginTop:15,
borderRadius:12
}}

/>

}



</Card>





<Card
title="Login Page"
icon={<Image/>}
>


<label>
Login Background Image URL
</label>


<input

value={loginImage}

onChange={(e)=>setLoginImage(e.target.value)}

placeholder="Login image URL"

style={input}

/>


{
loginImage &&

<img

src={loginImage}

style={{
width:"100%",
height:120,
objectFit:"cover",
borderRadius:12
}}

/>

}


</Card>





<Card
title="Dashboard Banner"
icon={<Image/>}
>


<label>
Dashboard Background Image URL
</label>


<input

value={background}

onChange={(e)=>setBackground(e.target.value)}

placeholder="Dashboard banner URL"

style={input}

/>


{
background &&

<img

src={background}

style={{
width:"100%",
height:120,
objectFit:"cover",
borderRadius:12
}}

/>

}


</Card>




</div>





<button

onClick={save}

style={{
marginTop:30,
background:"#2563EB",
color:"#fff",
padding:"14px 35px",
borderRadius:12,
border:"none",
fontSize:16,
fontWeight:600,
cursor:"pointer"
}}

>

Save Branding

</button>



</div>

)

}





function Card({
title,
icon,
children
}:any){

return(

<div
style={{
background:"#fff",
padding:25,
borderRadius:18,
boxShadow:"0 8px 25px rgba(0,0,0,.05)"
}}
>

<div
style={{
display:"flex",
alignItems:"center",
gap:10,
fontSize:18,
fontWeight:700,
marginBottom:20
}}
>

{icon}

{title}

</div>


{children}

</div>

)

}




const input={

width:"100%",

padding:"12px",

margin:"10px 0 20px",

border:"1px solid #ddd",

borderRadius:10

};