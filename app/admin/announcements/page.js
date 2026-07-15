"use client";

import { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";

export default function AdminAnnouncements() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const loadAnnouncements = async () => {
    const q = query(
      collection(db, "announcements"),
      orderBy("createdAt", "desc")
    );

    const snap = await getDocs(q);

    const list = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    setAnnouncements(list);
  };

  const publishAnnouncement = async () => {
    if (!title || !message) {
      alert("Fill all fields");
      return;
    }

    await addDoc(collection(db, "announcements"), {
      title,
      message,
      createdAt: Timestamp.now(),
    });

    alert("Announcement Published");

    setTitle("");
    setMessage("");

    loadAnnouncements();
  };

  return (
    <div
      style={{
        maxWidth: 1300,
        margin: "40px auto",
        padding: 30,
      }}
    >
      <h1>📢 Company Announcements</h1>

      <div
        style={{
          background: "#fff",
          padding: 30,
          borderRadius: 15,
          boxShadow: "0 10px 25px rgba(0,0,0,.08)",
          marginTop: 30,
        }}
      >
        <h2>Create Announcement</h2>

        <input
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={inputStyle}
        />

        <textarea
          rows={5}
          placeholder="Announcement"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          style={inputStyle}
        />

        <button
          onClick={publishAnnouncement}
          style={button}
        >
          Publish
        </button>
      </div>

      <div
        style={{
          marginTop: 40,
        }}
      >
        <h2>Published Announcements</h2>

        {announcements.map((item) => (
          <div
            key={item.id}
            style={{
              background: "#fff",
              marginTop: 15,
              padding: 20,
              borderRadius: 12,
              boxShadow: "0 5px 15px rgba(0,0,0,.06)",
            }}
          >
            <h3>{item.title}</h3>

            <p>{item.message}</p>

            <small>
              {item.createdAt?.toDate().toLocaleString()}
            </small>
          </div>
        ))}
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "14px",
  marginTop: "15px",
  marginBottom: "15px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  fontSize: "16px",
};

const button = {
  background: "#2563eb",
  color: "#fff",
  border: "none",
  padding: "14px 30px",
  borderRadius: "10px",
  cursor: "pointer",
  fontWeight: "bold",
};