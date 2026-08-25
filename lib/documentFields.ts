// Shared between app/profile/components/DocumentUpload.tsx (where an
// employee uploads) and app/admin/documents/page.tsx's sync-backfill —
// single source of truth for how an employee's upload key maps onto the
// field name admin/documents/[id]/page.js reads from users/{uid}.documents.
// Keeping this in one place instead of two copies is what the "bank"
// vs "cheque" mismatch bug was (see DocumentUpload.tsx's git history) —
// don't reintroduce a second copy.

// Document types that accept more than one file — documents[key] is an
// array of { name, url } rather than a single URL string.
export const MULTI_UPLOAD_TYPES = ["aadhaar", "pan", "education", "experience", "other"];

export const ADMIN_DOCUMENTS_FIELD_MAP: Record<string, string> = {
  aadhaar: "aadhaar",
  pan: "pan",
  resume: "resume",
  experience: "experienceLetter",
  bank: "bank",
  offer: "offerLetter",
  education: "education",
  // "Other Documents" from the employee's profile — previously had no
  // admin-side field at all, so it never showed up anywhere for HR.
  other: "other",
};

// Reverse lookup: given an admin-side field name (e.g. "experienceLetter"),
// find the employee's own upload key ("experience") — used when HR
// deletes a document from admin/documents/[id] so the deletion can also
// be mirrored into employeeDocuments/employeeProfiles (what the
// employee's own Profile > Document Upload page reads), not just
// users/{uid}.documents. Types with no employee-upload equivalent
// (passport, relievingLetter, salarySlip, officeCompliance — uploaded by
// HR directly) return null, since there's nothing to mirror.
export function employeeKeyForAdminField(adminField: string): string | null {
  const entry = Object.entries(ADMIN_DOCUMENTS_FIELD_MAP).find(([, v]) => v === adminField);
  return entry ? entry[0] : null;
}
