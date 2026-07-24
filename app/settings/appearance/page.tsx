"use client";

import { useState } from "react";
import { appSettings, updateAppSettings } from "@/config/appSettings";
import {
  Palette,
  Moon,
  Sun,
  Sidebar,
  LayoutDashboard,
} from "lucide-react";


export default function AppearancePage() {

  const [theme, setTheme] = useState(appSettings.theme);

  const [primary, setPrimary] = useState(
    appSettings.colors.primary
  );

  const [sidebar, setSidebar] = useState(
    appSettings.colors.sidebar
  );

  const [background, setBackground] = useState(
    appSettings.colors.background
  );


  function saveSettings(){

    updateAppSettings({
      theme,

      colors:{
        primary,
        sidebar,
        background,
      }
    });

    alert("Appearance Saved");

  }



return (

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
fontWeight:700,
marginBottom:"8px"
}}
>
🎨 Appearance
</h1>


<p
style={{
color:"#64748B",
marginBottom:"30px"
}}
>
Customize your dashboard look and feel
</p>




<div
style={{
display:"grid",
gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))",
gap:"25px"
}}
>



{/* Theme Card */}

<Card
icon={<Palette/>}
title="Theme Mode"
>

<div
style={{
display:"flex",
gap:15
}}
>


<button
onClick={()=>setTheme("light")}
style={themeBtn(theme==="light")}
>

<Sun size={20}/>
Light

</button>



<button
onClick={()=>setTheme("dark")}
style={themeBtn(theme==="dark")}
>

<Moon size={20}/>
Dark

</button>


</div>

</Card>





{/* Colors */}

<Card
icon={<Palette/>}
title="Brand Colors"
>


<ColorPicker
title="Primary Color"
value={primary}
setValue={setPrimary}
/>


<ColorPicker
title="Sidebar Color"
value={sidebar}
setValue={setSidebar}
/>


<ColorPicker
title="Background Color"
value={background}
setValue={setBackground}
/>



</Card>





{/* Preview */}

<Card
icon={<LayoutDashboard/>}
title="Live Preview"
>


<div
style={{
height:180,
borderRadius:15,
overflow:"hidden",
border:"1px solid #ddd",
background
}}
>


<div
style={{
height:45,
background:sidebar,
display:"flex",
alignItems:"center",
padding:"0 15px",
fontWeight:700
}}
>

OMTATVA DIGITALS

</div>



<div
style={{
padding:20
}}
>


<div
style={{
background:primary,
height:35,
borderRadius:8,
width:"60%"
}}
/>


</div>


</div>


</Card>



</div>




<button

onClick={saveSettings}

style={{
marginTop:30,
background:primary,
color:"#fff",
padding:"14px 35px",
borderRadius:12,
border:"none",
fontSize:16,
fontWeight:600,
cursor:"pointer"
}}

>

Save Changes

</button>



</div>

)

}





function Card({
icon,
title,
children
}:any){

return(

<div
style={{
background:"#fff",
borderRadius:18,
padding:25,
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




function ColorPicker({
  title,
  value,
  setValue
}:any){

return(

<div
style={{
display:"flex",
justifyContent:"space-between",
alignItems:"center",
marginBottom:18,
gap:15
}}
>

<span
style={{
fontWeight:500
}}
>
{title}
</span>


<div
style={{
display:"flex",
alignItems:"center",
gap:10
}}
>


<input

type="color"

value={value}

onChange={(e)=>setValue(e.target.value)}

style={{
width:45,
height:35,
border:"none",
cursor:"pointer"
}}

/>


<input

type="text"

value={value}

onChange={(e)=>{

const val=e.target.value;

setValue(val);

}}

placeholder="#2563EB"

style={{
width:100,
padding:"8px",
border:"1px solid #ddd",
borderRadius:8,
fontSize:14,
textTransform:"uppercase"
}}

/>


</div>


</div>

)

}




function themeBtn(active:boolean){

return{

flex:1,

display:"flex",

alignItems:"center",

justifyContent:"center",

gap:8,

padding:"12px",

borderRadius:12,

border:active
?"2px solid #2563EB"
:"1px solid #ddd",

background:"#fff",

cursor:"pointer",

fontWeight:600

}

}