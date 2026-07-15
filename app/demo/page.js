export default function DemoPage(){

return(
<div
style={{
  padding:"50px",
  textAlign:"center"
}}
>

<h1>
OMTATVA DIGITALS Platform Demo
</h1>


<video
controls
style={{
  width:"100%",
  maxWidth:"1800px",
  borderRadius:"20px",
}}
>

<source
src="https://storage.googleapis.com/omtatva_portal_bucket/videos/Original%20to%20Ai%20Conversion.1.mp4"
type="video/mp4"
/>

Your browser does not support video.

</video>


</div>
);

}