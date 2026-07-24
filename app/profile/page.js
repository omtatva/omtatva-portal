"use client";

import { useState } from "react";
import { ProfileProvider } from "./ProfileContext";
import Stepper from "./components/Stepper";

import PersonalInfo from "./components/PersonalInfo";
import AddressDetails from "./components/AddressDetails";
import EmergencyContact from "./components/EmergencyContact";
import EmploymentDetails from "./components/EmploymentDetails";
import BankDetails from "./components/BankDetails";
import DocumentUpload from "./components/DocumentUpload";
import ReviewSubmit from "./components/ReviewSubmit";

export default function ProfilePage() {
  const [step, setStep] = useState(0);

  return (
    <ProfileProvider>
    <div
      style={{
        maxWidth: 1500,
        margin: "40px auto",
        padding: 40,
        background: "#fff",
        borderRadius: 20,
        boxShadow:
          "0 15px 40px rgba(0,0,0,.08)",
      }}
    >
      <h1
        style={{
          textAlign: "center",
          marginBottom: 15,
        }}
      >
        Employee Profile
      </h1>

      <Stepper step={step} />

      {step === 0 && (
        <PersonalInfo next={() => setStep(1)} />
      )}


      {step === 1 && (
        <AddressDetails
          back={() => setStep(0)}
          next={() => setStep(2)}
        />
      )}

      {step === 2 && (
        <EmergencyContact
          back={() => setStep(1)}
          next={() => setStep(3)}
        />
      )}

      {step === 3 && (
        <EmploymentDetails
          back={() => setStep(2)}
          next={() => setStep(4)}
        />
      )}

      {step ===4 && (
        <BankDetails
          back={() => setStep(3)}
          next={() => setStep(5)}
        />
      )}

      {step === 5 && (
        <DocumentUpload
          back={() => setStep(4)}
          next={() => setStep(6)}
        />
      )}

      {step === 6 && (
        <ReviewSubmit back={() => setStep(5)} />
      )}
    </div>
    </ProfileProvider>
  );
}