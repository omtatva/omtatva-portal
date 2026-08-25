"use client";

import { useEffect, useState } from "react";
import { listAdminAccess, upsertAdminAccess, removeAdminAccess } from "@/lib/adminAccess";
import { ROLES } from "@/lib/roles";
import { MODULES, getPermissionMatrix, savePermissionMatrix } from "@/lib/permissions";

export default function AccessManagementPage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState(ROLES[1].value); // default to "hr"

  const [matrix, setMatrix] = useState({});
  const [matrixLoading, setMatrixLoading] = useState(true);
  const [matrixSaving, setMatrixSaving] = useState(false);

  useEffect(() => {
    load();
    loadMatrix();
  }, []);

  async function load() {
    setLoading(true);
    try {
      setEntries(await listAdminAccess());
    } catch (err) {
      console.error("LOAD ADMIN ACCESS ERROR:", err);
      setError("Couldn't load access list. Refresh and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function loadMatrix() {
    setMatrixLoading(true);
    try {
      setMatrix(await getPermissionMatrix());
    } catch (err) {
      console.error("LOAD PERMISSIONS ERROR:", err);
      setError("Couldn't load module permissions. Refresh and try again.");
    } finally {
      setMatrixLoading(false);
    }
  }

  async function togglePermission(role, moduleKey) {
    if (matrixSaving) return;
    const current = matrix[role]?.[moduleKey] || "edit";
    const next = current === "edit" ? "view" : "edit";

    const previous = matrix;
    const updated = {
      ...matrix,
      [role]: { ...matrix[role], [moduleKey]: next },
    };
    setMatrix(updated); // optimistic

    setMatrixSaving(true);
    setError("");
    try {
      await savePermissionMatrix(updated);
    } catch (err) {
      console.error("SAVE PERMISSIONS ERROR:", err);
      setError("Couldn't save that permission change. Try again.");
      setMatrix(previous); // roll back
    } finally {
      setMatrixSaving(false);
    }
  }

  async function addPerson() {
    if (saving) return;
    const email = newEmail.trim().toLowerCase();
    if (!email) return;

    if (entries.some((e) => e.email === email)) {
      setError("This email already has access — edit their role in the table below instead.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await upsertAdminAccess(email, newRole);
      setNewEmail("");
      await load();
    } catch (err) {
      console.error("ADD ADMIN ACCESS ERROR:", err);
      setError("Couldn't grant access — it was not saved. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function changeRole(email, role) {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await upsertAdminAccess(email, role);
      await load();
    } catch (err) {
      console.error("UPDATE ADMIN ACCESS ERROR:", err);
      setError("Couldn't update that role — it was not saved. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function removePerson(email) {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await removeAdminAccess(email);
      await load();
    } catch (err) {
      console.error("REMOVE ADMIN ACCESS ERROR:", err);
      setError("Couldn't remove that access — it was not saved. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <CenteredMessage text="Loading access settings..." />;
  }

  return (
    <div style={{ padding: 25, maxWidth: 900 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8, color: "var(--text-color)" }}>
        🔐 Access Management
      </h1>
      <p style={{ color: "var(--text-muted)", marginBottom: 12 }}>
        Grant or change admin dashboard access by email — no code changes needed. Everyone
        listed here can sign in at <code>/admin/login</code> with the role you assign; anyone
        not listed only gets regular employee access.
        {saving && <span style={{ color: "#3d6fa8", marginLeft: 10 }}>Saving...</span>}
      </p>

      {error && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
            padding: "12px 16px",
            borderRadius: 10,
            marginBottom: 20,
            fontSize: 13.5,
            fontWeight: 600,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span>{error}</span>
          <button
            onClick={() => setError("")}
            style={{
              background: "none",
              border: "none",
              color: "#b91c1c",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>
      )}

      <Section
        title="Grant Access"
        subtitle="Add someone by email and pick the role they should have."
      >
        <div style={{ display: "flex", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
          <input
            placeholder="name@company.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addPerson()}
            disabled={saving}
            style={{ ...inputStyle, minWidth: 220 }}
          />
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            disabled={saving}
            style={{ ...inputStyle, flex: "0 0 180px" }}
          >
            {ROLES.filter((r) => r.adminTier).map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <button onClick={addPerson} disabled={saving} style={addBtnStyle(saving)}>
            + Grant Access
          </button>
        </div>
      </Section>

      <Section
        title="Current Access"
        subtitle="Everyone with admin-tier access right now. Change a role or remove access any time."
      >
        {entries.length === 0 ? (
          <EmptyRow text="No one has admin access yet — grant it above." />
        ) : (
          entries.map((entry) => (
            <div
              key={entry.email}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 16px",
                background: "var(--table-row-alt)",
                borderRadius: 10,
                marginBottom: 8,
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <span style={{ fontWeight: 600, color: "var(--text-color)", fontSize: 14.5 }}>
                {entry.email}
              </span>

              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <select
                  value={entry.role}
                  onChange={(e) => changeRole(entry.email, e.target.value)}
                  disabled={saving}
                  style={{ ...inputStyle, padding: "8px 10px", width: "auto" }}
                >
                  {ROLES.filter((r) => r.adminTier).map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => removePerson(entry.email)}
                  disabled={saving}
                  style={{
                    background: "none",
                    border: "none",
                    color: saving ? "#fca5a5" : "#dc2626",
                    fontWeight: 600,
                    cursor: saving ? "default" : "pointer",
                    fontSize: 13.5,
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </Section>

      <Section
        title="Module Permissions"
        subtitle="Per-role, per-page: View means they can open the page and see data; Edit means the save/approve/reject/delete/upload actions on it are enabled. Super Admin always has Edit everywhere, regardless of what's set here."
      >
        {matrixLoading ? (
          <EmptyRow text="Loading permissions..." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Module</th>
                  {ROLES.filter((r) => r.adminTier && !r.isSuperAdmin).map((r) => (
                    <th key={r.value} style={thStyle}>
                      {r.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MODULES.map((mod) => (
                  <tr key={mod.key}>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{mod.label}</td>
                    {ROLES.filter((r) => r.adminTier && !r.isSuperAdmin).map((r) => {
                      const level = matrix[r.value]?.[mod.key] || "edit";
                      const isEdit = level === "edit";
                      return (
                        <td key={r.value} style={tdStyle}>
                          <button
                            onClick={() => togglePermission(r.value, mod.key)}
                            disabled={matrixSaving}
                            style={{
                              background: isEdit ? "#dcfce7" : "#f1f5f9",
                              color: isEdit ? "#166534" : "#475569",
                              border: "none",
                              padding: "6px 14px",
                              borderRadius: 999,
                              fontWeight: 700,
                              fontSize: 12.5,
                              cursor: matrixSaving ? "default" : "pointer",
                              minWidth: 64,
                            }}
                          >
                            {isEdit ? "✏️ Edit" : "👁 View"}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <div
      style={{
        background: "var(--card-bg)",
        borderRadius: 16,
        padding: 28,
        marginBottom: 24,
        boxShadow: "0 5px 20px rgba(0,0,0,.05)",
      }}
    >
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--text-color)" }}>
        {title}
      </h2>
      <p style={{ color: "var(--text-muted)", fontSize: 13.5, marginTop: 4, marginBottom: 20 }}>
        {subtitle}
      </p>
      {children}
    </div>
  );
}

function EmptyRow({ text }) {
  return <p style={{ color: "var(--text-muted)", fontSize: 13.5 }}>{text}</p>;
}

function CenteredMessage({ text }) {
  return (
    <div style={{ padding: 60, textAlign: "center", color: "var(--text-muted)" }}>
      <h2>{text}</h2>
    </div>
  );
}

const inputStyle = {
  flex: 1,
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid var(--border-color)",
  background: "var(--card-bg)",
  color: "var(--text-color)",
  fontSize: 14,
  outline: "none",
};

const thStyle = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: 12.5,
  fontWeight: 700,
  color: "var(--text-muted)",
  borderBottom: "1px solid var(--border-color)",
  textTransform: "uppercase",
  letterSpacing: 0.3,
};

const tdStyle = {
  padding: "10px 12px",
  fontSize: 13.5,
  color: "var(--text-color)",
  borderBottom: "1px solid var(--border-color)",
};

const addBtnStyle = (saving) => ({
  background: saving ? "#94a3b8" : "#3d6fa8",
  color: "#fff",
  border: "none",
  padding: "12px 22px",
  borderRadius: 10,
  fontWeight: 700,
  cursor: saving ? "default" : "pointer",
  fontSize: 14,
});
