"use client";

import { useState } from "react";
import { appSettings, updateAppSettings } from "@/config/appSettings";
import {
  Video,
  Image,
  Play,
} from "lucide-react";


export default function MediaPage(){


const [welcomeVideo,setWelcomeVideo] =
useState(
appSettings.media.welcomeVideo
);


const [announcementVideo,setAnnouncementVideo] =
useState(
appSettings.media.announcementVideo
);


const [banner,setBanner] =
useState(
appSettings.media.bannerImage || ""
);



function save(){

updateAppSettings({

media:{
welcomeVideo,
announcementVideo,
bannerImage:banner
}

});


alert("Media Settings Updated");

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
🖼 Media Manager
</h1>


<p
style={{
color:"#64748B",
marginBottom:30
}}
>
Manage videos and dashboard visuals
</p>




<div
style={{
display:"grid",
gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))",
gap:25
}}
>



<Card
title="Welcome Video"
icon={<Video/>}
>


<input

value={welcomeVideo}

onChange={(e)=>setWelcomeVideo(e.target.value)}

placeholder="Paste video URL"

style={input}

/>



{
welcomeVideo &&

<div
style={{
marginTop:15,
display:"flex",
alignItems:"center",
gap:10
}}
>

<Play size={20}/>

Video Added

</div>

}


</Card>





<Card
title="Announcement Video"
icon={<Video/>}
>


<input

value={announcementVideo}

onChange={(e)=>setAnnouncementVideo(e.target.value)}

placeholder="Paste announcement video URL"

style={input}

/>



{
announcementVideo &&

<div>
<Play size={20}/>
 Video Added
</div>

}


</Card>






<Card
title="Dashboard Banner"
icon={<Image/>}
>


<input

value={banner}

onChange={(e)=>setBanner(e.target.value)}

placeholder="Banner Image URL"

style={input}

/>


{
banner &&

<img

src={banner}

style={{
width:"100%",
height:140,
objectFit:"cover",
borderRadius:12,
marginTop:10
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
fontWeight:600,
cursor:"pointer"
}}

>

Save Media

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

border:"1px solid #ddd",

borderRadius:10

};