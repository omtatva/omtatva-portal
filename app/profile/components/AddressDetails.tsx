"use client";

import React, { useState } from "react";
import { useProfile } from "../ProfileContext";
import Select from "react-select";
import CreatableSelect from "react-select/creatable";
import { countries } from "../data/countries";
import { indianStates, getCitiesForState } from "../data/indianstatescities";

export default function AddressDetails({
  back,
  next,
}: {
  back: () => void;
  next: () => void;
}) {


const {
  profile,
  setProfile,
  saveProfile,
}=useProfile();



const [sameAddress,setSameAddress]=useState(
  profile.sameAddress || false
);


const [isSaving,setIsSaving]=useState(false);



React.useEffect(() => {
  if (!sameAddress) return;
  setProfile((prev: any) => ({
    ...prev,
    permanentAddressLine1: prev.currentAddressLine1,
    permanentAddressLine2: prev.currentAddressLine2,
    permanentCity: prev.currentCity,
    permanentState: prev.currentState,
    permanentCountry: prev.currentCountry,
    permanentPincode: prev.currentPincode,
  }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [
  sameAddress,
  profile.currentAddressLine1,
  profile.currentAddressLine2,
  profile.currentCity,
  profile.currentState,
  profile.currentCountry,
  profile.currentPincode,
]);



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



const handleSaveAndContinue = async () => {
  setIsSaving(true);
  const ok = await saveProfile(profile);
  setIsSaving(false);
  if (ok) next();
};



// When a State changes, reset City if it doesn't belong to the new state.
// If the state itself was typed in freehand (not in our list), there's no
// known city list for it, so we just clear the city and let it be typed too.
const handleStateChange = (
  prefix: "current" | "permanent",
  newState: string
) => {
  const cities = getCitiesForState(newState).map((c) => c.value);
  setProfile((prev: any) => {
    const cityField = `${prefix}City`;
    const stillValid = cities.includes(prev[cityField]);
    return {
      ...prev,
      [`${prefix}State`]: newState,
      [cityField]: stillValid ? prev[cityField] : "",
    };
  });
};



// Wraps a plain string value as a react-select option so a freehand-typed
// state/city (one that doesn't exist in our predefined lists) still shows
// up correctly in the Creatable input instead of appearing empty.
const toOption = (value: string | undefined) =>
  value ? { value, label: value } : null;



const currentCityOptions = getCitiesForState(profile.currentState);
const permanentCityOptions = getCitiesForState(profile.permanentState);



return (

<div>


<h2
style={{
color:"#3d6fa8",
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
Country
</label>


<div style={{marginTop:8}}>

<Select

instanceId="currentCountry"

options={countries}

value={
countries.find(
(c) => c.value === (profile.currentCountry || "India")
)
}

onChange={(selected) =>

setProfile({

...profile,

currentCountry: selected?.value || "India"

})

}

/>

</div>

</div>





<div>

<label>
State
</label>


<div style={{marginTop:8}}>

<CreatableSelect

instanceId="currentState"

options={indianStates}

value={
indianStates.find(
(s) => s.value === profile.currentState
) || toOption(profile.currentState)
}

placeholder="Select or type your State"

formatCreateLabel={(input) => `Use "${input}"`}

onChange={(selected) =>
handleStateChange("current", selected?.value || "")
}

/>

</div>

</div>





<div>

<label>
City
</label>


<div style={{marginTop:8}}>

<CreatableSelect

instanceId="currentCity"

options={currentCityOptions}

value={
currentCityOptions.find(
(c) => c.value === profile.currentCity
) || toOption(profile.currentCity)
}

placeholder="Select or type your City"

formatCreateLabel={(input) => `Use "${input}"`}

onChange={(selected) =>

setProfile({

...profile,

currentCity: selected?.value || ""

})

}

/>

</div>

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


setProfile((prev:any)=>({

...prev,

sameAddress:checked,


permanentAddressLine1:
checked
? prev.currentAddressLine1
: prev.permanentAddressLine1,


permanentAddressLine2:
checked
? prev.currentAddressLine2
: prev.permanentAddressLine2,


permanentCity:
checked
? prev.currentCity
: prev.permanentCity,


permanentState:
checked
? prev.currentState
: prev.permanentState,


permanentCountry:
checked
? prev.currentCountry
: prev.permanentCountry,


permanentPincode:
checked
? prev.currentPincode
: prev.permanentPincode,

}));


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
Country
</label>


<div style={{marginTop:8}}>

<Select

instanceId="permanentCountry"

options={countries}

value={
countries.find(
(c) => c.value === (profile.permanentCountry || "India")
)
}

onChange={(selected) =>

setProfile({

...profile,

permanentCountry: selected?.value || "India"

})

}

/>

</div>

</div>





<div>

<label>
State
</label>


<div style={{marginTop:8}}>

<CreatableSelect

instanceId="permanentState"

options={indianStates}

value={
indianStates.find(
(s) => s.value === profile.permanentState
) || toOption(profile.permanentState)
}

placeholder="Select or type your State"

formatCreateLabel={(input) => `Use "${input}"`}

onChange={(selected) =>
handleStateChange("permanent", selected?.value || "")
}

/>

</div>

</div>





<div>

<label>
City
</label>


<div style={{marginTop:8}}>

<CreatableSelect

instanceId="permanentCity"

options={permanentCityOptions}

value={
permanentCityOptions.find(
(c) => c.value === profile.permanentCity
) || toOption(profile.permanentCity)
}

placeholder="Select or type your City"

formatCreateLabel={(input) => `Use "${input}"`}

onChange={(selected) =>

setProfile({

...profile,

permanentCity: selected?.value || ""

})

}

/>

</div>

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

onClick={handleSaveAndContinue}

disabled={isSaving}

style={{

background:"#3d6fa8",

color:"#fff",

border:"none",

padding:"15px 30px",

borderRadius:12,

cursor:"pointer",

fontWeight:700,

opacity: isSaving ? 0.7 : 1,

}}

>

{isSaving ? "Saving..." : "Save & Continue →"}

</button>



</div>



</div>

);

}