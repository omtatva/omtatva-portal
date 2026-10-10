// One list of departments for every dropdown (Employee Management filter,
// employee details, Add Employee, profile). Previously the table filter and
// the details form each had their own, different list.

export const DEPARTMENTS = [
  "Production",
  "IT",
  "HR",
  "Marketing",
  "Management",
  "Operations",
  "Creative",
  "AI",
  "Finance",
  "Business Development",
] as const;

// The shared list plus any department already stored on someone but not in
// the list (so nothing existing is ever hidden or silently changed).
export function departmentOptions(extra: (string | null | undefined)[] = []): string[] {
  const seen = new Set(DEPARTMENTS.map((d) => d.toLowerCase()));
  const out: string[] = [...DEPARTMENTS];

  const unknown = new Map<string, string>();
  for (const e of extra) {
    const v = (e || "").trim();
    if (v && !seen.has(v.toLowerCase()) && !unknown.has(v.toLowerCase())) unknown.set(v.toLowerCase(), v);
  }
  out.push(...[...unknown.values()].sort((a, b) => a.localeCompare(b)));
  return out;
}
