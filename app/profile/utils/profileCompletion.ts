export const sectionCompleted = (
  profile: any,
  section: string
) => {
  switch (section) {
    case "personal":
      return (
        profile.firstName &&
        profile.lastName &&
        profile.mobile &&
        profile.personalEmail
      );

    case "account":
      return (
        profile.employeeId &&
        profile.department &&
        profile.designation
      );

    case "address":
      return (
        profile.address &&
        profile.city &&
        profile.state &&
        profile.country
      );

    case "documents":
      return profile.documentsUploaded;
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
    profile.bankName &&
    profile.accountNumber &&
    profile.ifsc
  );

case "review":
  return false;
  
    default:
      return false;
  }
};