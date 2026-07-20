"use client";

import { useEffect, useState } from "react";

import { useProfile } from "../ProfileContext";
import Select from "react-select";
import PhoneInput from "react-phone-number-input";
import { countries } from "../data/countries";
import "react-phone-number-input/style.css";

import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";

import {
  doc,
  setDoc,
  getDoc,
} from "firebase/firestore";

import toast from "react-hot-toast";

import { auth, storage, db } from "../../../lib/firebase";
export default function PersonalInfo({
  next,
}: {
  next: () => void;
}) {
  const [photoPreview, setPhotoPreview] = useState("/profile.png");
const { profile, setProfile } = useProfile();
const [isSaving, setIsSaving] = useState(false);
const [uploadingPhoto, setUploadingPhoto] =
  useState(false);
  const input: React.CSSProperties = {
    width: "100%",
    height: 52,
    border: "1px solid #d1d5db",
    borderRadius: 12,
    padding: "0 15px",
    fontSize: 15,
    marginTop: 8,
    boxSizing: "border-box",
  };

  useEffect(() => {
  const loadProfile = async () => {
    const user = auth.currentUser;

    if (!user) return;

    const snap = await getDoc(
      doc(db, "employeeProfiles", user.uid)
    );

    if (snap.exists()) {
      const data = snap.data();

      setProfile((prev: any) => ({
        ...prev,
        ...data,
      }));

      if (data.profilePhoto) {
        setPhotoPreview(data.profilePhoto);
      }
    }
  };

  loadProfile();
}, []);
const uploadProfilePhoto = async (file: File) => {
  const user = auth.currentUser;

  if (!user) {
    toast.error("Please login");
    return;
  }

  try {
    setUploadingPhoto(true);

    const storageRef = ref(
      storage,
      `employees/${user.uid}/profile/profile.jpg`
    );

    const uploadTask = uploadBytesResumable(
      storageRef,
      file
    );

    await new Promise<void>((resolve, reject) => {
      uploadTask.on(
        "state_changed",
        undefined,
        reject,
        resolve
      );
    });

    const photoURL = await getDownloadURL(
      uploadTask.snapshot.ref
    );

    await setDoc(
      doc(db, "employeeProfiles", user.uid),
      {
        profilePhoto: photoURL,
      },
      {
        merge: true,
      }
    );

    setProfile({
      ...profile,
      profilePhoto: photoURL,
    });

    setPhotoPreview(photoURL);

    toast.success("Profile photo updated");

  } catch (error) {
    console.error(error);
    toast.error("Upload failed");
  } finally {
    setUploadingPhoto(false);
  }
};

useEffect(() => {
  const user = auth.currentUser;

  if (!user) return;

  const timeout = setTimeout(async () => {
    try {
      setIsSaving(true);

      await setDoc(
        doc(db, "employeeProfiles", user.uid),
        profile,
        {
          merge: true,
        }
      );
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  }, 800);

  return () => clearTimeout(timeout);

}, [profile]);

const profileFields = [
  profile.salutation,
  profile.firstName,
  profile.middleName,
  profile.lastName,
  profile.personalEmail,
  profile.mobile,
  profile.dob,
  profile.gender,
  profile.bloodGroup,
  profile.maritalStatus,
  profile.nationality,
  profile.profilePhoto,
];

const completedFields = profileFields.filter(
  (field) => field && field.toString().trim() !== ""
).length;

const completion = Math.round(
  (completedFields / profileFields.length) * 100
);

  return (
    <div>
        <div
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  }}
>
       <h2
    style={{
      color: "#2563eb",
    }}
  >
    👤 Personal Information
  </h2>

  <div
    style={{
      fontSize: 14,
      fontWeight: 600,
      color: isSaving
        ? "#f59e0b"
        : "#16a34a",
    }}
  >
    {isSaving
      ? "💾 Saving..."
      : "✅ All changes saved"}
  </div>
</div>
<div
  style={{
    marginBottom: 30,
  }}
>
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      marginBottom: 8,
      fontWeight: 600,
    }}
  >
    <span>Profile Completion</span>

    <span>{completion}%</span>
  </div>

  <div
    style={{
      width: "100%",
      height: 10,
      background: "#e5e7eb",
      borderRadius: 50,
      overflow: "hidden",
    }}
  >
    <div
      style={{
        width: `${completion}%`,
        height: "100%",
        background:
          completion === 100
            ? "#16a34a"
            : "#2563eb",
        transition: ".4s",
      }}
    />
  </div>
</div>

      {/* Profile Photo */}

      <div
  style={{
    display: "flex",
    alignItems: "flex-start",
    gap: 30,
    marginBottom: 35,
  }}
>
  {/* Left Side */}
  <div
    style={{
      width: 180,
      textAlign: "center",
    }}
  >
    <img
      src={photoPreview}
      style={{
        width: 140,
        height: 140,
        borderRadius: "50%",
        objectFit: "cover",
        border: "4px solid #2563eb",
      }}
    />

    <input
      id="profilePhoto"
      type="file"
      accept="image/*"
      style={{ display: "none" }}
      onChange={async (e) => {
  const file = e.target.files?.[0];

  if (!file) return;

  setPhotoPreview(
    URL.createObjectURL(file)
  );

  await uploadProfilePhoto(file);
}}
    />

    <label
      htmlFor="profilePhoto"
      style={{
        display: "block",
        marginTop: 15,
        background: "#2563eb",
        color: "#fff",
        padding: "12px 18px",
        borderRadius: 10,
        cursor: "pointer",
        fontWeight: 600,
        fontSize: 14,
      }}
    >
      {uploadingPhoto
  ? "Uploading..."
  : "📷 Upload Photo"}
    </label>

    <p
      style={{
        marginTop: 10,
        fontSize: 12,
        color: "#64748b",
      }}
    >
      JPG / PNG<br />
      Max Size 5 MB
    </p>
  </div>

  {/* Right Side */}
  <div
    style={{
      flex: 1,
    }}
  >
    {/* Keep your form grid here */}
  </div>
</div>

<div
  style={{
    display: "grid",
    gridTemplateColumns: "140px 1fr 1fr 1fr",
    gap: 20,
    alignItems: "end",
  }}
>
  {/* Salutation */}

  <div>
    <label>Salutation *</label>

    <select
      style={input}
      value={profile.salutation}
      onChange={(e) =>
        setProfile({
          ...profile,
          salutation: e.target.value,
        })
      }
    >
      <option>Mr.</option>
      <option>Mrs.</option>
      <option>Miss</option>
      <option>Ms.</option>
      <option>Dr.</option>
      <option>Prof.</option>
    </select>
  </div>

  {/* First Name */}

  <div>
    <label>First Name *</label>

    <input
      style={input}
      placeholder="First Name"
      value={profile.firstName}
      onChange={(e) =>
        setProfile({
          ...profile,
          firstName: e.target.value,
        })
      }
    />
  </div>

  {/* Middle Name */}

  <div>
    <label>Middle Name</label>

    <input
      style={input}
      placeholder="Middle Name"
      value={profile.middleName}
      onChange={(e) =>
        setProfile({
          ...profile,
          middleName: e.target.value,
        })
      }
    />
  </div>

  {/* Last Name */}

  <div>
    <label>Last Name *</label>

    <input
      style={input}
      placeholder="Last Name"
      value={profile.lastName}
      onChange={(e) =>
        setProfile({
          ...profile,
          lastName: e.target.value,
        })
      }
    />
  </div>


        <div>
          <label>Employee ID</label>
          <input
            style={{
              ...input,
              background: "#f1f5f9",
            }}
            disabled
          />
        </div>

        <div>
          <label>Personal Email</label>
          <input
            type="email"
            style={input}
          />
        </div>

        <div>
  <label
    style={{
      display: "block",
      marginBottom: 8,
      fontWeight: 600,
    }}
  >
    Mobile Number *
  </label>

<PhoneInput
  international
  defaultCountry="IN"
  value={profile.mobile || ""}
  onChange={(value) =>
    setProfile({
      ...profile,
      mobile: value || "",
    })
  }
  placeholder="Enter mobile number"
  style={{
    border: "1px solid #d1d5db",
    borderRadius: 12,
    padding: "12px 15px",
    background: "#fff",
  }}
/>
</div>


        <div>
          <label>Date of Birth</label>
          <input
            type="date"
            style={input}
          />
        </div>

        <div>
          <label>Gender</label>

          <select style={input}>
            <option>Select</option>
            <option>Male</option>
            <option>Female</option>
            <option>Other</option>
          </select>
        </div>

        <div>
          <label>Blood Group</label>

          <select style={input}>
            <option>Select</option>
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
          <label>Marital Status</label>

          <select style={input}>
            <option>Select</option>
            <option>Single</option>
            <option>Married</option>
          </select>
        </div>

        <div>
          <label>Nationality</label>
          <Select
  options={countries}
  placeholder="Select Nationality"
  value={countries.find(
    (c) => c.value === profile.nationality
  )}
  onChange={(selected) =>
    setProfile({
      ...profile,
      nationality: selected?.value || "",
    })
  }
/>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginTop: 40,
        }}
      >
        <button
          onClick={next}
          style={{
            background: "#2563eb",
            color: "#fff",
            border: "none",
            padding: "15px 35px",
            borderRadius: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Save & Continue →
        </button>
      </div>
    </div>
);
}