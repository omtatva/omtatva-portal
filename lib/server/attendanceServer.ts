// Server-side punch-in / punch-out. The browser sends only WHO it wants to
// be punched as (verified from the ID token), which shift it picked, and
// its GPS reading. Time, status, shift schedule, duplicate checks and hours
// are all decided here, using the server clock and the saved rules.

import { Timestamp, type DocumentData } from "firebase-admin/firestore";
import {
  addDays,
  companyTimezone,
  computeExtraHours,
  computeTotalHours,
  evaluatePunchIn,
  findShiftInstanceForPunch,
  getAbsentPolicy,
  listShifts,
  localDateString,
  MAX_SESSION_HOURS,
  resolveShift,
  shiftInstance,
  validatePunchOut,
  type PolicyRules,
  type ResolvedShift,
} from "../attendancePolicy";
import { ApiError, adminDb, type VerifiedUser } from "./firebaseAdmin";

type GpsInput = { latitude?: unknown; longitude?: unknown; accuracy?: unknown };

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

async function loadRules(): Promise<PolicyRules & DocumentData> {
  const snap = await adminDb().doc("settings/attendanceRules").get();
  if (!snap.exists) {
    throw new ApiError(412, "rules-missing", "Attendance rules have not been configured yet.");
  }
  return snap.data() as PolicyRules & DocumentData;
}

function checkGps(rules: DocumentData, gps: GpsInput, label: "Punch In" | "Punch Out") {
  const lat = Number(gps.latitude);
  const lng = Number(gps.longitude);
  const hasFix = Number.isFinite(lat) && Number.isFinite(lng) && gps.latitude !== null && gps.latitude !== undefined;

  if (!hasFix) {
    throw new ApiError(400, "gps-required", "Location is required to punch. Please allow location access and try again.");
  }

  const officeLat = Number(rules.officeLatitude);
  const officeLng = Number(rules.officeLongitude);
  const radius = Number(rules.officeRadius);
  const haveOffice = Number.isFinite(officeLat) && Number.isFinite(officeLng) && Number.isFinite(radius);

  const meters = haveOffice ? distanceMeters(lat, lng, officeLat, officeLng) : 0;
  const inside = haveOffice ? meters <= radius : true;

  if (!inside && rules.restrictOutsideOffice && !rules.allowRemotePunch) {
    throw new ApiError(
      403,
      "outside-office",
      `You are outside the office range, so ${label} isn't allowed. Distance: ${meters} m.`
    );
  }

  return {
    latitude: lat,
    longitude: lng,
    accuracy: Number.isFinite(Number(gps.accuracy)) ? Number(gps.accuracy) : null,
    meters,
    gpsStatus: inside ? "Inside Office" : "Outside Office",
  };
}

function shiftToPlain(s: ResolvedShift) {
  return {
    id: s.id,
    name: s.name,
    startTime: s.startTime,
    endTime: s.endTime,
    graceMinutes: s.graceMinutes,
    timezone: s.timezone,
    workdays: s.workdays,
  };
}

// ---------------------------------------------------------------------
// PUNCH IN
// ---------------------------------------------------------------------

export async function serverPunchIn(
  user: VerifiedUser,
  body: GpsInput & { shiftId?: unknown; deviceType?: unknown; userAgent?: unknown }
) {
  const db = adminDb();
  const now = new Date();
  const rules = await loadRules();
  const gps = checkGps(rules, body, "Punch In");

  const userSnap = await db.doc(`users/${user.uid}`).get();
  const userData = userSnap.exists ? userSnap.data() || {} : {};

  // ---- which shift? -------------------------------------------------
  const assignedId = typeof userData.shiftId === "string" ? userData.shiftId : "";
  const assigned = assignedId && rules.shifts?.some((s) => s.id === assignedId) ? assignedId : "";
  const available = listShifts(rules);

  let shift: ResolvedShift;
  let shiftSelectedBy: "admin" | "employee" | "default";

  if (assigned) {
    shift = resolveShift(rules, assigned);
    shiftSelectedBy = "admin";
  } else if (!rules.shifts || rules.shifts.length === 0) {
    shift = available[0];
    shiftSelectedBy = "default";
  } else {
    const chosen = typeof body.shiftId === "string" ? body.shiftId : "";
    if (!chosen) throw new ApiError(400, "shift-required", "Please select your shift before punching in.");
    if (!rules.shifts.some((s) => s.id === chosen)) {
      throw new ApiError(400, "shift-invalid", "The selected shift is not valid. Please refresh and choose again.");
    }
    shift = resolveShift(rules, chosen);
    shiftSelectedBy = "employee";
  }

  // ---- holiday / approved leave context -----------------------------
  const instance = findShiftInstanceForPunch(shift, now);

  const [holidaySnap, leaveSnap] = await Promise.all([
    db.collection("holidays").where("date", "==", instance.date).limit(1).get(),
    db.collection("leaveRequests").where("uid", "==", user.uid).where("status", "==", "Approved").get(),
  ]);
  const isHoliday = !holidaySnap.empty;
  const onApprovedLeave = leaveSnap.docs.some((d) => {
    const l = d.data();
    return typeof l.fromDate === "string" && typeof l.toDate === "string" && l.fromDate <= instance.date && instance.date <= l.toDate;
  });

  const evaluation = evaluatePunchIn({ punch: now, shift, rules, isHoliday, onApprovedLeave });
  const policy = getAbsentPolicy(rules);

  const name =
    user.name ||
    `${userData.firstName || ""} ${userData.lastName || ""}`.trim() ||
    user.email;

  const record = {
    userId: user.uid,
    employeeName: name,
    email: user.email,
    date: instance.date,
    PunchIn: Timestamp.fromDate(now),
    PunchOut: null,
    totalHours: 0,
    extraHours: 0,
    status: evaluation.status,
    statusReason: evaluation.reason,
    shiftId: shift.id,
    shiftName: shift.name,
    shiftSelectedBy,
    shiftSnapshot: shiftToPlain(shift),
    shiftStartAt: Timestamp.fromDate(instance.start),
    shiftEndAt: Timestamp.fromDate(instance.end),
    graceDeadlineAt: Timestamp.fromDate(instance.graceDeadline),
    policy: {
      name: "absent-after-grace",
      version: 1,
      applied: evaluation.policyApplied,
      skipReason: evaluation.skipReason || null,
      effectiveFrom: policy.effectiveFrom,
      minutesAfterDeadline: evaluation.minutesAfterDeadline,
    },
    statusHistory: [
      {
        at: Timestamp.fromDate(now),
        type: "policy",
        from: null,
        to: evaluation.status,
        reason: evaluation.reason,
        by: "system",
      },
    ],
    attendanceSource: typeof body.deviceType === "string" ? body.deviceType.slice(0, 60) : "Unknown Device",
    sourceDetails: {
      deviceType: typeof body.deviceType === "string" ? body.deviceType.slice(0, 60) : "Unknown Device",
      userAgent: typeof body.userAgent === "string" ? body.userAgent.slice(0, 300) : "",
    },
    latitude: gps.latitude,
    longitude: gps.longitude,
    accuracy: gps.accuracy,
    distanceFromOffice: gps.meters,
    gpsStatus: gps.gpsStatus,
    serverValidated: true,
    createdAt: Timestamp.fromDate(now),
  };

  const col = db.collection("attendance");

  const savedId = await db.runTransaction(async (tx) => {
    const existing = await tx.get(
      col.where("userId", "==", user.uid).where("date", "in", [addDays(instance.date, -1), instance.date])
    );

    const isAutoPlaceholder = (data: DocumentData) =>
      !data.PunchIn &&
      data.status === "Absent" &&
      typeof data.attendanceSource === "string" &&
      data.attendanceSource.startsWith("Auto-marked");

    for (const d of existing.docs) {
      const data = d.data();

      // A non-punch record for this date that isn't the automatic Absent
      // placeholder (e.g. leave/holiday/manual entry by HR) is never
      // overwritten by a punch.
      if (!data.PunchIn) {
        if (data.date === instance.date && !isAutoPlaceholder(data)) {
          throw new ApiError(
            409,
            "record-exists",
            `A ${data.status || "manual"} attendance record already exists for ${instance.date}. Please contact HR.`
          );
        }
        continue;
      }

      if (data.date === instance.date) {
        throw new ApiError(409, "duplicate-punch-in", "You have already punched in for this shift.");
      }

      // Yesterday's session: only blocks if it is genuinely still running
      // (overnight shift not yet finished and not past the session limit).
      const shiftEnd: Date | null = data.shiftEndAt?.toDate ? data.shiftEndAt.toDate() : null;
      const punchedAt: Date | null = data.PunchIn?.toDate ? data.PunchIn.toDate() : null;
      const stillRunning =
        !data.PunchOut &&
        shiftEnd &&
        punchedAt &&
        now.getTime() <= shiftEnd.getTime() &&
        (now.getTime() - punchedAt.getTime()) / 3600000 <= MAX_SESSION_HOURS;
      if (stillRunning) {
        throw new ApiError(409, "open-session", "You still have an open session. Please punch out first.");
      }
    }

    // An auto-created "Absent (no punch-in)" placeholder for this date is
    // not a real punch — fill it in, keeping a record of what it was.
    const placeholder = existing.docs.find((d) => d.data().date === instance.date && isAutoPlaceholder(d.data()));
    if (placeholder) {
      const prior = placeholder.data();
      tx.update(placeholder.ref, {
        ...record,
        statusHistory: [
          {
            at: Timestamp.fromDate(now),
            type: "placeholder-replaced",
            from: prior.status || "Absent",
            to: record.status,
            reason: `Replaced auto-generated placeholder (${prior.attendanceSource || "no punch-in"}) with a real punch.`,
            by: "system",
          },
          ...record.statusHistory,
        ],
      });
      return placeholder.id;
    }

    const ref = col.doc();
    tx.create(ref, record);
    return ref.id;
  });

  return {
    id: savedId,
    date: instance.date,
    status: evaluation.status,
    reason: evaluation.reason,
    shift: shiftToPlain(shift),
    graceDeadline: instance.graceDeadline.toISOString(),
    policyApplied: evaluation.policyApplied,
  };
}

// ---------------------------------------------------------------------
// PUNCH OUT
// ---------------------------------------------------------------------

export async function serverPunchOut(user: VerifiedUser, body: GpsInput) {
  const db = adminDb();
  const now = new Date();
  const rules = await loadRules();
  const gps = checkGps(rules, body, "Punch Out");

  const tz = companyTimezone(rules);
  const today = localDateString(now, tz);
  const col = db.collection("attendance");

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(
      col.where("userId", "==", user.uid).where("date", "in", [addDays(today, -1), today])
    );

    const withPunch = snap.docs
      .filter((d) => d.data().PunchIn)
      .sort((a, b) => b.data().PunchIn.toMillis() - a.data().PunchIn.toMillis());

    const open = withPunch.find((d) => !d.data().PunchOut);
    const target = open || withPunch[0];

    if (!target) {
      throw new ApiError(409, "no-session", "Please punch in first.");
    }

    const data = target.data();
    const punchIn: Date = data.PunchIn.toDate();
    const check = validatePunchOut(punchIn, data.PunchOut, now);
    if (!check.ok) throw new ApiError(409, check.code, check.message);

    // The shift chosen at punch-in is authoritative — never re-resolved
    // from today's settings or the request. Legacy rows without a saved
    // snapshot fall back to the employee's assigned shift / office timing.
    let shiftEnd: Date;
    if (data.shiftEndAt?.toDate) {
      shiftEnd = data.shiftEndAt.toDate();
    } else {
      const userSnap = await tx.get(db.doc(`users/${user.uid}`));
      const legacyShift = resolveShift(rules, userSnap.exists ? userSnap.data()?.shiftId : null);
      shiftEnd = shiftInstance(legacyShift, data.date).end;
    }

    const buffer = Number(rules.extraBufferMinutes ?? 60);
    const extraHours = computeExtraHours(now, shiftEnd, buffer);
    const totalHours = computeTotalHours(punchIn, now);

    tx.update(target.ref, {
      PunchOut: Timestamp.fromDate(now),
      totalHours,
      extraHours,
      punchOutLatitude: gps.latitude,
      punchOutLongitude: gps.longitude,
      punchOutAccuracy: gps.accuracy,
      punchOutDistanceFromOffice: gps.meters,
      punchOutGpsStatus: gps.gpsStatus,
      punchOutServerValidated: true,
    });

    return { id: target.id, date: data.date as string, totalHours, extraHours };
  });

  return result;
}
