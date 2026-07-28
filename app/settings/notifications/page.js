"use client";

import { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";

const PRIORITY_OPTIONS = [
  { key: "Info", color: "#2563eb", bg: "#eff6ff" },
  { key: "Warning", color: "#d97706", bg: "#fffbeb" },
  { key: "Urgent", color: "#dc2626", bg: "#fef2f2" },
];

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState("Info");

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const loadAnnouncements = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setAnnouncements(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error("LOAD ANNOUNCEMENTS ERROR:", error);
    } finally {
      setLoading(false);
    }
  };

  const postAnnouncement = async () => {
    if (!title.trim() || !message.trim()) {
      alert("Please add both a title and a message");
      return;
    }

    try {
      setPosting(true);
      await addDoc(collection(db, "announcements"), {
        title: title.trim(),
        message: message.trim(),
        priority,
        createdAt: serverTimestamp(),
      });

      setTitle("");
      setMessage("");
      setPriority("Info");
      await loadAnnouncements();
    } catch (error) {
      console.error("POST ANNOUNCEMENT ERROR:", error);
      alert("Failed to post announcement");
    } finally {
      setPosting(false);
    }
  };

  const removeAnnouncement = async (id) => {
    if (!confirm("Delete this announcement?")) return;
    try {
      await deleteDoc(doc(db, "announcements", id));
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    } catch (error) {
      console.error("DELETE ANNOUNCEMENT ERROR:", error);
      alert("Failed to delete");
    }
  };

  return (
    <div style={{ padding: 25, maxWidth: 900 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
        📢 Announcements
      </h1>
      <p style={{ color: "#64748b", marginBottom: 30 }}>
        Post updates that appear on every employee's dashboard.
      </p>

      {/* COMPOSER */}
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: 28,
          marginBottom: 30,
          boxShadow: "0 5px 20px rgba(0,0,0,.05)",
        }}
      >
        <input
          placeholder="Announcement title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ ...inputStyle, marginBottom: 12, fontWeight: 600 }}
        />

        <textarea
          placeholder="Write your announcement..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          style={{ ...inputStyle, marginBottom: 14, resize: "vertical", fontFamily: "inherit" }}
        />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", gap: 8 }}>
            {PRIORITY_OPTIONS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPriority(p.key)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 999,
                  border: priority === p.key ? `2px solid ${p.color}` : "1px solid #e2e8f0",
                  background: priority === p.key ? p.bg : "#fff",
                  color: priority === p.key ? p.color : "#64748b",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {p.key}
              </button>
            ))}
          </div>

          <button
            onClick={postAnnouncement}
            disabled={posting}
            style={{
              background: posting ? "#93c5fd" : "#3d6fa8",
              color: "#fff",
              border: "none",
              padding: "12px 26px",
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 14,
              cursor: posting ? "default" : "pointer",
            }}
          >
            {posting ? "Posting..." : "Post Announcement"}
          </button>
        </div>
      </div>

      {/* LIST */}
      {loading ? (
        <p style={{ color: "#94a3b8" }}>Loading announcements...</p>
      ) : announcements.length === 0 ? (
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: 40,
            textAlign: "center",
            color: "#94a3b8",
            boxShadow: "0 5px 20px rgba(0,0,0,.05)",
          }}
        >
          No announcements posted yet.
        </div>
      ) : (
        announcements.map((a) => {
          const config = PRIORITY_OPTIONS.find((p) => p.key === a.priority) || PRIORITY_OPTIONS[0];
          return (
            <div
              key={a.id}
              style={{
                background: "#fff",
                borderRadius: 14,
                padding: "20px 24px",
                marginBottom: 14,
                boxShadow: "0 4px 14px rgba(0,0,0,.05)",
                borderLeft: `4px solid ${config.color}`,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                      {a.title}
                    </h3>
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: config.color,
                        background: config.bg,
                        padding: "3px 10px",
                        borderRadius: 999,
                      }}
                    >
                      {a.priority}
                    </span>
                  </div>
                  <p style={{ margin: 0, color: "#475569", fontSize: 14.5, lineHeight: 1.5 }}>
                    {a.message}
                  </p>
                  <p style={{ margin: "10px 0 0", color: "#94a3b8", fontSize: 12.5 }}>
                    {a.createdAt?.toDate ? a.createdAt.toDate().toLocaleString("en-IN") : "Just now"}
                  </p>
                </div>

                <button
                  onClick={() => removeAnnouncement(a.id)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#dc2626",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: 13,
                    flexShrink: 0,
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "13px 16px",
  borderRadius: 10,
  border: "1px solid #e2e8f0",
  fontSize: 14.5,
  outline: "none",
  boxSizing: "border-box",
};