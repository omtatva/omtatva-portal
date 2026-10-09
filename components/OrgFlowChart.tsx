"use client";

import { useCallback, useState } from "react";
import PersonAvatar from "./PersonAvatar";
import { getManagerChain, type OrgIndex, type OrgPerson } from "@/lib/orgHierarchy";

const BRAND = "#3d6fa8";
const MATCH = "#f59e0b";

// Expand/collapse state shared between the chart and its toolbar.
export function useTreeExpansion(initial: Iterable<string> = []) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(initial));

  const toggle = useCallback((uid: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }, []);

  const expandMany = useCallback((ids: Iterable<string>) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
  }, []);

  const collapseAll = useCallback(() => setExpanded(new Set()), []);

  return { expanded, toggle, expandMany, collapseAll };
}

// Everyone above `uid` — the nodes that must be open for `uid` to be visible.
export function ancestorsOf(index: OrgIndex, uid: string): string[] {
  return getManagerChain(index, uid).map((p) => p.uid);
}

type FlowProps = {
  index: OrgIndex;
  rootIds: string[];
  expanded: Set<string>;
  onToggle: (uid: string) => void;
  currentUid?: string;
  selectedId?: string;
  onSelect?: (uid: string) => void;
  matchIds?: Set<string>;
  forceOpen?: Set<string>;
  visibleIds?: Set<string>;
  // false = no expand/collapse buttons (used for the employee's own line,
  // which is always fully open).
  showToggle?: boolean;
};

function Node({ uid, path, props }: { uid: string; path: string[]; props: FlowProps }) {
  const { index, expanded, onToggle, currentUid, selectedId, onSelect, matchIds, forceOpen, visibleIds, showToggle = true } = props;
  const person: OrgPerson | undefined = index.byId.get(uid);
  if (!person) return null;
  if (visibleIds && !visibleIds.has(uid)) return null;

  const kids = (index.children.get(uid) || []).filter(
    (c) => !path.includes(c) && c !== uid && (!visibleIds || visibleIds.has(c))
  );
  const isOpen = expanded.has(uid) || !!forceOpen?.has(uid);
  const isYou = uid === currentUid;

  const cls = [
    "of-card",
    isYou ? "of-you" : "",
    matchIds?.has(uid) ? "of-match" : "",
    uid === selectedId ? "of-selected" : "",
    onSelect ? "of-click" : "",
    person.active ? "" : "of-inactive",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <li>
      <div
        className={cls}
        onClick={onSelect ? () => onSelect(uid) : undefined}
        onKeyDown={(e) => {
          if (onSelect && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onSelect(uid);
          }
        }}
        role={onSelect ? "button" : undefined}
        tabIndex={onSelect ? 0 : undefined}
      >
        <PersonAvatar name={person.name} photo={person.photo} gender={person.gender} size={52} ring={isYou ? BRAND : undefined} />
        <div className="of-name">
          {person.name}
          {isYou && <span className="of-pill of-pill-you">YOU</span>}
          {!person.active && <span className="of-pill of-pill-off">Inactive</span>}
          {index.cyclic.has(uid) && <span className="of-pill of-pill-warn">Circular data</span>}
        </div>
        <div className="of-desig">{person.designation || "Designation not set"}</div>
        <div className="of-meta">{[person.department, person.role].filter(Boolean).join(" • ")}</div>
      </div>

      {showToggle && kids.length > 0 && (
        <button
          type="button"
          className="of-toggle"
          aria-expanded={isOpen}
          aria-label={`${isOpen ? "Collapse" : "Expand"} ${person.name}'s team`}
          onClick={() => onToggle(uid)}
        >
          {kids.length} {isOpen ? "▴" : "▾"}
        </button>
      )}

      {kids.length > 0 && isOpen && (
        <ul>
          {kids.map((c) => (
            <Node key={c} uid={c} path={[...path, uid]} props={props} />
          ))}
        </ul>
      )}
    </li>
  );
}

// Top-down flow chart: boxes joined by connector lines, the top of the
// organisation at the top. Scrolls sideways on narrow screens.
export function OrgFlowChart(props: FlowProps) {
  return (
    <>
      <FlowStyles />
      <div className="of-scroll">
        <ul className="of-root">
          {props.rootIds.map((id) => (
            <Node key={id} uid={id} path={[]} props={props} />
          ))}
        </ul>
      </div>
    </>
  );
}

function FlowStyles() {
  return (
    <style>{`
      .of-scroll { overflow-x: auto; padding: 8px 4px 16px; --of-line: var(--org-line, #9db7d6); }
      .of-root, .of-root ul { display: flex; justify-content: center; list-style: none; position: relative; margin: 0; }
      .of-root { width: max-content; margin: 0 auto; padding: 0; }
      .of-root ul { padding: 22px 0 0; }
      .of-root li { position: relative; list-style: none; text-align: center; padding: 22px 8px 0; display: flex; flex-direction: column; align-items: center; }
      .of-root > li { padding-top: 0; }
      .of-root li::before, .of-root li::after { content: ""; position: absolute; top: 0; right: 50%; width: 50%; height: 22px; border-top: 2px solid var(--of-line); }
      .of-root li::after { right: auto; left: 50%; border-left: 2px solid var(--of-line); }
      .of-root > li::before, .of-root > li::after { display: none; }
      .of-root li:only-child::before, .of-root li:only-child::after { display: none; }
      .of-root li:only-child { padding-top: 0; }
      .of-root li:first-child::before, .of-root li:last-child::after { border: 0 none; }
      .of-root li:last-child::before { border-right: 2px solid var(--of-line); border-radius: 0 8px 0 0; }
      .of-root li:first-child::after { border-radius: 8px 0 0 0; }
      .of-root ul::before { content: ""; position: absolute; top: 0; left: 50%; height: 22px; border-left: 2px solid var(--of-line); }

      .of-card { width: 188px; box-sizing: border-box; padding: 12px 10px; border-radius: 16px; background: var(--card-bg); color: var(--text-color); border: 1px solid var(--border-color); box-shadow: 0 6px 18px rgba(15,23,42,.08); display: flex; flex-direction: column; align-items: center; gap: 4px; transition: box-shadow .15s ease, transform .15s ease; }
      .of-click { cursor: pointer; }
      .of-click:hover { box-shadow: 0 10px 24px rgba(61,111,168,.22); transform: translateY(-1px); }
      .of-click:focus-visible { outline: 2px solid ${BRAND}; outline-offset: 2px; }
      .of-you { border: 2px solid ${BRAND}; background: rgba(61,111,168,.1); }
      .of-match { border-color: ${MATCH}; box-shadow: 0 0 0 3px rgba(245,158,11,.28); }
      .of-selected { border-color: ${BRAND}; box-shadow: 0 0 0 3px rgba(61,111,168,.28); }
      .of-inactive { opacity: .72; }
      .of-name { font-weight: 800; font-size: 14px; line-height: 1.25; margin-top: 4px; overflow-wrap: anywhere; display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; align-items: center; }
      .of-desig { font-size: 12.5px; font-weight: 700; color: ${BRAND}; overflow-wrap: anywhere; }
      .of-meta { font-size: 11.5px; color: var(--text-muted); overflow-wrap: anywhere; }
      .of-pill { font-size: 9.5px; font-weight: 800; letter-spacing: .04em; padding: 2px 7px; border-radius: 999px; }
      .of-pill-you { background: ${BRAND}; color: #fff; }
      .of-pill-off { background: rgba(220,38,38,.14); color: #dc2626; }
      .of-pill-warn { background: rgba(245,158,11,.2); color: #b45309; }
      .of-toggle { margin-top: 6px; border: 1px solid var(--border-color); background: var(--icon-bg); color: var(--text-color); border-radius: 999px; padding: 3px 12px; font-size: 12px; font-weight: 700; cursor: pointer; }
      .of-toggle:hover { background: var(--hover-bg); }
      @media (max-width: 600px) { .of-card { width: 160px; } }
      @media (prefers-reduced-motion: reduce) { .of-card { transition: none; } }
    `}</style>
  );
}
