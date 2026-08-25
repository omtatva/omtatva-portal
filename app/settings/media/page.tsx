"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Video,
  Image,
  Play,
} from "lucide-react";

const SETTINGS_REF = () => doc(db, "settings", "media");

const DEFAULTS = {
  welcomeVideo: "",
  announcementVideo: "",
  bannerImage: "",
};

export default function MediaPage(){

const [welcomeVideo, setWelcomeVideo] = useState(DEFAULTS.welcomeVideo);
const [announcementVideo, setAnnouncementVideo] = useState(DEFAULTS.announcementVideo);
const [banner, setBanner] = useState(DEFAULTS.bannerImage);
const [loading, setLoading] = useState(true);
const [saving, setSaving] = useState(false);

// Live-load from Firestore and stay in sync, same pattern as
// Branding/Appearance, instead of the old non-persistent in-memory
// config/appSettings.ts object.
useEffect(() => {
  const unsubscribe = onSnapshot(
    SETTINGS_REF(),
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setWelcomeVideo(data.welcomeVideo || DEFAULTS.welcomeVideo);
        setAnnouncementVideo(data.announcementVideo || DEFAULTS.announcementVideo);
        setBanner(data.bannerImage || DEFAULTS.bannerImage);
      }
      setLoading(false);
    },
    (error) => {
      console.error("LOAD MEDIA ERROR:", error);
      setLoading(false);
    }
  );
  return () => unsubscribe();
}, []);

async function save() {
  setSaving(true);
  try {
    await setDoc(
      SETTINGS_REF(),
      {
        welcomeVideo,
        announcementVideo,
        bannerImage: banner,
      },
      { merge: true }
    );
    alert("Media Settings Updated");
  } catch (error) {
    console.error("SAVE MEDIA ERROR:", error);
    alert("Failed to save. Please try again.");
  } finally {
    setSaving(false);
  }
}

if (loading) {
  return (
    <div style={{ padding: 60, textAlign: "center", color: "var(--text-muted)" }}>
      <h2>Loading media settings...</h2>
    </div>
  );
}

return(

<div
style={{
padding:"30px",
background:"var(--bg-color)",
minHeight:"100vh"
}}
>


<h1
style={{
fontSize:"30px",
fontWeight:700,
color: "var(--text-color)",
}}
>
🖼 Media Manager
{saving && (
  <span style={{ fontSize: 14, color: "#3d6fa8", marginLeft: 12, fontWeight: 500 }}>
    Saving...
  </span>
)}
</h1>


<p
style={{
color:"var(--text-muted)",
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
gap:10,
color: "var(--text-color)",
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

<div style={{ color: "var(--text-color)" }}>
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

disabled={saving}

style={{
marginTop:30,
background:"#3d6fa8",
color:"#fff",
padding:"14px 35px",
borderRadius:12,
border:"none",
fontWeight:600,
cursor: saving ? "default" : "pointer",
opacity: saving ? 0.7 : 1,
}}

>

{saving ? "Saving..." : "Save Media"}

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
background:"var(--card-bg)",
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
marginBottom:20,
color: "var(--text-color)",
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

border:"1px solid var(--border-color)",

borderRadius:10,

background: "var(--card-bg)",

color: "var(--text-color)",

boxSizing: "border-box" as const,

};
