// Shared attendance-rules helpers — shift resolution + the
// Present/Late/Absent/Incomplete calculation. Previously this exact
// "is the punch-in after officeStartTime + graceMinutes" logic was
// duplicated (word for word) in app/attendance/page.js and
// app/admin/attendance/page.js, both reading a single GLOBAL
// officeStartTime/officeEndTime — meaning everyone was held to the same
// timing regardless of what shift they actually work.
//
// settings/attendanceRules now optionally carries a `shifts` array:
//   shifts: [{ id, name, startTime, endTime }, ...]
// and each employee (users/{uid}) optionally carries a `shiftId`
// pointing at one of those. If an employee has no shiftId, or it
// doesn't match any current shift, the original global
// officeStartTime/officeEndTime are used — so nothing breaks for
// employees nobody has assigned a shift to yet.

export type Shift = {
  id: string;
  name: string;
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
};

export type AttendanceRules = {
  officeStartTime?: string;
  officeEndTime?: string;
  graceMinutes?: number;
  extraBufferMinutes?: number;
  shifts?: Shift[];
  [key: string]: unknown;
};

export function getShiftTimes(
  rules: AttendanceRules | null | undefined,
  shiftId?: string | null
): { startTime: string; endTime: string } {
  const shift = shiftId ? rules?.shifts?.find((s) => s.id === shiftId) : null;
  return {
    startTime: shift?.startTime || rules?.officeStartTime || "10:00",
    endTime: shift?.endTime || rules?.officeEndTime || "19:00",
  };
}

type AttendanceItem = {
  status?: string;
  PunchIn?: { toDate?: () => Date } | string | Date | null;
  PunchOut?: { toDate?: () => Date } | string | Date | null;
  date?: string;
};

function toDate(value: AttendanceItem["PunchIn"]): Date | null {
  if (!value) return null;
  if (typeof value === "object" && "toDate" in value && value.toDate) return value.toDate();
  const d = new Date(value as string | Date);
  return isNaN(d.getTime()) ? null : d;
}

// Determines Present / Late / Absent / Incomplete. Firestore's raw
// "status" field is only ever "Present" or "Absent" — "Late"/"Incomplete"
// are always computed, never stored directly.
//
// TEMPORARY (2026-09-24): "Late" is disabled on purpose — anyone can
// punch in at any time for now, only total working hours matter. The
// original shift-cutoff calculation is commented out below, not
// deleted — uncomment the block and delete the early `return` to bring
// Late-marking back later. Absent/Incomplete are untouched; only the
// Late-vs-Present timing check is affected.
export function computeDisplayStatus(
  item: AttendanceItem,
  rules: AttendanceRules | null | undefined,
  shiftId: string | null | undefined,
  todayStr: string
): string {
  if (item.status === "Absent") {
    return "Absent";
  }

  const punch = toDate(item.PunchIn);
  if (!punch) {
    return item.status || "Present";
  }

  const punchOut = toDate(item.PunchOut);
  if (!punchOut && item.date !== todayStr) {
    return "Incomplete";
  }

  // Late-marking disabled for now — see note above. Once punched in
  // (and either punched out or it's still today), it's just "Present";
  // total hours are still calculated as normal wherever totalHours is
  // computed (punchOut() in app/attendance/page.js), this only affects
  // the Present/Late label.
  return "Present";

  // --- Late-marking logic (commented out, re-enable by restoring this
  //     and removing the early `return "Present"` above) ---
  // const { startTime } = getShiftTimes(rules, shiftId);
  // const graceMinutes = Number(rules?.graceMinutes ?? 15);
  // const [officeHour, officeMinute] = startTime.split(":").map(Number);
  //
  // const cutoff = new Date(punch);
  // cutoff.setHours(officeHour, officeMinute + graceMinutes, 0, 0);
  //
  // return punch > cutoff ? "Late" : "Present";
}
