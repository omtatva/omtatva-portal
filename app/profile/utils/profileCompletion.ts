export const sectionCompleted = (
  profile: any,
  section: string
) => {
  switch (section) {
    case "personal":
      return !!(
        profile.firstName &&
        profile.lastName &&
        profile.mobile &&
        profile.personalEmail
      );

    case "address":
      return !!(
        profile.currentAddressLine1 &&
        profile.currentCity &&
        profile.currentState &&
        profile.currentCountry &&
        profile.currentPincode &&
        (profile.sameAddress ||
          (profile.permanentAddressLine1 &&
            profile.permanentCity &&
            profile.permanentState &&
            profile.permanentCountry &&
            profile.permanentPincode))
      );

    case "emergency":
      return !!(
        profile.emergencyName &&
        profile.emergencyPhone
      );

    case "employment":
      return !!(
        profile.department &&
        profile.designation
      );

    case "bank":
      return !!(
        profile.bankAccountHolder &&
        profile.bankName &&
        profile.accountNumber &&
        profile.ifsc
      );

    case "documents":
      return !!(
        profile.documents &&
        profile.documents.aadhaar &&
        profile.documents.pan
      );

    case "review":
      return false;

    default:
      return false;
  }
};