// Performance ratings — server side. Every decision (who may rate whom, what
// needs approval, who may approve) is made HERE from the verified sign-in, the
// role in adminAccess and the reporting structure — never from the browser.
//
//   performanceRatings/{YYYY-MM}_{employeeUid}   server-only: the working record (current proposal + published rating + history)
//   performanceIndex/{employeeUid}               server-written, readable only by that employee: what their dashboard card shows

import { Timestamp, type DocumentData } from "firebase-admin/firestore";
import {
  approverOf, buildPerformanceIndex, canRate, canReview, canUseRatings, needsApproval, ratableUids, ratingInfo, validateSubmission,
  type IndexEntry, type ManagerMap, type PublishedRating,
} from "../performance";
import { normalizeRole, roleLabel } from "../roles";
import { ApiError, adminDb, type VerifiedUser } from "./firebaseAdmin";
import { currentPeriod, iso, loadRules, loadUsers, memberFor, type UserRow } from "./payrollData";

const db = () => adminDb();
const HISTORY_CAP = 25;

async function context(user: VerifiedUser) {
  const actor = await memberFor(user);
  if (!canUseRatings(actor.role)) throw new ApiError(403, "forbidden", "You do not have access to performance ratings.");

  const [users, structure, access, removed, rules] = await Promise.all([
    loadUsers(),
    db().collection("reportingStructure").get(),
    db().collection("adminAccess").get(),
    db().collection("removedEmployees").get(),
    loadRules(),
  ]);
  const gone = new Set(removed.docs.map((d) => d.id));
  const managerOf: ManagerMap = new Map(structure.docs.map((d) => [d.id, String(d.data().managerId || "")]));
  const roleByEmail = new Map(access.docs.map((d) => [d.id.toLowerCase(), normalizeRole(String(d.data().role || ""))]));
  const people = users.filter((u) => u.employeeId && u.status === "active" && !gone.has(u.uid));
  const roleOf = (u: UserRow) => roleByEmail.get(u.email.trim().toLowerCase()) || "employee";
  return { actor, users, people, managerOf, roleOf, period: currentPeriod(rules) };
}

const nameOf = (users: UserRow[], uid: string) => users.find((u) => u.uid === uid)?.name || "";

async function audit(actor: { email: string; uid: string }, activity: string, subject: UserRow | undefined, description: string) {
  try {
    await db().collection("activityLogs").add({
      employeeName: subject?.name || "", employeeEmail: subject?.email || "", uid: subject?.uid || "",
      activity, module: "Performance", type: "Performance", description: description.slice(0, 300),
      updatedBy: actor.email, updatedByUid: actor.uid, createdAt: Timestamp.now(),
    });
  } catch (e) {
    console.warn("performance audit log failed:", (e as Error).message);
  }
}

// ---------------------------------------------------------- employee's index
export async function rebuildPerformanceIndex(uid: string) {
  const snap = await db().collection("performanceRatings").where("employeeUid", "==", uid).get();
  const entries: IndexEntry[] = [];
  for (const d of snap.docs) {
    const p = d.data().published as (PublishedRating & { publishedAt?: unknown }) | null;
    if (p) entries.push({ period: String(d.data().period), rating: p.rating, score: p.score, comment: p.comment || "", publishedAt: iso(p.publishedAt) || (typeof p.publishedAt === "string" ? p.publishedAt : null), ratedBy: p.ratedBy, approvedBy: p.approvedBy || null });
  }
  const idx = buildPerformanceIndex(entries);
  await db().doc(`performanceIndex/${uid}`).set({ uid, ...JSON.parse(JSON.stringify(idx)), updatedAt: Timestamp.now() });
}

// ------------------------------------------------------------------ overview
export async function performanceOverview(user: VerifiedUser, periodIn: unknown) {
  const c = await context(user);
  const period = typeof periodIn === "string" && /^\d{4}-\d{2}$/.test(periodIn) ? periodIn : c.period;
  const ratable = new Set(ratableUids({ raterRole: c.actor.role, raterUid: c.actor.uid, everyone: c.people.map((p) => p.uid), managerOf: c.managerOf }));

  const snap = await db().collection("performanceRatings").where("period", "==", period).get();
  const byEmployee = new Map(snap.docs.map((d) => [String(d.data().employeeUid), d.data()]));
  const direct = new Set([...c.managerOf.entries()].filter(([, m]) => m === c.actor.uid).map(([e]) => e));

  const people = c.people
    .filter((p) => ratable.has(p.uid))
    .map((p) => {
      const r = byEmployee.get(p.uid);
      return {
        uid: p.uid, employeeId: p.employeeId, name: p.name, designation: p.designation, department: p.department,
        role: roleLabel(c.roleOf(p)), direct: direct.has(p.uid),
        rating: r ? { value: r.rating, score: r.score, comment: r.comment || "", status: r.status, submittedByName: r.submittedByName || "", submittedAt: iso(r.submittedAt), reviewNote: r.reviewNote || "" } : null,
        published: r?.published ? { rating: r.published.rating, comment: r.published.comment || "", ratedBy: r.published.ratedBy } : null,
        needsApprovalFromMe: false,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // what is waiting for MY decision (any month)
  const pendingSnap = await db().collection("performanceRatings").where("status", "==", "pending").get();
  const pending = pendingSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as DocumentData & { id: string })
    .filter((r) => canReview({ reviewerRole: c.actor.role, reviewerUid: c.actor.uid, submitterUid: String(r.submittedByUid), subjectUid: String(r.employeeUid), managerOf: c.managerOf }))
    .map((r) => ({
      id: r.id, period: String(r.period), employeeUid: String(r.employeeUid), employeeId: String(r.employeeId), employeeName: String(r.employeeName),
      rating: String(r.rating), comment: String(r.comment || ""), submittedByName: String(r.submittedByName || ""), submittedAt: iso(r.submittedAt),
      previous: r.published ? String(r.published.rating) : null,
    }))
    .sort((a, b) => b.period.localeCompare(a.period));

  return {
    period, currentPeriod: c.period, role: c.actor.role, roleLabel: roleLabel(c.actor.role),
    submitsForApproval: needsApproval(c.actor.role),
    myApprover: needsApproval(c.actor.role) ? nameOf(c.users, approverOf(c.actor.uid, c.managerOf) || "") || null : null,
    people, pending,
  };
}

// -------------------------------------------------------------------- submit
export async function submitRating(user: VerifiedUser, body: Record<string, unknown>) {
  const c = await context(user);
  const v = validateSubmission({ rating: body.rating, period: body.period, comment: body.comment, currentPeriod: c.period });
  if (!v.ok) throw new ApiError(400, "bad-request", v.error);
  const subjectUid = String(body.employeeUid || "");
  const subject = c.people.find((p) => p.uid === subjectUid);
  if (!subject || !canRate({ raterRole: c.actor.role, raterUid: c.actor.uid, subjectUid, managerOf: c.managerOf })) {
    throw new ApiError(403, "forbidden", "You can only rate people who report to you.");
  }

  const info = ratingInfo(v.rating)!;
  const pending = needsApproval(c.actor.role);
  const id = `${v.period}_${subjectUid}`;
  const ref = db().doc(`performanceRatings/${id}`);
  const raterName = nameOf(c.users, c.actor.uid) || c.actor.name || c.actor.email;
  const now = Timestamp.now();
  const ratedBy = `${raterName} (${roleLabel(c.actor.role)})`;

  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const prev = snap.exists ? snap.data()! : null;
    const history = Array.isArray(prev?.history) ? prev!.history : [];
    history.push({
      at: now.toDate().toISOString(), by: c.actor.email, byRole: c.actor.role, action: pending ? "proposed" : "rated",
      rating: v.rating, comment: v.comment, replaced: prev?.status ?? null,
    });
    const published: DocumentData | null = pending
      ? prev?.published ?? null // a proposal never changes what the employee already sees
      : { rating: v.rating, score: info.score, comment: v.comment, publishedAt: now, ratedBy, approvedBy: null };

    tx.set(ref, {
      period: v.period, employeeUid: subjectUid, employeeId: subject.employeeId, employeeName: subject.name,
      department: subject.department, designation: subject.designation,
      rating: v.rating, score: info.score, comment: v.comment,
      status: pending ? "pending" : "approved",
      submittedByUid: c.actor.uid, submittedByName: ratedBy, submittedByRole: c.actor.role, submittedAt: now,
      approverUid: pending ? approverOf(c.actor.uid, c.managerOf) : null,
      reviewedByName: null, reviewedAt: null, reviewNote: "",
      published,
      history: history.slice(-HISTORY_CAP),
      updatedAt: now,
    });
  });

  if (!pending) await rebuildPerformanceIndex(subjectUid);
  await audit(c.actor, pending ? "Performance Rating Proposed" : "Performance Rating Published", subject, `${v.period}: ${v.rating}${pending ? " (awaiting approval)" : ""} — by ${ratedBy}`);
  return {
    id, status: pending ? "pending" : "approved",
    message: pending ? "Submitted. It will be visible to the employee after your manager approves it." : "Saved and published to the employee's dashboard.",
  };
}

// -------------------------------------------------------------------- review
export async function reviewRating(user: VerifiedUser, body: Record<string, unknown>) {
  const c = await context(user);
  const id = typeof body.id === "string" && /^\d{4}-\d{2}_[A-Za-z0-9_-]{6,128}$/.test(body.id) ? body.id : "";
  if (!id) throw new ApiError(400, "bad-request", "Invalid rating.");
  const decision = body.decision === "approve" ? "approve" : body.decision === "reject" ? "reject" : null;
  if (!decision) throw new ApiError(400, "bad-request", "Choose approve or reject.");
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 300) : "";
  if (decision === "reject" && note.length < 5) throw new ApiError(400, "bad-request", "Tell the team lead why it was sent back (at least 5 characters).");

  const ref = db().doc(`performanceRatings/${id}`);
  const reviewer = nameOf(c.users, c.actor.uid) || c.actor.name || c.actor.email;
  const now = Timestamp.now();
  let subjectUid = "";
  let summary = "";

  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new ApiError(404, "not-found", "That rating no longer exists.");
    const r = snap.data()!;
    if (r.status !== "pending") throw new ApiError(409, "conflict", "This rating is no longer waiting for approval.");
    if (!canReview({ reviewerRole: c.actor.role, reviewerUid: c.actor.uid, submitterUid: String(r.submittedByUid), subjectUid: String(r.employeeUid), managerOf: c.managerOf })) {
      throw new ApiError(403, "forbidden", "You cannot approve this rating.");
    }
    subjectUid = String(r.employeeUid);
    const history = Array.isArray(r.history) ? r.history : [];
    history.push({ at: now.toDate().toISOString(), by: c.actor.email, byRole: c.actor.role, action: decision === "approve" ? "approved" : "rejected", rating: r.rating, comment: note });
    if (decision === "approve") {
      tx.update(ref, {
        status: "approved", reviewedByName: `${reviewer} (${roleLabel(c.actor.role)})`, reviewedAt: now, reviewNote: note,
        published: { rating: r.rating, score: r.score, comment: r.comment || "", publishedAt: now, ratedBy: r.submittedByName, approvedBy: `${reviewer} (${roleLabel(c.actor.role)})` },
        history: history.slice(-HISTORY_CAP), updatedAt: now,
      });
    } else {
      tx.update(ref, { status: "rejected", reviewedByName: `${reviewer} (${roleLabel(c.actor.role)})`, reviewedAt: now, reviewNote: note, history: history.slice(-HISTORY_CAP), updatedAt: now });
    }
    summary = `${r.period}: ${r.rating} for ${r.employeeName} ${decision === "approve" ? "approved" : "sent back"}`;
  });

  if (decision === "approve") await rebuildPerformanceIndex(subjectUid);
  await audit(c.actor, decision === "approve" ? "Performance Rating Approved" : "Performance Rating Rejected", c.users.find((u) => u.uid === subjectUid), summary);
  return { id, status: decision === "approve" ? "approved" : "rejected" };
}
