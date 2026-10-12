"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

export type Person = {
  uid: string;
  name: string;
  email: string;
  employeeId?: string;
  designation?: string;
  department?: string;
};

// (Distinct from PersonPicker, which picks reporting managers on the Hierarchy page.)
// A text box that suggests employees as you type — by name, e-mail, employee ID
// or designation. Choosing one fills in their e-mail address; typing a plain
// e-mail address by hand still works.
export default function EmailPersonPicker({
  value,
  onChange,
  people,
  existingRoles = {},
  placeholder = "Search by name or email",
  disabled,
  onEnter,
  style,
}: {
  value: string;
  onChange: (email: string) => void;
  people: Person[];
  existingRoles?: Record<string, string>; // lowercased e-mail -> role label already assigned
  placeholder?: string;
  disabled?: boolean;
  onEnter?: () => void;
  style?: CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [picked, setPicked] = useState<Person | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const q = value.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!q || (picked && picked.email.toLowerCase() === q)) return [];
    const words = q.split(/\s+/);
    return people
      .map((p) => {
        const hay = `${p.name} ${p.email} ${p.employeeId || ""} ${p.designation || ""} ${p.department || ""}`.toLowerCase();
        if (!words.every((w) => hay.includes(w))) return null;
        // names that START with the text rank first
        const rank = p.name.toLowerCase().startsWith(q) ? 0 : p.name.toLowerCase().includes(q) ? 1 : 2;
        return { p, rank };
      })
      .filter((x): x is { p: Person; rank: number } => x !== null)
      .sort((a, b) => a.rank - b.rank || a.p.name.localeCompare(b.p.name))
      .slice(0, 8)
      .map((x) => x.p);
  }, [q, people, picked]);

  // close when clicking elsewhere
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const choose = (p: Person) => {
    setPicked(p);
    onChange(p.email);
    setOpen(false);
  };

  return (
    <div ref={box} style={{ position: "relative", flex: "1 1 260px", minWidth: 220 }}>
      <input
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        role="combobox"
        aria-controls="email-person-suggestions"
        aria-expanded={open && matches.length > 0}
        aria-autocomplete="list"
        onChange={(e) => {
          setPicked(null);
          onChange(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && matches.length) {
            e.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(i + 1, matches.length - 1));
          } else if (e.key === "ArrowUp" && matches.length) {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Escape") {
            setOpen(false);
          } else if (e.key === "Enter") {
            if (open && matches.length) {
              e.preventDefault();
              choose(matches[Math.min(active, matches.length - 1)]);
            } else {
              onEnter?.();
            }
          }
        }}
        style={{ ...style, width: "100%", boxSizing: "border-box" }}
      />

      {picked && picked.email.toLowerCase() === q && (
        <div style={{ fontSize: 12.5, color: "#475569", marginTop: 4 }}>
          ✓ {picked.name}
          {picked.designation ? ` · ${picked.designation}` : ""}
          {picked.employeeId ? ` · ${picked.employeeId}` : ""}
          {existingRoles[q] ? ` · already has the role “${existingRoles[q]}”` : ""}
        </div>
      )}

      {open && matches.length > 0 && (
        <ul
          id="email-person-suggestions"
          role="listbox"
          style={{
            position: "absolute", zIndex: 30, left: 0, right: 0, top: "calc(100% + 4px)", margin: 0, padding: 4, listStyle: "none",
            background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, boxShadow: "0 12px 30px rgba(15,23,42,.15)", maxHeight: 320, overflowY: "auto",
          }}
        >
          {matches.map((p, i) => (
            <li
              key={p.uid}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); choose(p); }}
              onMouseEnter={() => setActive(i)}
              style={{ padding: "9px 12px", borderRadius: 8, cursor: "pointer", background: i === active ? "#eff6ff" : "transparent" }}
            >
              <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 14 }}>
                {p.name}
                {existingRoles[p.email.toLowerCase()] && (
                  <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: "#92400e", background: "#fef3c7", padding: "1px 8px", borderRadius: 999 }}>
                    {existingRoles[p.email.toLowerCase()]}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12.5, color: "#64748b" }}>
                {p.email}
                {p.employeeId ? ` · ${p.employeeId}` : ""}
                {p.designation ? ` · ${p.designation}` : ""}
              </div>
            </li>
          ))}
        </ul>
      )}

      {open && q.length >= 2 && matches.length === 0 && !q.includes("@") && (
        <div style={{ position: "absolute", zIndex: 30, left: 0, right: 0, top: "calc(100% + 4px)", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "10px 12px", fontSize: 13, color: "#64748b" }}>
          No employee found for “{value.trim()}”. You can also type a full e-mail address.
        </div>
      )}
    </div>
  );
}
