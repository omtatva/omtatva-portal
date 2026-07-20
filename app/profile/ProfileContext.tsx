"use client";

import React, {
  createContext,
  useContext,
  useState,
} from "react";

type ProfileType = {
  firstName: string;
  lastName: string;
  personalEmail: string;
  mobile: string;
  dob: string;
  gender: string;
  bloodGroup: string;
  maritalStatus: string;
  nationality: string;

  employeeId: string;
  officialEmail: string;
  department: string;
  designation: string;
  reportingManager: string;
  employmentType: string;
  workMode: string;

  currentAddress: string;
  permanentAddress: string;
  city: string;
  state: string;
  country: string;
  pincode: string;

  emergencyName: string;
  emergencyRelation: string;
  emergencyPhone: string;

  bankName: string;
  accountHolder: string;
  accountNumber: string;
  ifsc: string;
  branch: string;
  upi: string;

  pan: string;
  aadhaar: string;
};

const ProfileContext = createContext<any>(null);

export function ProfileProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [profile, setProfile] = useState<ProfileType>({
    firstName: "",
    lastName: "",
    personalEmail: "",
    mobile: "",
    dob: "",
    gender: "",
    bloodGroup: "",
    maritalStatus: "",
    nationality: "Indian",

    employeeId: "",
    officialEmail: "",
    department: "",
    designation: "",
    reportingManager: "",
    employmentType: "",
    workMode: "",

    currentAddress: "",
    permanentAddress: "",
    city: "",
    state: "",
    country: "India",
    pincode: "",

    emergencyName: "",
    emergencyRelation: "",
    emergencyPhone: "",

    bankName: "",
    accountHolder: "",
    accountNumber: "",
    ifsc: "",
    branch: "",
    upi: "",

    pan: "",
    aadhaar: "",
  });

  return (
    <ProfileContext.Provider
      value={{ profile, setProfile }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}