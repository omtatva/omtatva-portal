"use client";

import { useState } from "react";
import AvatarIllustration from "./AvatarIllustration";
import { initialsOf } from "@/lib/orgHierarchy";

// Real profile photo when the employee has one; otherwise the same
// illustrated default avatar used elsewhere in the portal (by gender), and
// finally initials. A photo URL that fails to load falls back too.
export default function PersonAvatar({
  name,
  photo,
  gender,
  size = 48,
  ring,
}: {
  name: string;
  photo?: string;
  gender?: string;
  size?: number;
  ring?: string;
}) {
  // Remember WHICH url failed, so a new photo is tried again automatically.
  const [brokenUrl, setBrokenUrl] = useState("");
  const broken = !!photo && photo === brokenUrl;

  const frame: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    flexShrink: 0,
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    border: ring ? `3px solid ${ring}` : "2px solid var(--border-color)",
    background: "var(--icon-bg)",
  };

  if (photo && !broken) {
    return (
      <div style={frame}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo}
          alt={name}
          onError={() => setBrokenUrl(photo)}
          // The browser can finish (and fail) loading before React attaches
          // onError — e.g. server-rendered markup — so also check on mount.
          ref={(el) => {
            if (el && el.complete && el.naturalWidth === 0 && brokenUrl !== photo) {
              setBrokenUrl(photo);
            }
          }}
          referrerPolicy="no-referrer"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
    );
  }

  const illustration = <AvatarIllustration gender={gender} size={size} />;
  if (illustration && gender && ["male", "female"].includes(gender.trim().toLowerCase())) {
    return <div style={frame}>{illustration}</div>;
  }

  return (
    <div
      style={{
        ...frame,
        background: "linear-gradient(135deg,#3d6fa8,#66a8e0)",
        color: "#fff",
        fontWeight: 700,
        fontSize: Math.max(11, Math.round(size * 0.36)),
      }}
      aria-label={name}
    >
      {initialsOf(name)}
    </div>
  );
}
