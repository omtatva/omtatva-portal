"use client";

// Live reporting line for the signed-in employee: listens (onSnapshot) to the
// three documents of ONLY each person above them — users/{uid},
// employeeProfiles/{uid}, reportingStructure/{uid} — extending or trimming
// the subscriptions as the admin changes the chain. Never reads collections,
// so no other employee's data reaches this browser.

import { useEffect, useMemo, useRef, useState } from "react";
import { doc, onSnapshot, type DocumentData } from "firebase/firestore";
import { db } from "./firebase";
import { REPORTING_COLLECTION, type OrgIndex } from "./orgHierarchy";
import { buildLineIndex, chainIds, emptyEntry, lineReady, type LineDocs } from "./reportingLine";

type Key = "user" | "profile" | "rel";

export function useReportingLine(myUid: string | null): { index: OrgIndex | null; ready: boolean } {
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

  const ids = useMemo(() => (myUid ? chainIds(docs, myUid) : []), [docs, myUid]);
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

  const index = useMemo(() => (myUid ? buildLineIndex(docs, myUid) : null), [docs, myUid]);
  const ready = !!myUid && lineReady(docs, myUid);

  return { index, ready };
}
