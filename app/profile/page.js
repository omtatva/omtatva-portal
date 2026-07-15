"use client";

import { useState } from "react";
import { auth, db } from "../../lib/firebase";
import {
  doc,
  updateDoc,
  addDoc,
  collection,
  Timestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../../lib/firebase";

export default function ProfilePage() {
const [firstName, setFirstName] = useState("");
const [lastName, setLastName] = useState("");
const [employeeId, setEmployeeId] = useState("");
const [department, setDepartment] = useState("");
const [designation, setDesignation] = useState("");
const [phone, setPhone] = useState("");
const [emergencyContact, setEmergencyContact] = useState("");
const [emergencyPhone, setEmergencyPhone] = useState("");
const [address, setAddress] = useState("");
const [city, setCity] = useState("");
const [state, setState] = useState("");
const [country, setCountry] = useState("India");
const [dob, setDob] = useState("");
const [joiningDate, setJoiningDate] = useState("");
const [gender, setGender] = useState("");
const [bloodGroup, setBloodGroup] = useState("");
const [linkedin, setLinkedin] = useState("");
const [photo, setPhoto] = useState(null);
const [resume, setResume] = useState(null);


const [photoPreview, setPhotoPreview] = useState("");
  // const [employeeId, setEmployeeId] = useState("");
  // const [department, setDepartment] = useState("");
  // const [designation, setDesignation] = useState("");
  // const [phone, setPhone] = useState("");
  
const saveProfile = async () => {

  const currentUser = auth.currentUser;

  if (!currentUser) {
    alert("Please Login");
    return;
  }

  try {

    let photoURL = "";
    let resumeURL = "";

    // Upload Profile Photo
    if (photo) {

      const photoRef = ref(
        storage,
        `profilePhotos/${currentUser.uid}`
      );

      await uploadBytes(photoRef, photo);

      photoURL = await getDownloadURL(photoRef);

    }

    // Upload Resume

    if (resume) {

      const resumeRef = ref(
        storage,
        `resumes/${currentUser.uid}_${resume.name}`
      );

      await uploadBytes(resumeRef, resume);

      resumeURL = await getDownloadURL(resumeRef);

    }

if (resumeURL) {
  await addDoc(collection(db, "activityLogs"), {
    employeeName: `${firstName} ${lastName}`,
    uid: currentUser.uid,
    activity: "Resume Uploaded",
    type: "Document",
    description: resume.name,
    createdAt: Timestamp.now(),
  });
}

    await updateDoc(doc(db, "users", currentUser.uid), {

      uid: currentUser.uid,

      email: currentUser.email,

      photoURL: photoURL,

      firstName,

      lastName,

      employeeId,

      department,

      designation,

      phone,

      emergencyContact,

      emergencyPhone,

      address,

      city,

      state,

      country,

      dob,

      joiningDate,

      gender,

      bloodGroup,

      linkedin,

      role: "Employee",

      status: "Active",

            documents: {
  resume: resumeURL,
},

      profileCompleted: true,

      updatedAt: new Date(),

    });
await addDoc(collection(db, "activityLogs"), {
  employeeName: `${firstName} ${lastName}`,
  uid: user.uid,
  activity: "Profile Completed",
  type: "Profile",
  description: "Employee completed profile information",
  createdAt: Timestamp.now(),
});
    alert("Profile Saved Successfully");

    window.location.href = "/dashboard";

  } catch (err) {

    console.log(err);

    alert("Error Saving Profile");

  }

};




  return (
  <div
    style={{
      minHeight: "90vh",
      background: "#f8fafc",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      padding: "30px",
    }}
  >
    <div
      style={{
         width: "98%",
        maxWidth: "1600px",
        background: "#ffffff",
        borderRadius: "20px",
        padding: "50px 70px",
        boxShadow: "0 15px 40px rgba(0,0,0,0.08)",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: "30px" }}>
        <h1
          style={{
            fontSize: "36px",
            marginBottom: "10px",
            color: "#0f172a",
          }}
        >
          Complete Your Profile
        </h1>

        <p
          style={{
            color: "#64748b",
            fontSize: "16px",
          }}
        >
          Please complete your employee information before
          accessing Attendance and Timesheets.
        </p>
      </div>
     <div
  style={{
    gridColumn: "1 / span 2",
   display: "grid",
gridTemplateColumns: "repeat(2,minmax(0,1fr))",
columnGap: "45px",
rowGap: "30px",
    gap: "50px",
    alignItems: "center",
    marginBottom: "40px",
  }}
>
  {/* Profile Picture */}

  <div
    style={{
      display: "flex",
      justifyContent: "center",
    }}
  >
    <img
      src={photoPreview || "/profile.png"}
      style={{
        width: 170,
        height: 170,
        borderRadius: "50%",
        objectFit: "cover",
        border: "5px solid #2563eb",
      }}
    />
  </div>

  {/* Upload Section */}

  <div
    style={{
      display: "flex",
      flexDirection: "column",
      gap: "25px",
    }}
  >
    <div>
      <label
        style={{
          display: "block",
          fontWeight: 700,
          fontSize: 17,
          marginBottom: 10,
        }}
      >
        Upload Profile Photo
      </label>

      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files[0];
          if (!file) return;

          setPhoto(file);
          setPhotoPreview(URL.createObjectURL(file));
        }}
      />
    </div>

    <div>
      <label
        style={{
          display: "block",
          fontWeight: 700,
          fontSize: 17,
          marginBottom: 10,
        }}
      >
        Upload Resume
      </label>

      <input
        type="file"
        accept=".pdf,.doc,.docx"
        onChange={(e) => {
          if (e.target.files[0]) {
            setResume(e.target.files[0]);
          }
        }}
      />
    </div>
  </div>
</div>


      <div
        style={{
         display: "grid",
gridTemplateColumns: "repeat(2, minmax(0,1fr))",
columnGap: "40px",
rowGap: "28px",
alignItems: "start",
        }}
      >
        <div>
       <label
  style={{
    fontSize: "16px",
    fontWeight: 600,
    color: "#1e293b",
  }}
>
  First Name
</label>

        <input
          value={firstName}
          onChange={(e)=>setFirstName(e.target.value)}
          style={inputStyle}
        />
        </div>

        <div>
        <label
        style={{
    fontSize: "16px",
    fontWeight: 600,
    color: "#1e293b",
  }}
        >Last Name</label>

        <input
          value={lastName}
          onChange={(e)=>setLastName(e.target.value)}
          style={inputStyle}
        />
        </div>

        <div>
          <label
          style={{
    fontSize: "16px",
    fontWeight: 600,
    color: "#1e293b",
  }}
          >Phone Number</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 9876543210"
            style={inputStyle}
          />
        </div>

        <div>
        <label
        style={{
    fontSize: "16px",
    fontWeight: 600,
    color: "#1e293b",
  }}
        >Emergency Contact</label>

        <input
          value={emergencyContact}
          onChange={(e)=>setEmergencyContact(e.target.value)}
          style={inputStyle}
        />
        </div>

        <div>
        <label
        style={{
    fontSize: "16px",
    fontWeight: 600,
    color: "#1e293b",
  }}
        >Emergency Phone</label>

        <input
          value={emergencyPhone}
          onChange={(e)=>setEmergencyPhone(e.target.value)}
          style={inputStyle}
        />
        </div>

        <div style={{gridColumn:"1 / span 2"}}>
        <label
        style={{
    fontSize: "16px",
    fontWeight: 600,
    color: "#1e293b",
  }}
        >Address</label>
        <input
        value={address}
        onChange={(e)=>setAddress(e.target.value)}
        style={inputStyle}
        />
        </div>

        <div>
        <label
        style={{
    fontSize: "16px",
    fontWeight: 600,
    color: "#1e293b",
  }}
        >City</label>
        <input
        value={city}
        onChange={(e)=>setCity(e.target.value)}
        style={inputStyle}
        />
        </div>
        
        <div>
        <label
        style={{
    fontSize: "16px",
    fontWeight: 600,
    color: "#1e293b",
  }}
        >State</label>
        <input
        value={state}
        onChange={(e)=>setState(e.target.value)}
        style={inputStyle}
        />
        </div>

        <div>
        <label
        style={{
    fontSize: "16px",
    fontWeight: 600,
    color: "#1e293b",
  }}
        >Country</label>
        <input
        value={country}
        onChange={(e)=>setCountry(e.target.value)}
        style={inputStyle}
        />
        </div>

        <div>
        <label
        style={{
    fontSize: "16px",
    fontWeight: 600,
    color: "#1e293b",
  }}
        >Date of Birth</label>
        <input
        type="date"
        value={dob}
        onChange={(e)=>setDob(e.target.value)}
        style={inputStyle}
        />
        </div>

        <div>
        <label
        style={{
    fontSize: "16px",
    fontWeight: 600,
    color: "#1e293b",
  }}
        >Joining Date</label>
        <input
        type="date"
        value={joiningDate}
        onChange={(e)=>setJoiningDate(e.target.value)}
        style={inputStyle}
        />
        </div>

        <div>
        <label
        style={{
    fontSize: "16px",
    fontWeight: 600,
    color: "#1e293b",
  }}
        >Gender</label>

        <select
        value={gender}
        onChange={(e)=>setGender(e.target.value)}
        style={inputStyle}
        >
        <option value="">Select</option>
        <option>Male</option>
        <option>Female</option>
        <option>Other</option>
        </select>

        </div>

        <div>
        <label
        style={{
    fontSize: "16px",
    fontWeight: 600,
    color: "#1e293b",
  }}
        >Blood Group</label>

        <select
        value={bloodGroup}
        onChange={(e)=>setBloodGroup(e.target.value)}
        style={inputStyle}
        >
        <option value="">Select</option>
        <option>A+</option>
        <option>A-</option>
        <option>B+</option>
        <option>B-</option>
        <option>AB+</option>
        <option>AB-</option>
        <option>O+</option>
        <option>O-</option>
        </select>

        </div>

        <div>
        <label
        style={{
    fontSize: "16px",
    fontWeight: 600,
    color: "#1e293b",
  }}
        >LinkedIn</label>

        <input
        value={linkedin}
        onChange={(e)=>setLinkedin(e.target.value)}
        placeholder="https://linkedin.com/in/..."
        style={inputStyle}
        />
        </div>


      </div>

      <button
        onClick={saveProfile}
        style={{
          width: "100%",
          marginTop: "30px",
          padding: "15px",
          border: "none",
          borderRadius: "12px",
          background: "#2563eb",
          color: "white",
          fontSize: "16px",
          fontWeight: "bold",
          cursor: "pointer",
        }}
      >
        Save Profile & Continue
      </button>
    </div>
  </div>
);
}

const inputStyle = {
  width: "100%",
  height: "54px",
  padding: "0 18px",
  marginTop: "10px",
  border: "1px solid #cbd5e1",
  borderRadius: "12px",
  fontSize: "17px",
  outline: "none",
  boxSizing: "border-box",
};