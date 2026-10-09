// "My reporting line" — what an ordinary employee may see: themselves, the
// people ABOVE them, and the people who report DIRECTLY to them. Nobody else
// (no peers, no other teams, no company-wide chart). This module is pure (no Firestore/React);
// useReportingLine() feeds it only the documents of people on that line, so
// peers and subordinates are never even downloaded to the employee's browser.

import type { DocumentData } from "firebase/firestore";
import { buildIndex, buildPerson, type OrgIndex } from "./orgHierarchy";

export type LineEntry = {
  user: DocumentData | null;
  profile: DocumentData | null;
  rel: DocumentData | null;
  loaded: { user: boolean; profile: boolean; rel: boolean };
};

export type LineDocs = Record<string, LineEntry>;

export const MAX_LINE_DEPTH = 25;

export const emptyEntry = (): LineEntry => ({
  user: null,
  profile: null,
  rel: null,
  loaded: { user: false, profile: false, rel: false },
});

const fullyLoaded = (e?: LineEntry) => !!e && e.loaded.user && e.loaded.profile && e.loaded.rel;
const recordMissing = (e?: LineEntry) => !!e && e.loaded.user && e.loaded.profile && !e.user && !e.profile;

// [me, my manager, their manager, ...] — stops at the top, at a loop, or at
// a manager whose record no longer exists.
export function chainIds(docs: LineDocs, myUid: string): string[] {
  const ids = [myUid];
  const seen = new Set(ids);
  let current = myUid;

  for (let i = 0; i < MAX_LINE_DEPTH; i++) {
    const managerId = docs[current]?.rel?.managerId;
    if (typeof managerId !== "string" || !managerId || seen.has(managerId)) break;
    ids.push(managerId);
    seen.add(managerId);
    if (recordMissing(docs[managerId])) break;
    current = managerId;
  }
  return ids;
}

// Direct reports that may be shown: never me, never someone already above me.
export function directReportIds(docs: LineDocs, myUid: string, candidateIds: string[]): string[] {
  const above = new Set(chainIds(docs, myUid));
  return [...new Set(candidateIds)].filter((id) => id !== myUid && !above.has(id));
}

export function lineReady(docs: LineDocs, myUid: string, reportIds: string[] = []): boolean {
  return [...chainIds(docs, myUid), ...directReportIds(docs, myUid, reportIds)].every((id) => fullyLoaded(docs[id]));
}

// Index containing ONLY the people on the line (+ my direct reports).
export function buildLineIndex(docs: LineDocs, myUid: string, reportIds: string[] = []): OrgIndex {
  const above = chainIds(docs, myUid);
  const ids = [...above, ...directReportIds(docs, myUid, reportIds)];
  const people = ids
    .filter((id) => {
      const e = docs[id];
      return !!e && (!!e.user || !!e.profile);
    })
    .map((id) => {
      const e = docs[id];
      const isReport = !above.includes(id);
      // A direct report's manager is, by definition, me.
      const managerId = isReport ? myUid : typeof e.rel?.managerId === "string" ? e.rel.managerId : "";
      return buildPerson(id, e.user ?? undefined, e.profile ?? undefined, managerId);
    });
  return buildIndex(people);
}
