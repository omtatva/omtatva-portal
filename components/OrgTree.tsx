"use client";

import { useCallback, useState } from "react";
import PersonAvatar from "./PersonAvatar";
import { getManagerChain, type OrgIndex, type OrgPerson } from "@/lib/orgHierarchy";

const BRAND = "#3d6fa8";
const MATCH = "#f59e0b";

// Expand/collapse state for a tree, shared between OrgTree and whatever
// toolbar (Expand all / Collapse all / jump-to-me) sits above it.
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

export function PersonCard({
  person,
  directReports,
  isYou,
  isMatch,
  isSelected,
  expandable,
  isOpen,
  onToggle,
  onSelect,
  badge,
}: {
  person: OrgPerson;
  directReports: number;
  isYou?: boolean;
  isMatch?: boolean;
  isSelected?: boolean;
  expandable?: boolean;
  isOpen?: boolean;
  onToggle?: () => void;
  onSelect?: () => void;
  badge?: string;
}) {
  const cls = [
    "org-card",
    isYou ? "org-card-you" : "",
    isMatch ? "org-card-match" : "",
    isSelected ? "org-card-selected" : "",
    onSelect ? "org-card-clickable" : "",
    person.active ? "" : "org-card-inactive",
  ]
    .filter(Boolean)
    .join(" ");

  const meta = [person.department, person.role].filter(Boolean);

  return (
    <div
      className={cls}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (onSelect && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onSelect();
        }
      }}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
    >
      <PersonAvatar
        name={person.name}
        photo={person.photo}
        gender={person.gender}
        size={48}
        ring={isYou ? BRAND : undefined}
      />

      <div className="org-card-text">
        <div className="org-card-name">
          <span className="org-card-name-text">{person.name}</span>
          {isYou && <span className="org-pill org-pill-you">YOU</span>}
          {badge && <span className="org-pill org-pill-info">{badge}</span>}
          {!person.active && <span className="org-pill org-pill-off">Inactive</span>}
        </div>
        <div className="org-card-designation">
          {person.designation || "Designation not set"}
        </div>
        {meta.length > 0 && <div className="org-card-meta">{meta.join(" • ")}</div>}
      </div>

      {expandable && (
        <button
          type="button"
          className="org-toggle"
          aria-expanded={!!isOpen}
          aria-label={`${isOpen ? "Collapse" : "Expand"} ${person.name}'s team`}
          onClick={(e) => {
            e.stopPropagation();
            onToggle?.();
          }}
        >
          <span className="org-toggle-count">{directReports}</span>
          <span className={`org-toggle-chevron ${isOpen ? "open" : ""}`}>▾</span>
        </button>
      )}
    </div>
  );
}

type TreeProps = {
  index: OrgIndex;
  rootIds: string[];
  expanded: Set<string>;
  onToggle: (uid: string) => void;
  currentUid?: string;
  selectedId?: string;
  onSelect?: (uid: string) => void;
  matchIds?: Set<string>;
  // Nodes kept open regardless of the user's own expand state (search).
  forceOpen?: Set<string>;
  // Only render the nodes in this set (and keep structure) — used by search
  // filtering. Undefined = render everything.
  visibleIds?: Set<string>;
};

function Branch({
  uid,
  path,
  props,
}: {
  uid: string;
  path: string[];
  props: TreeProps;
}) {
  const { index, expanded, onToggle, currentUid, selectedId, onSelect, matchIds, forceOpen, visibleIds } = props;
  const person = index.byId.get(uid);
  if (!person) return null;
  if (visibleIds && !visibleIds.has(uid)) return null;

  // `path` guards against circular data in Firestore: never descend into
  // someone we are already beneath.
  const kids = (index.children.get(uid) || []).filter(
    (c) => !path.includes(c) && c !== uid && (!visibleIds || visibleIds.has(c))
  );
  const isOpen = expanded.has(uid) || !!forceOpen?.has(uid);

  return (
    <li className="org-item">
      <PersonCard
        person={person}
        directReports={kids.length}
        isYou={uid === currentUid}
        isMatch={matchIds?.has(uid)}
        isSelected={uid === selectedId}
        expandable={kids.length > 0}
        isOpen={isOpen}
        onToggle={() => onToggle(uid)}
        onSelect={onSelect ? () => onSelect(uid) : undefined}
        badge={index.cyclic.has(uid) ? "Circular data" : undefined}
      />

      {kids.length > 0 && isOpen && (
        <ul className="org-children">
          {kids.map((c) => (
            <Branch key={c} uid={c} path={[...path, uid]} props={props} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function OrgTree(props: TreeProps) {
  return (
    <>
      <OrgTreeStyles />
      <ul className="org-roots">
        {props.rootIds.map((id) => (
          <Branch key={id} uid={id} path={[]} props={props} />
        ))}
      </ul>
    </>
  );
}

export function OrgTreeStyles() {
  return (
    <style>{`
      .org-roots, .org-children { list-style: none; margin: 0; padding: 0; }
      .org-item { position: relative; padding-top: 10px; }
      .org-children { margin-left: 36px; }
      .org-children > .org-item { padding-left: 26px; }
      .org-children > .org-item::before {
        content: ""; position: absolute; left: 0; top: 0; bottom: 0;
        border-left: 2px solid var(--org-line, #c6d8ee);
      }
      .org-children > .org-item:last-child::before { bottom: auto; height: 46px; }
      .org-children > .org-item::after {
        content: ""; position: absolute; left: 0; top: 46px; width: 26px;
        border-top: 2px solid var(--org-line, #c6d8ee);
      }

      .org-card {
        display: flex; align-items: center; gap: 12px; padding: 12px 14px;
        background: var(--card-bg); color: var(--text-color);
        border: 1px solid var(--border-color); border-radius: 16px;
        box-shadow: 0 4px 14px rgba(15, 23, 42, 0.06);
        min-height: 72px; box-sizing: border-box; max-width: 560px;
        transition: box-shadow .15s ease, border-color .15s ease, transform .15s ease;
      }
      .org-card-clickable { cursor: pointer; }
      .org-card-clickable:hover { box-shadow: 0 8px 22px rgba(61, 111, 168, 0.18); transform: translateY(-1px); }
      .org-card-clickable:focus-visible { outline: 2px solid ${BRAND}; outline-offset: 2px; }
      .org-card-you { border: 2px solid ${BRAND}; background: rgba(61, 111, 168, 0.1); }
      .org-card-match { border-color: ${MATCH}; box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.28); }
      .org-card-selected { border-color: ${BRAND}; box-shadow: 0 0 0 3px rgba(61, 111, 168, 0.28); }
      .org-card-inactive { opacity: 0.72; }

      .org-card-text { min-width: 0; flex: 1; }
      .org-card-name { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; font-weight: 700; font-size: 15px; line-height: 1.25; }
      .org-card-name-text { overflow-wrap: anywhere; }
      .org-card-designation { font-size: 13.5px; font-weight: 600; color: ${BRAND}; margin-top: 2px; overflow-wrap: anywhere; }
      .org-card-meta { font-size: 12.5px; color: var(--text-muted); margin-top: 2px; overflow-wrap: anywhere; }

      .org-pill { font-size: 10.5px; font-weight: 800; letter-spacing: .04em; padding: 2px 8px; border-radius: 999px; }
      .org-pill-you { background: ${BRAND}; color: #fff; }
      .org-pill-info { background: rgba(245, 158, 11, 0.18); color: #b45309; }
      .org-pill-off { background: rgba(220, 38, 38, 0.14); color: #dc2626; }

      .org-toggle {
        display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0;
        border: 1px solid var(--border-color); background: var(--icon-bg); color: var(--text-color);
        border-radius: 999px; padding: 5px 10px; font-size: 12.5px; font-weight: 700; cursor: pointer;
      }
      .org-toggle:hover { background: var(--hover-bg); }
      .org-toggle-chevron { transition: transform .15s ease; display: inline-block; }
      .org-toggle-chevron.open { transform: rotate(180deg); }

      @media (max-width: 600px) {
        .org-children { margin-left: 28px; }
        .org-children > .org-item { padding-left: 18px; }
        .org-children > .org-item::after { width: 18px; }
        .org-card { padding: 10px; gap: 10px; }
      }
      @media (prefers-reduced-motion: reduce) {
        .org-card, .org-toggle-chevron { transition: none; }
      }
    `}</style>
  );
}
