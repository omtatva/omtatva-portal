"use client";

// Live reporting line for the signed-in employee: listens (onSnapshot) to the
// three documents of ONLY each person above them — users/{uid},
// employeeProfiles/{uid}, reportingStructure/{uid} — and, when asked, of the
// people who report DIRECTLY to them (found with a query constrained to
// managerId == my uid). It extends or trims the subscriptions as the admin
// changes the chain. It never lists a whole collection, so no other
// employee's data reaches this browser.

import { useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, onSnapshot, query, where, type DocumentData } from "firebase/firestore";
import { db } from "./firebase";
import { REPORTING_COLLECTION, type OrgIndex } from "./orgHierarchy";
import { buildLineIndex, chainIds, directReportIds, emptyEntry, lineReady, type LineDocs } from "./reportingLine";

type Key = "user" | "profile" | "rel";

export function useReportingLine(
  myUid: string | null,
  includeDirectReports = false
): { index: OrgIndex | null; ready: boolean } {
  const [docs, setDocs] = useState<LineDocs>({});
  const subs = useRef(new Map<string, (() => void)[]>());

  // Different user (or sign-out): start clean.
  useEffect(() => {
    const active = subs.current;
    return () => {
      active.forEach((list) => list.forEach((u) => u()));
      active.clear();
      setDocs({});
    };
  }, [myUid]);

  // Who reports directly to me — a query that can only ever return rows
  // where managerId is MY uid (the Firestore rule enforces the same).
  const [reportCandidates, setReportCandidates] = useState<string[]>([]);
  const [reportsLoaded, setReportsLoaded] = useState(false);

  useEffect(() => {
    if (!myUid || !includeDirectReports) return;
    return onSnapshot(
      query(collection(db, REPORTING_COLLECTION), where("managerId", "==", myUid)),
      (snap) => {
        setReportCandidates(snap.docs.map((d) => d.id));
        setReportsLoaded(true);
      },
      (error) => {
        console.warn("REPORTING LINE direct reports unavailable:", error.code || error.message);
        setReportCandidates([]);
        setReportsLoaded(true);
      }
    );
  }, [myUid, includeDirectReports]);

  const reportIds = useMemo(
    () => (myUid && includeDirectReports ? directReportIds(docs, myUid, reportCandidates) : []),
    [docs, myUid, includeDirectReports, reportCandidates]
  );

  const ids = useMemo(() => (myUid ? [...chainIds(docs, myUid), ...reportIds] : []), [docs, myUid, reportIds]);
  const idsKey = ids.join("|");

  useEffect(() => {
    const active = subs.current;
    const wanted = new Set(idsKey ? idsKey.split("|") : []);

    const patch = (id: string, key: Key, value: DocumentData | null) =>
      setDocs((prev) => {
        const entry = prev[id] || emptyEntry();
        return { ...prev, [id]: { ...entry, [key]: value, loaded: { ...entry.loaded, [key]: true } } };
      });

    const listen = (id: string, key: Key, collectionName: string) =>
      onSnapshot(
        doc(db, collectionName, id),
        (snap) => patch(id, key, snap.exists() ? snap.data() : null),
        (error) => {
          console.warn(`REPORTING LINE ${collectionName}/${id} unavailable:`, error.code || error.message);
          patch(id, key, null);
        }
      );

    for (const id of wanted) {
      if (active.has(id)) continue;
      active.set(id, [listen(id, "user", "users"), listen(id, "profile", "employeeProfiles"), listen(id, "rel", REPORTING_COLLECTION)]);
    }

    // People no longer on the line: stop listening and forget them.
    for (const [id, list] of [...active]) {
      if (!wanted.has(id)) {
        list.forEach((u) => u());
        active.delete(id);
      }
    }
  }, [idsKey]);

  const index = useMemo(() => (myUid ? buildLineIndex(docs, myUid, reportIds) : null), [docs, myUid, reportIds]);
  const ready = !!myUid && (!includeDirectReports || reportsLoaded) && lineReady(docs, myUid, reportIds);

  return { index, ready };
}
