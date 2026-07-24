"use client";

import React, { useState } from "react";
import { useProfile } from "../ProfileContext";

export default function AddressDetails({
  back,
  next,
}: {
  back: () => void;
  next: () => void;
}) {


const {
  profile,
  setProfile
}=useProfile();



const [sameAddress,setSameAddress]=useState(
  profile.sameAddress || false
);



const input: React.CSSProperties = {
  width:"100%",
  height:52,
  border:"1px solid #d1d5db",
  borderRadius:12,
  padding:"0 15px",
  fontSize:15,
  marginTop:8,
  boxSizing:"border-box",
};



return (

<div>


<h2
style={{
color:"#2563eb",
marginBottom:30
}}
>
🏠 Address Information
</h2>



<h3
style={{
color:"#0f172a",
marginBottom:20
}}
>
Current Address
</h3>



<div
style={{
display:"grid",
gridTemplateColumns:"repeat(2,minmax(0,1fr))",
gap:25
}}
>


<div
style={{
gridColumn:"1 / span 2"
}}
>

<label>
Address Line 1
</label>


<input

style={input}

value={
profile.currentAddressLine1 || ""
}

onChange={(e)=>

setProfile({

...profile,

currentAddressLine1:e.target.value

})

}

/>

</div>





<div
style={{
gridColumn:"1 / span 2"
}}
>

<label>
Address Line 2
</label>


<input

style={input}

value={
profile.currentAddressLine2 || ""
}

onChange={(e)=>

setProfile({

...profile,

currentAddressLine2:e.target.value

})

}

/>

</div>





<div>

<label>
City
</label>


<input

style={input}

value={
profile.currentCity || ""
}

onChange={(e)=>

setProfile({

...profile,

currentCity:e.target.value

})

}

/>

</div>





<div>

<label>
State
</label>


<input

style={input}

value={
profile.currentState || ""
}

onChange={(e)=>

setProfile({

...profile,

currentState:e.target.value

})

}

/>

</div>





<div>

<label>
Country
</label>


<input

style={input}

value={
profile.currentCountry || "India"
}

onChange={(e)=>

setProfile({

...profile,

currentCountry:e.target.value

})

}

/>

</div>





<div>

<label>
PIN Code
</label>


<input

style={input}

value={
profile.currentPincode || ""
}

onChange={(e)=>

setProfile({

...profile,

currentPincode:e.target.value

})

}

/>

</div>


</div>

<hr
style={{
margin:"40px 0",
border:"1px solid #e5e7eb"
}}
/>



<div
style={{
display:"flex",
alignItems:"center",
gap:12,
marginBottom:25
}}
>

<input

type="checkbox"

checked={sameAddress}

onChange={(e)=>{

const checked = e.target.checked;

setSameAddress(checked);


setProfile({

...profile,

sameAddress:checked,


permanentAddressLine1:
checked
? profile.currentAddressLine1
: profile.permanentAddressLine1,


permanentAddressLine2:
checked
? profile.currentAddressLine2
: profile.permanentAddressLine2,


permanentCity:
checked
? profile.currentCity
: profile.permanentCity,


permanentState:
checked
? profile.currentState
: profile.permanentState,


permanentCountry:
checked
? profile.currentCountry
: profile.permanentCountry,


permanentPincode:
checked
? profile.currentPincode
: profile.permanentPincode,

});


}}

/>


<label
style={{
fontWeight:600
}}
>
Permanent Address is same as Current Address
</label>


</div>





{
!sameAddress && (

<>


<h3
style={{
color:"#0f172a",
marginBottom:20
}}
>
Permanent Address
</h3>



<div

style={{

display:"grid",

gridTemplateColumns:
"repeat(2,minmax(0,1fr))",

gap:25

}}

>



<div
style={{
gridColumn:"1 / span 2"
}}
>

<label>
Address Line 1
</label>


<input

style={input}

value={
profile.permanentAddressLine1 || ""
}

onChange={(e)=>

setProfile({

...profile,

permanentAddressLine1:e.target.value

})

}

/>

</div>





<div
style={{
gridColumn:"1 / span 2"
}}
>

<label>
Address Line 2
</label>


<input

style={input}

value={
profile.permanentAddressLine2 || ""
}

onChange={(e)=>

setProfile({

...profile,

permanentAddressLine2:e.target.value

})

}

/>

</div>





<div>

<label>
City
</label>


<input

style={input}

value={
profile.permanentCity || ""
}

onChange={(e)=>

setProfile({

...profile,

permanentCity:e.target.value

})

}

/>

</div>





<div>

<label>
State
</label>


<input

style={input}

value={
profile.permanentState || ""
}

onChange={(e)=>

setProfile({

...profile,

permanentState:e.target.value

})

}

/>

</div>





<div>

<label>
Country
</label>


<input

style={input}

value={
profile.permanentCountry || "India"
}

onChange={(e)=>

setProfile({

...profile,

permanentCountry:e.target.value

})

}

/>

</div>





<div>

<label>
PIN Code
</label>


<input

style={input}

value={
profile.permanentPincode || ""
}

onChange={(e)=>

setProfile({

...profile,

permanentPincode:e.target.value

})

}

/>

</div>



</div>


</>

)

}






<div

style={{

display:"flex",

justifyContent:"space-between",

marginTop:40

}}

>


<button

onClick={back}

style={{

background:"#64748b",

color:"#fff",

border:"none",

padding:"15px 30px",

borderRadius:12,

cursor:"pointer",

fontWeight:700

}}

>

← Back

</button>





<button

onClick={next}

style={{

background:"#2563eb",

color:"#fff",

border:"none",

padding:"15px 30px",

borderRadius:12,

cursor:"pointer",

fontWeight:700

}}

>

Save & Continue →

</button>



</div>



</div>

);

}