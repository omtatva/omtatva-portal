"use client";

// Live organization data. Subscribes (onSnapshot) to the three collections
// the hierarchy is built from and rebuilds the index whenever any of them
// changes — so an admin saving a new reporting manager shows up in every
// open dashboard immediately. All listeners are removed on unmount.
//
// employeeProfiles is what every signed-in employee can already read (the
// dashboard's birthday widget uses it), and carries the profile photo. The
// users collection adds HR-managed designation/department/status; if the
// current user is not allowed to read it, the chart degrades to profile
// data instead of failing.

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, type DocumentData } from "firebase/firestore";
import { db } from "./firebase";
import {
  REPORTING_COLLECTION,
  buildIndex,
  buildPerson,
  type OrgIndex,
} from "./orgHierarchy";

type DocMap = Map<string, DocumentData>;

export type OrgChartState = {
  index: OrgIndex;
  ready: boolean;
  // Set when the reporting relationships themselves cannot be read
  // (e.g. security rules for reportingStructure not published yet).
  relationsError: string;
};

function toMap(docs: { id: string; data: () => DocumentData }[]): DocMap {
  const m: DocMap = new Map();
  docs.forEach((d) => m.set(d.id, d.data()));
  return m;
}

export function useOrgChart(): OrgChartState {
  const [users, setUsers] = useState<DocMap>(new Map());
  const [profiles, setProfiles] = useState<DocMap>(new Map());
  const [relations, setRelations] = useState<DocMap>(new Map());
  const [loaded, setLoaded] = useState({ users: false, profiles: false, relations: false });
  const [relationsError, setRelationsError] = useState("");
  const [usersReadable, setUsersReadable] = useState(false);

  useEffect(() => {
    const mark = (key: "users" | "profiles" | "relations") =>
      setLoaded((prev) => (prev[key] ? prev : { ...prev, [key]: true }));

    const unsubUsers = onSnapshot(
      collection(db, "users"),
      (snap) => {
        setUsers(toMap(snap.docs));
        setUsersReadable(true);
        mark("users");
      },
      (error) => {
        console.warn("ORG users listener unavailable:", error.code || error.message);
        setUsers(new Map());
        setUsersReadable(false);
        mark("users");
      }
    );

    const unsubProfiles = onSnapshot(
      collection(db, "employeeProfiles"),
      (snap) => {
        setProfiles(toMap(snap.docs));
        mark("profiles");
      },
      (error) => {
        console.warn("ORG employeeProfiles listener unavailable:", error.code || error.message);
        setProfiles(new Map());
        mark("profiles");
      }
    );

    const unsubRelations = onSnapshot(
      collection(db, REPORTING_COLLECTION),
      (snap) => {
        setRelations(toMap(snap.docs));
        setRelationsError("");
        mark("relations");
      },
      (error) => {
        console.error("ORG reportingStructure listener error:", error);
        setRelations(new Map());
        setRelationsError(
          error.code === "permission-denied"
            ? "Reporting structure is not accessible yet (Firestore rules for reportingStructure need to be published)."
            : "Could not load the reporting structure."
        );
        mark("relations");
      }
    );

    return () => {
      unsubUsers();
      unsubProfiles();
      unsubRelations();
    };
  }, []);

  const index = useMemo(() => {
    // users/{uid} is the roster of record (Admin -> Users deletes only that
    // doc), so when it is readable it decides who exists; otherwise fall
    // back to the profiles every signed-in employee can read.
    const ids = new Set<string>(usersReadable ? users.keys() : profiles.keys());
    const people = Array.from(ids).map((uid) => {
      const managerId =
        typeof relations.get(uid)?.managerId === "string"
          ? (relations.get(uid)?.managerId as string)
          : "";
      return buildPerson(uid, users.get(uid), profiles.get(uid), managerId);
    });
    return buildIndex(people);
  }, [users, profiles, relations, usersReadable]);

  return {
    index,
    ready: loaded.users && loaded.profiles && loaded.relations,
    relationsError,
  };
}
