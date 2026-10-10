"use client";

import { useCallback, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { ApiClientError, getJson, postJson } from "@/lib/reportsClient";
import { RATINGS, MAX_COMMENT, ratingInfo, type RatingValue } from "@/lib/performance";

type Person = {
  uid: string; employeeId: string; name: string; designation: string; department: string; role: string; direct: boolean;
  rating: { value: string; score: number; comment: string; status: "pending" | "approved" | "rejected"; submittedByName: string; submittedAt: string | null; reviewNote: string } | null;
  published: { rating: string; comment: string; ratedBy: string } | null;
};
type Pending = { id: string; period: string; employeeUid: string; employeeId: string; employeeName: string; rating: string; comment: string; submittedByName: string; submittedAt: string | null; previous: string | null };
type Overview = { period: string; currentPeriod: string; role: string; roleLabel: string; submitsForApproval: boolean; myApprover: string | null; people: Person[]; pending: Pending[] };

const msg = (e: unknown) => (e instanceof ApiClientError || e instanceof Error ? e.message : "Something went wrong.");
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthLabel = (p: string) => `${MONTHS[Number(p.slice(5, 7)) - 1]} ${p.slice(0, 4)}`;
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]?.toUpperCase()).join("") || "?";
const color = (v: string | null | undefined) => ratingInfo(v)?.color || "#64748b";

function Pill({ value }: { value: string }) {
  const c = color(value);
  return <span className="px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: `${c}18`, color: c, border: `1px solid ${c}55` }}>{ratingInfo(value)?.emoji} {value}</span>;
}

export default function PerformancePage() {
  const [data, setData] = useState<Overview | null>(null);
  const [period, setPeriod] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [draft, setDraft] = useState<Record<string, { rating: RatingValue | ""; comment: string }>>({});
  const [note, setNote] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");

  const load = useCallback(async (p?: string) => {
    try {
      const r = await getJson<Overview>(`/api/performance/overview${p ? `?period=${p}` : ""}`);
      setData(r);
      setPeriod(r.period);
      setError("");
    } catch (e) {
      setError(msg(e));
    }
  }, []);

  useEffect(() => {
    const off = onAuthStateChanged(auth, (u) => {
      if (!u) { window.location.href = "/login"; return; }
      load();
    });
    return () => off();
  }, [load]);

  const act = async (key: string, fn: () => Promise<string>) => {
    setBusy(key); setError(""); setNotice("");
    try { setNotice(await fn()); await load(period); } catch (e) { setError(msg(e)); } finally { setBusy(""); }
  };

  const months = (() => {
    if (!data) return [] as string[];
    const out: string[] = [];
    let [y, m] = data.currentPeriod.split("-").map(Number);
    for (let i = 0; i < 12; i++) { out.push(`${y}-${String(m).padStart(2, "0")}`); m -= 1; if (m === 0) { m = 12; y -= 1; } }
    return out;
  })();

  if (error && !data) return <div className="max-w-3xl mx-auto p-8"><div className="p-4 rounded-xl bg-red-50 text-red-700">{error}</div></div>;
  if (!data) return <div className="p-10 text-gray-500">Loading…</div>;

  const people = data.people.filter((p) => !search || `${p.name} ${p.employeeId} ${p.designation}`.toLowerCase().includes(search.toLowerCase()));
  const rated = data.people.filter((p) => p.rating).length;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-8 space-y-6">
      <div className="rounded-3xl p-6 sm:p-8 text-white" style={{ background: "linear-gradient(135deg,#1e3a8a 0%,#4f46e5 55%,#9333ea 100%)" }}>
        <h1 className="text-2xl sm:text-3xl font-extrabold">⭐ Team Performance</h1>
        <p className="opacity-90 mt-1">
          {data.roleLabel} · you can rate {data.people.length} {data.people.length === 1 ? "person" : "people"}
          {data.submitsForApproval ? " — your ratings go to your manager for approval before the employee sees them." : " — your ratings are published to the employee's dashboard straight away."}
        </p>
        <div className="flex flex-wrap gap-3 mt-4 items-center">
          <label className="text-sm font-semibold">Review month
            <select value={period} onChange={(e) => load(e.target.value)} className="ml-2 rounded-lg px-3 py-1.5 text-gray-900">
              {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
          </label>
          <span className="px-3 py-1 rounded-full bg-white/20 text-sm">{rated} of {data.people.length} rated for {monthLabel(period)}</span>
          {data.submitsForApproval && <span className="px-3 py-1 rounded-full bg-white/20 text-sm">Approver: {data.myApprover || "Head / Admin"}</span>}
        </div>
      </div>

      {error && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm" role="alert">{error}</div>}
      {notice && <div className="p-3 rounded-xl bg-green-50 text-green-800 text-sm" role="status">{notice}</div>}

      {data.pending.length > 0 && (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 space-y-3">
          <h2 className="font-bold text-lg">📝 Waiting for your approval ({data.pending.length})</h2>
          <p className="text-sm text-gray-700">Team Lead ratings are shown to the employee only after you approve them.</p>
          {data.pending.map((p) => (
            <div key={p.id} className="rounded-xl bg-white p-4 shadow-sm flex flex-wrap gap-4 justify-between">
              <div className="min-w-[240px] space-y-1">
                <div className="font-semibold">{p.employeeName} <span className="text-gray-500 font-normal">({p.employeeId})</span></div>
                <div className="text-sm text-gray-600">{monthLabel(p.period)} · proposed by {p.submittedByName}</div>
                <div className="flex items-center gap-2"><Pill value={p.rating} />{p.previous && <span className="text-xs text-gray-500">currently shown: {p.previous}</span>}</div>
                {p.comment && <p className="text-sm italic text-gray-700">“{p.comment}”</p>}
              </div>
              <div className="flex flex-col gap-2 w-full sm:w-72">
                <input value={note[p.id] || ""} onChange={(e) => setNote({ ...note, [p.id]: e.target.value })} placeholder="Reason (needed to send back)" className="border rounded-lg px-3 py-2 text-sm" />
                <div className="flex gap-2">
                  <button disabled={!!busy} onClick={() => act(`a${p.id}`, async () => { await postJson("/api/performance/review", { id: p.id, decision: "approve", note: note[p.id] || "" }); return `Approved — ${p.employeeName} can now see the rating.`; })} className="flex-1 px-3 py-2 rounded-lg bg-green-600 text-white font-semibold disabled:opacity-50">Approve</button>
                  <button disabled={!!busy || (note[p.id] || "").trim().length < 5} onClick={() => act(`r${p.id}`, async () => { await postJson("/api/performance/review", { id: p.id, decision: "reject", note: note[p.id] }); return "Sent back to the team lead."; })} className="flex-1 px-3 py-2 rounded-lg bg-white border border-red-300 text-red-700 font-semibold disabled:opacity-50">Send back</button>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <h2 className="font-bold text-lg">Your people — {monthLabel(period)}</h2>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, ID, designation…" className="border rounded-lg px-3 py-2 text-sm w-64" />
        </div>
        {data.people.length === 0 && (
          <div className="rounded-2xl bg-white p-8 text-center text-gray-600 shadow">
            Nobody is assigned to report to you yet. Ask an admin to set reporting managers under Admin → Users → Reporting Structure.
          </div>
        )}
        <div className="grid md:grid-cols-2 gap-4">
          {people.map((p) => {
            const d = draft[p.uid] || { rating: (p.rating?.value as RatingValue) || "", comment: p.rating?.comment || "" };
            const changed = !p.rating || d.rating !== p.rating.value || d.comment !== p.rating.comment || p.rating.status === "rejected";
            return (
              <div key={p.uid} className="rounded-2xl bg-white shadow p-5 space-y-3 border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold" style={{ background: "linear-gradient(135deg,#4f46e5,#9333ea)" }}>{initials(p.name)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate">{p.name}</div>
                    <div className="text-xs text-gray-500 truncate">{p.employeeId} · {p.designation || p.role}{p.department ? ` · ${p.department}` : ""}</div>
                  </div>
                  {p.rating ? (
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${p.rating.status === "approved" ? "bg-green-100 text-green-800" : p.rating.status === "pending" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-700"}`}>
                      {p.rating.status === "approved" ? "Published" : p.rating.status === "pending" ? "Awaiting approval" : "Sent back"}
                    </span>
                  ) : <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">Not rated</span>}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {RATINGS.map((r) => (
                    <button key={r.value} type="button" onClick={() => setDraft({ ...draft, [p.uid]: { ...d, rating: r.value } })}
                      className="px-2.5 py-1.5 rounded-full text-xs font-semibold border transition"
                      style={d.rating === r.value ? { background: r.color, color: "#fff", borderColor: r.color } : { background: "#fff", color: r.color, borderColor: `${r.color}66` }}>
                      {r.emoji} {r.value}
                    </button>
                  ))}
                </div>
                <textarea value={d.comment} maxLength={MAX_COMMENT} rows={2} placeholder="Feedback for the employee (optional)"
                  onChange={(e) => setDraft({ ...draft, [p.uid]: { ...d, comment: e.target.value } })} className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />

                {p.rating?.status === "rejected" && <p className="text-sm text-red-700">Sent back: {p.rating.reviewNote || "no reason given"}</p>}
                {p.rating?.status === "pending" && <p className="text-xs text-amber-800">Proposed by {p.rating.submittedByName}. The employee still sees: {p.published ? p.published.rating : "no rating yet"}.</p>}

                <div className="flex justify-between items-center gap-2">
                  <span className="text-xs text-gray-500">{p.published ? <>Visible to employee: <Pill value={p.published.rating} /></> : "Nothing visible to the employee yet"}</span>
                  <button disabled={!!busy || !d.rating || !changed}
                    onClick={() => act(p.uid, async () => {
                      const r = await postJson<{ message: string }>("/api/performance/rate", { employeeUid: p.uid, period, rating: d.rating, comment: d.comment });
                      setDraft((x) => { const n = { ...x }; delete n[p.uid]; return n; });
                      return r.message;
                    })}
                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold disabled:opacity-40">
                    {busy === p.uid ? "Saving…" : data.submitsForApproval ? "Submit for approval" : "Save & publish"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
