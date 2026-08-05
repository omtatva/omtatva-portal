"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  onAuthStateChanged,
} from "firebase/auth";

import {
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../../lib/firebase";


type ProfileType = {

  profilePhoto:string;

  salutation:string;
  firstName:string;
  middleName:string;
  lastName:string;
  personalEmail:string;
  mobile:string;
  dob:string;
  gender:string;
  bloodGroup:string;
  maritalStatus:string;
  nationality:string;


  employeeId:string;
  officialEmail:string;
  department:string;
  designation:string;
  reportingManager:string;
  employmentType:string;
  workMode:string;


  // ADDRESS

  sameAddress:boolean;

  currentAddressLine1:string;
  currentAddressLine2:string;
  currentCity:string;
  currentState:string;
  currentCountry:string;
  currentPincode:string;


  permanentAddressLine1:string;
  permanentAddressLine2:string;
  permanentCity:string;
  permanentState:string;
  permanentCountry:string;
  permanentPincode:string;


  // EMERGENCY

  emergencyName:string;
  emergencyRelation:string;
  emergencyCountryCode:string;
  emergencyPhone:string;
  emergencyAlternatePhone:string;
  emergencyEmail:string;
  emergencyOccupation:string;
  emergencyAddress:string;


  employeeCode: string;
  officeLocation: string;
  joiningDate: string;
  confirmationDate: string;
  noticePeriod: string;
  employeeStatus: string;

  // BANK

  bankAccountHolder:string;
  bankName:string;
  accountNumber:string;
  confirmAccountNumber:string;
  ifsc:string;
  branch:string;
  upi:string;
  accountType:string;
  pfNumber:string;
  esicNumber:string;
  uanNumber:string;
  panLinked:string;


  // DOCUMENTS

  pan:string;
  aadhaar:string;
  documents: Record<string, string>;

};



const initialProfile:ProfileType = {


profilePhoto:"",

salutation:"",
firstName:"",
middleName:"",
lastName:"",
personalEmail:"",
mobile:"",
dob:"",
gender:"",
bloodGroup:"",
maritalStatus:"",
nationality:"Indian",



employeeId:"",
officialEmail:"",
department:"",
designation:"",
reportingManager:"",
employmentType:"",
workMode:"",



sameAddress:false,


currentAddressLine1:"",
currentAddressLine2:"",
currentCity:"",
currentState:"",
currentCountry:"India",
currentPincode:"",


permanentAddressLine1:"",
permanentAddressLine2:"",
permanentCity:"",
permanentState:"",
permanentCountry:"India",
permanentPincode:"",



emergencyName:"",
emergencyRelation:"",
emergencyCountryCode:"+91",
emergencyPhone:"",
emergencyAlternatePhone:"",
emergencyEmail:"",
emergencyOccupation:"",
emergencyAddress:"",

employeeCode:"",
officeLocation:"Noida",
joiningDate:"",
confirmationDate:"",
noticePeriod:"",
employeeStatus:"Active",

bankAccountHolder:"",
bankName:"",
accountNumber:"",
confirmAccountNumber:"",
ifsc:"",
branch:"",
upi:"",
accountType:"Savings",
pfNumber:"",
esicNumber:"",
uanNumber:"",
panLinked:"Yes",


pan:"",
aadhaar:"",
documents:{},

};




const ProfileContext =
createContext<any>(null);




export function ProfileProvider({

children,

}:{

children:React.ReactNode;

}) {



const [profile,setProfile] =
useState<ProfileType>(
initialProfile
);



const [loading,setLoading] =
useState(true);


const [uid,setUid] =
useState<string | null>(null);





useEffect(()=>{


const unsubscribe =
onAuthStateChanged(
auth,
async(user)=>{


if(!user){

setLoading(false);

return;

}


setUid(user.uid);


try{


const profileRef =
doc(
db,
"employeeProfiles",
user.uid
);



const snap =
await getDoc(profileRef);



if(snap.exists()){


const data =
snap.data();



setProfile(prev=>({

...prev,

...data

}));


}



}
catch(error){

console.log(
"Profile Load Error:",
error
);

}

finally{


setLoading(false);


}



});


return ()=>unsubscribe();



},[]);




// NEW: actually persist profile to Firestore.
// Every step's "Save & Continue" should call this instead of
// relying only on local setProfile.
const saveProfile = async (
  data: Partial<ProfileType>
): Promise<boolean> => {

  const currentUid = uid || auth.currentUser?.uid;

  if (!currentUid) {
    console.log("Profile Save Error: no logged in user");
    return false;
  }

  const merged = { ...profile, ...data };

  setProfile(merged);

  const cleaned = Object.fromEntries(
    Object.entries(merged).filter(
      ([, value]) => value !== undefined
    )
  );

  try {
    await setDoc(
      doc(db, "employeeProfiles", currentUid),
      cleaned,
      { merge: true }
    );
    return true;
  } catch (error) {
    console.log("Profile Save Error:", error);
    return false;
  }
};






return (

<ProfileContext.Provider

value={{

profile,

setProfile,

saveProfile,

loading

}}

>

{children}

</ProfileContext.Provider>


);


}






export function useProfile(){

return useContext(
ProfileContext
);

}