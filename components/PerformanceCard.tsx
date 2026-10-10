"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { ratingInfo, RATINGS } from "@/lib/performance";

type Entry = { period: string; rating: string; score: number; comment: string; publishedAt: string | null; ratedBy: string; approvedBy: string | null };
type Index = { latest: Entry | null; items: Entry[]; average: number | null };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthShort = (p: string) => `${MONTHS[Number(p.slice(5, 7)) - 1]} ${p.slice(2, 4)}`;
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthLong = (p: string) => `${MONTHS_LONG[Number(p.slice(5, 7)) - 1]} ${p.slice(0, 4)}`;
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");

function Stars({ score, color }: { score: number; color: string }) {
  return (
    <div aria-label={`${score} out of 5`} style={{ display: "flex", gap: 3 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width="22" height="22" viewBox="0 0 24 24" aria-hidden>
          <path d="M12 2l3 6.9 7.5.7-5.7 5 1.7 7.4L12 18l-6.5 4 1.7-7.4-5.7-5 7.5-.7z" fill={i <= score ? color : "none"} stroke={i <= score ? color : "#cbd5e1"} strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      ))}
    </div>
  );
}

function Ring({ score, color }: { score: number; color: string }) {
  const r = 46, c = 2 * Math.PI * r;
  return (
    <svg width="124" height="124" viewBox="0 0 124 124" aria-hidden>
      <circle cx="62" cy="62" r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" />
      <circle cx="62" cy="62" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(score / 5) * c} ${c}`} transform="rotate(-90 62 62)" />
      <text x="62" y="60" textAnchor="middle" fontSize="30" fontWeight="800" fill="#0f172a">{score}</text>
      <text x="62" y="80" textAnchor="middle" fontSize="12" fill="#64748b">out of 5</text>
    </svg>
  );
}

// The employee's own performance card. It listens to performanceIndex/{uid}
// (written by the server, readable only by that employee) — a rating appears
// the moment it is approved, with no refresh. `legacyRating` is the older
// single value kept on the profile, shown only until a new rating exists.
export default function PerformanceCard({ legacyRating }: { legacyRating?: string | null }) {
  const [index, setIndex] = useState<Index | null>(null);

  useEffect(() => {
    let off = () => {};
    const stop = onAuthStateChanged(auth, (u) => {
      off();
      if (!u) return;
      off = onSnapshot(
        doc(db, "performanceIndex", u.uid),
        (snap) => setIndex(snap.exists() ? (snap.data() as Index) : { latest: null, items: [], average: null }),
        () => setIndex({ latest: null, items: [], average: null })
      );
    });
    return () => { off(); stop(); };
  }, []);

  const latest = index?.latest || null;
  const legacy = !latest && legacyRating && ratingInfo(legacyRating) ? ratingInfo(legacyRating) : null;
  const info = latest ? ratingInfo(latest.rating) : legacy;
  const color = info?.color || "#64748b";
  const history = index ? [...index.items].slice(0, 6).reverse() : [];

  return (
    <section
      aria-label="Performance"
      style={{
        borderRadius: 26, marginBottom: 35, overflow: "hidden", background: "var(--card-bg)",
        boxShadow: "0 18px 45px rgba(30,41,59,.12)", border: "1px solid rgba(148,163,184,.25)",
      }}
    >
      <div style={{ background: `linear-gradient(120deg, ${color} 0%, #4f46e5 100%)`, color: "#fff", padding: "18px 26px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 26 }}>🏆</span>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>My Performance</div>
          <div style={{ fontSize: 13, opacity: 0.9 }}>{latest ? `Review for ${monthLong(latest.period)}` : "Rated by your reporting manager"}</div>
        </div>
        {index?.average != null && (
          <span style={{ background: "rgba(255,255,255,.2)", padding: "6px 14px", borderRadius: 999, fontSize: 13, fontWeight: 700 }}>
            Average (last {Math.min(index.items.length, 6)}): {index.average} / 5
          </span>
        )}
      </div>

      {index === null && <div style={{ padding: 28, color: "var(--text-muted)" }}>Loading…</div>}

      {index !== null && !info && (
        <div style={{ padding: "30px 26px", textAlign: "center", color: "var(--text-muted)" }}>
          <div style={{ fontSize: 44 }}>⏳</div>
          <div style={{ fontWeight: 700, fontSize: 18, color: "var(--text-color)", marginTop: 6 }}>No rating published yet</div>
          <div style={{ marginTop: 6 }}>Your rating will appear here as soon as it has been reviewed and approved.</div>
        </div>
      )}

      {index !== null && info && (
        <div style={{ padding: "24px 26px", display: "grid", gap: 26, gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
            <Ring score={latest ? latest.score : info.score} color={color} />
            <div>
              <div style={{ display: "inline-block", padding: "8px 18px", borderRadius: 999, fontWeight: 800, fontSize: 20, color, background: `${color}18`, border: `2px solid ${color}` }}>
                {info.emoji} {info.value}
              </div>
              <div style={{ marginTop: 10 }}><Stars score={latest ? latest.score : info.score} color={color} /></div>
            </div>
          </div>

          <div>
            {latest ? (
              <>
                {latest.comment ? (
                  <blockquote style={{ margin: 0, padding: "12px 16px", borderLeft: `4px solid ${color}`, background: `${color}0f`, borderRadius: 10, fontStyle: "italic" }}>
                    “{latest.comment}”
                  </blockquote>
                ) : (
                  <div style={{ color: "var(--text-muted)", fontStyle: "italic" }}>No written feedback this month.</div>
                )}
                <div style={{ marginTop: 12, fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.6 }}>
                  <div>Rated by <b style={{ color: "var(--text-color)" }}>{latest.ratedBy}</b></div>
                  {latest.approvedBy && <div>Approved by <b style={{ color: "var(--text-color)" }}>{latest.approvedBy}</b></div>}
                  <div>Published {day(latest.publishedAt)}</div>
                </div>
              </>
            ) : (
              <div style={{ color: "var(--text-muted)" }}>Rated by the HR department. A new review from your manager will replace this once published.</div>
            )}
          </div>

          {history.length > 1 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Last {history.length} months</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 96 }}>
                {history.map((h) => {
                  const c = ratingInfo(h.rating)?.color || "#64748b";
                  return (
                    <div key={h.period} title={`${monthLong(h.period)}: ${h.rating}`} style={{ flex: 1, textAlign: "center" }}>
                      <div style={{ height: `${(h.score / 5) * 72}px`, minHeight: 10, background: c, borderRadius: "8px 8px 3px 3px", opacity: h.period === latest?.period ? 1 : 0.7 }} />
                      <div style={{ fontSize: 11, marginTop: 4, color: "var(--text-muted)" }}>{monthShort(h.period)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {index !== null && info && (
        <div style={{ padding: "0 26px 18px", display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, color: "var(--text-muted)" }}>
          {RATINGS.map((r) => <span key={r.value} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: r.color, display: "inline-block" }} />{r.score} · {r.value}</span>)}
        </div>
      )}
    </section>
  );
}
