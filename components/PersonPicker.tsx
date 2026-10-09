"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import PersonAvatar from "./PersonAvatar";
import type { OrgPerson } from "@/lib/orgHierarchy";

const BRAND = "#3d6fa8";
const NONE = "__none__";

type Props = {
  options: OrgPerson[];
  selected: string[];
  onChange: (ids: string[]) => void;
  placeholder: string;
  multiple?: boolean;
  // Single mode only: adds an explicit "no value" row, e.g. "No manager".
  clearLabel?: string;
  // Return a reason to show the row greyed-out and unselectable.
  disabledReason?: (p: OrgPerson) => string | undefined;
  disabled?: boolean;
  ariaLabel: string;
};

// Searchable dropdown (combobox) of people with photos. Works for one
// choice (manager) or many (the employees being assigned).
export default function PersonPicker({
  options,
  selected,
  onChange,
  placeholder,
  multiple,
  clearLabel,
  disabledReason,
  disabled,
  ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setText("");
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const byId = useMemo(() => new Map(options.map((p) => [p.uid, p])), [options]);

  const rows = useMemo(() => {
    const needle = text.trim().toLowerCase();
    const filtered = options.filter(
      (p) =>
        !needle ||
        [p.name, p.email, p.employeeId, p.designation, p.department]
          .join(" ")
          .toLowerCase()
          .includes(needle)
    );
    const list: { key: string; person?: OrgPerson }[] = [];
    if (!multiple && clearLabel && !needle) list.push({ key: NONE });
    filtered.forEach((p) => list.push({ key: p.uid, person: p }));
    return list;
  }, [options, text, multiple, clearLabel]);

  const activeIdx = Math.min(active, Math.max(rows.length - 1, 0));

  const choose = (key: string) => {
    if (key === NONE) {
      onChange([]);
      setOpen(false);
      setText("");
      return;
    }
    const person = byId.get(key);
    if (!person || disabledReason?.(person)) return;

    if (multiple) {
      onChange(selected.includes(key) ? selected.filter((s) => s !== key) : [...selected, key]);
      setText("");
    } else {
      onChange([key]);
      setOpen(false);
      setText("");
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive(Math.min(activeIdx + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(activeIdx - 1, 0));
    } else if (e.key === "Enter" && open && rows[activeIdx]) {
      e.preventDefault();
      choose(rows[activeIdx].key);
    } else if (e.key === "Escape") {
      setOpen(false);
      setText("");
    } else if (e.key === "Backspace" && multiple && !text && selected.length) {
      onChange(selected.slice(0, -1));
    }
  };

  const single = !multiple ? byId.get(selected[0] || "") : undefined;
  const showSingle = !multiple && single && !text && !open;

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <div
        onClick={() => !disabled && setOpen(true)}
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 6,
          minHeight: 46,
          padding: "5px 10px",
          borderRadius: 12,
          border: `1px solid ${open ? BRAND : "var(--border-color)"}`,
          background: disabled ? "var(--icon-bg)" : "var(--bg-color)",
          boxSizing: "border-box",
          cursor: disabled ? "not-allowed" : "text",
          opacity: disabled ? 0.75 : 1,
        }}
      >
        {multiple &&
          selected.map((id) => {
            const p = byId.get(id);
            if (!p) return null;
            return (
              <span
                key={id}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "3px 6px 3px 4px",
                  borderRadius: 999,
                  background: "var(--hover-bg)",
                  border: "1px solid var(--border-color)",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--text-color)",
                }}
              >
                <PersonAvatar name={p.name} photo={p.photo} gender={p.gender} size={22} />
                {p.name}
                <button
                  type="button"
                  aria-label={`Remove ${p.name}`}
                  disabled={disabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(selected.filter((s) => s !== id));
                  }}
                  style={{
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    color: "var(--text-muted)",
                    fontSize: 15,
                    lineHeight: 1,
                    padding: 0,
                  }}
                >
                  ×
                </button>
              </span>
            );
          })}

        {showSingle && single && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--text-color)" }}>
            <PersonAvatar name={single.name} photo={single.photo} gender={single.gender} size={28} />
            <span style={{ fontWeight: 600, fontSize: 14 }}>{single.name}</span>
            <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{single.designation}</span>
          </span>
        )}

        <input
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={ariaLabel}
          aria-autocomplete="list"
          disabled={disabled}
          value={text}
          onFocus={() => !disabled && setOpen(true)}
          onChange={(e) => {
            setText(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          placeholder={
            multiple ? (selected.length ? "Add another…" : placeholder) : showSingle ? "" : placeholder
          }
          style={{
            flex: 1,
            minWidth: showSingle ? 8 : 120,
            border: "none",
            outline: "none",
            background: "transparent",
            color: "var(--text-color)",
            fontSize: 14,
            height: 34,
          }}
        />

      </div>

      {open && !disabled && (
        <ul
          id={listId}
          role="listbox"
          style={{
            position: "absolute",
            zIndex: 30,
            left: 0,
            right: 0,
            top: "calc(100% + 6px)",
            margin: 0,
            padding: 6,
            listStyle: "none",
            maxHeight: 300,
            overflowY: "auto",
            background: "var(--card-bg)",
            border: "1px solid var(--border-color)",
            borderRadius: 14,
            boxShadow: "0 16px 40px rgba(15,23,42,.18)",
          }}
        >
          {rows.length === 0 && (
            <li style={{ padding: "12px 14px", color: "var(--text-muted)", fontSize: 14 }}>
              No matching employees
            </li>
          )}
          {rows.map((row, i) => {
            const p = row.person;
            const reason = p ? disabledReason?.(p) : undefined;
            const isSelected = p ? selected.includes(p.uid) : selected.length === 0;
            return (
              <li
                key={row.key}
                role="option"
                aria-selected={isSelected}
                aria-disabled={!!reason}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(row.key)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  borderRadius: 10,
                  cursor: reason ? "not-allowed" : "pointer",
                  opacity: reason ? 0.5 : 1,
                  background: i === activeIdx ? "var(--hover-bg)" : "transparent",
                  color: "var(--text-color)",
                }}
              >
                {p ? (
                  <>
                    <PersonAvatar name={p.name} photo={p.photo} gender={p.gender} size={34} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, overflowWrap: "anywhere" }}>
                        {p.name}
                        {!p.active && (
                          <span style={{ marginLeft: 6, fontSize: 11, color: "#dc2626" }}>Inactive</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--text-muted)", overflowWrap: "anywhere" }}>
                        {[p.designation || "No designation", p.department].filter(Boolean).join(" • ")}
                      </div>
                      {reason && (
                        <div style={{ fontSize: 12, color: "#c2410c", marginTop: 2 }}>{reason}</div>
                      )}
                    </div>
                    {isSelected && <span style={{ color: BRAND, fontWeight: 800 }}>✓</span>}
                  </>
                ) : (
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{clearLabel}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
