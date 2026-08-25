"use client";

// Friendly illustrated placeholder avatars — shown wherever a user has no
// uploaded profile photo yet, matched to their Profile > Personal Info
// "Gender" field (Male/Female). Falls back to the plain initials bubble
// (rendered by the caller) when gender isn't set either.

export function GirlAvatar({ size = 42 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label="Avatar">
      <defs>
        <linearGradient id="girlBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f5c9e0" />
          <stop offset="100%" stopColor="#c99bf0" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill="url(#girlBg)" />
      {/* hair back */}
      <path d="M28 46c0-16 10-28 22-28s22 12 22 28c0 6-1 11-3 15h-38c-2-4-3-9-3-15z" fill="#4a3222" />
      {/* neck */}
      <rect x="42" y="62" width="16" height="14" rx="6" fill="#f0b799" />
      {/* face */}
      <ellipse cx="50" cy="50" rx="18" ry="19" fill="#f7c9a8" />
      {/* hair front / fringe */}
      <path
        d="M31 44c1-13 9-22 19-22s18 9 19 22c-4-3-9-5-19-5s-15 2-19 5z"
        fill="#4a3222"
      />
      {/* side hair strands */}
      <path d="M30 42c-2 8-2 17 1 24" stroke="#4a3222" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M70 42c2 8 2 17-1 24" stroke="#4a3222" strokeWidth="5" strokeLinecap="round" fill="none" />
      {/* eyes */}
      <circle cx="43" cy="50" r="2.2" fill="#3a2a1a" />
      <circle cx="57" cy="50" r="2.2" fill="#3a2a1a" />
      {/* blush */}
      <circle cx="38" cy="56" r="3" fill="#f2a48c" opacity="0.6" />
      <circle cx="62" cy="56" r="3" fill="#f2a48c" opacity="0.6" />
      {/* smile */}
      <path d="M44 58c2 2.5 10 2.5 12 0" stroke="#a5624a" strokeWidth="2" strokeLinecap="round" fill="none" />
      {/* shoulders / top */}
      <path d="M20 100c2-14 14-24 30-24s28 10 30 24z" fill="#9a5fd6" />
    </svg>
  );
}

export function BoyAvatar({ size = 42 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label="Avatar">
      <defs>
        <linearGradient id="boyBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a9d8f0" />
          <stop offset="100%" stopColor="#5fa8e0" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill="url(#boyBg)" />
      {/* neck */}
      <rect x="42" y="62" width="16" height="14" rx="6" fill="#e0aa82" />
      {/* face */}
      <ellipse cx="50" cy="49" rx="18" ry="19" fill="#eab989" />
      {/* ears */}
      <circle cx="31" cy="50" r="3.5" fill="#eab989" />
      <circle cx="69" cy="50" r="3.5" fill="#eab989" />
      {/* hair */}
      <path
        d="M30 40c0-13 9-21 20-21s20 8 20 21c0 3-0.5 6-1 8-2-6-8-10-19-10s-17 4-19 10c-0.5-2-1-5-1-8z"
        fill="#2b2116"
      />
      {/* eyes */}
      <circle cx="43" cy="49" r="2.2" fill="#2b2116" />
      <circle cx="57" cy="49" r="2.2" fill="#2b2116" />
      {/* eyebrows */}
      <path d="M39 44c2-1.5 5-1.5 7 0" stroke="#2b2116" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <path d="M54 44c2-1.5 5-1.5 7 0" stroke="#2b2116" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      {/* smile */}
      <path d="M44 57c2 2.5 10 2.5 12 0" stroke="#8a5330" strokeWidth="2" strokeLinecap="round" fill="none" />
      {/* shoulders / collar */}
      <path d="M20 100c2-14 14-24 30-24s28 10 30 24z" fill="#2f6fb0" />
      <path d="M50 76l-6 6 6 4 6-4z" fill="#e7edf3" />
    </svg>
  );
}

export default function AvatarIllustration({
  gender,
  size = 42,
}: {
  gender?: string | null;
  size?: number;
}) {
  const normalized = (gender || "").trim().toLowerCase();
  if (normalized === "female") return <GirlAvatar size={size} />;
  if (normalized === "male") return <BoyAvatar size={size} />;
  return null;
}

// ============================================================
// HERO AVATARS — bigger, more detailed "premium" illustrations
// for the Dashboard welcome banner specifically (headphones, closed
// eyes, hoodie, soft shading). The small GirlAvatar/BoyAvatar above
// stay simple on purpose — they're rendered at 42-64px (nav bar,
// profile card) where fine detail wouldn't read anyway.
// ============================================================

export function HeroBoyAvatar({ size = 190 }: { size?: number }) {
  const height = size * (260 / 220);
  return (
    <svg viewBox="0 0 220 260" width={size} height={height} role="img" aria-label="Avatar">
      <defs>
        <linearGradient id="heroBoyHoodie" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4c85c0" />
          <stop offset="100%" stopColor="#2f5f92" />
        </linearGradient>
        <linearGradient id="heroBoyFace" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f3c29a" />
          <stop offset="100%" stopColor="#e6ac7c" />
        </linearGradient>
        <linearGradient id="heroBoyHair" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5a4634" />
          <stop offset="100%" stopColor="#3a2c1f" />
        </linearGradient>
        <filter id="heroBoyShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#0f2a4a" floodOpacity="0.25" />
        </filter>
      </defs>

      <g filter="url(#heroBoyShadow)">
        {/* hoodie / shoulders */}
        <path
          d="M20 258c2-52 34-84 90-84s88 32 90 84z"
          fill="url(#heroBoyHoodie)"
        />
        {/* hoodie collar */}
        <path d="M84 176c8 10 44 10 52 0l-6 16c-14 8-26 8-40 0z" fill="#254c78" />
        {/* neck */}
        <rect x="96" y="150" width="28" height="30" rx="12" fill="#e6ac7c" />
        {/* ears */}
        <circle cx="62" cy="128" r="9" fill="#e6ac7c" />
        <circle cx="158" cy="128" r="9" fill="#e6ac7c" />
        {/* face */}
        <ellipse cx="110" cy="122" rx="52" ry="54" fill="url(#heroBoyFace)" />
        {/* cheek shading */}
        <ellipse cx="110" cy="150" rx="40" ry="16" fill="#d99a68" opacity="0.35" />
        {/* hair */}
        <path
          d="M58 108c-2-38 22-62 52-62s54 24 52 62c0 8-1 15-3 20-6-16-24-26-49-26s-43 10-49 26c-2-5-3-12-3-20z"
          fill="url(#heroBoyHair)"
        />
        {/* headphone band */}
        <path
          d="M55 108c0-38 24-62 55-62s55 24 55 62"
          fill="none"
          stroke="#22364c"
          strokeWidth="10"
          strokeLinecap="round"
        />
        {/* headphone cups */}
        <circle cx="55" cy="120" r="20" fill="#2f4964" />
        <circle cx="55" cy="120" r="11" fill="#7fb2e0" />
        <circle cx="165" cy="120" r="20" fill="#2f4964" />
        <circle cx="165" cy="120" r="11" fill="#7fb2e0" />
        {/* closed eyes — peaceful */}
        <path d="M90 122c4 5 12 5 16 0" stroke="#3a2c1f" strokeWidth="3.4" strokeLinecap="round" fill="none" />
        <path d="M114 122c4 5 12 5 16 0" stroke="#3a2c1f" strokeWidth="3.4" strokeLinecap="round" fill="none" />
        {/* soft brows */}
        <path d="M88 110c4-2.5 10-2.5 14 0" stroke="#3a2c1f" strokeWidth="2.4" strokeLinecap="round" fill="none" opacity="0.7" />
        <path d="M118 110c4-2.5 10-2.5 14 0" stroke="#3a2c1f" strokeWidth="2.4" strokeLinecap="round" fill="none" opacity="0.7" />
        {/* blush */}
        <ellipse cx="82" cy="140" rx="8" ry="5" fill="#e8896a" opacity="0.45" />
        <ellipse cx="138" cy="140" rx="8" ry="5" fill="#e8896a" opacity="0.45" />
        {/* gentle smile */}
        <path d="M98 144c5 6 19 6 24 0" stroke="#8a5330" strokeWidth="3" strokeLinecap="round" fill="none" />
      </g>
    </svg>
  );
}

export function HeroGirlAvatar({ size = 190 }: { size?: number }) {
  const height = size * (260 / 220);
  return (
    <svg viewBox="0 0 220 260" width={size} height={height} role="img" aria-label="Avatar">
      <defs>
        <linearGradient id="heroGirlHoodie" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6f7fd6" />
          <stop offset="100%" stopColor="#3d5cae" />
        </linearGradient>
        <linearGradient id="heroGirlFace" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f6cba8" />
          <stop offset="100%" stopColor="#eab488" />
        </linearGradient>
        <linearGradient id="heroGirlHair" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5e4632" />
          <stop offset="100%" stopColor="#3a2b1e" />
        </linearGradient>
        <filter id="heroGirlShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#2a1f4a" floodOpacity="0.22" />
        </filter>
      </defs>

      <g filter="url(#heroGirlShadow)">
        {/* long hair back, behind shoulders */}
        <path
          d="M48 130c-10 34-8 74 2 128h30c-8-46-8-92 2-124z"
          fill="url(#heroGirlHair)"
        />
        <path
          d="M172 130c10 34 8 74-2 128h-30c8-46 8-92-2-124z"
          fill="url(#heroGirlHair)"
        />
        {/* hoodie / shoulders */}
        <path
          d="M20 258c2-52 34-84 90-84s88 32 90 84z"
          fill="url(#heroGirlHoodie)"
        />
        {/* hoodie collar */}
        <path d="M84 176c8 10 44 10 52 0l-6 16c-14 8-26 8-40 0z" fill="#2f4a94" />
        {/* neck */}
        <rect x="96" y="150" width="28" height="30" rx="12" fill="#eab488" />
        {/* ears */}
        <circle cx="62" cy="128" r="9" fill="#eab488" />
        <circle cx="158" cy="128" r="9" fill="#eab488" />
        {/* face */}
        <ellipse cx="110" cy="122" rx="52" ry="54" fill="url(#heroGirlFace)" />
        {/* cheek shading */}
        <ellipse cx="110" cy="150" rx="40" ry="16" fill="#dd9c6e" opacity="0.35" />
        {/* hair front + side strands framing face */}
        <path
          d="M56 112c-3-40 22-66 54-66s57 26 54 66c0 6-1 11-2 15-8-18-27-29-52-29s-44 11-52 29c-1-4-2-9-2-15z"
          fill="url(#heroGirlHair)"
        />
        <path d="M52 118c-4 20-4 44 2 66" stroke="url(#heroGirlHair)" strokeWidth="14" strokeLinecap="round" fill="none" />
        <path d="M168 118c4 20 4 44-2 66" stroke="url(#heroGirlHair)" strokeWidth="14" strokeLinecap="round" fill="none" />
        {/* headphone band */}
        <path
          d="M55 106c0-38 24-62 55-62s55 24 55 62"
          fill="none"
          stroke="#2a2f5c"
          strokeWidth="10"
          strokeLinecap="round"
        />
        {/* headphone cups */}
        <circle cx="55" cy="118" r="20" fill="#3a3f7c" />
        <circle cx="55" cy="118" r="11" fill="#b9a4e8" />
        <circle cx="165" cy="118" r="20" fill="#3a3f7c" />
        <circle cx="165" cy="118" r="11" fill="#b9a4e8" />
        {/* closed eyes — peaceful */}
        <path d="M90 122c4 5 12 5 16 0" stroke="#3a2b1e" strokeWidth="3.4" strokeLinecap="round" fill="none" />
        <path d="M114 122c4 5 12 5 16 0" stroke="#3a2b1e" strokeWidth="3.4" strokeLinecap="round" fill="none" />
        {/* soft lashes */}
        <path d="M89 118l-3-3M121 118l3-3" stroke="#3a2b1e" strokeWidth="1.6" strokeLinecap="round" />
        {/* blush */}
        <ellipse cx="82" cy="140" rx="8" ry="5" fill="#ea9478" opacity="0.5" />
        <ellipse cx="138" cy="140" rx="8" ry="5" fill="#ea9478" opacity="0.5" />
        {/* gentle smile */}
        <path d="M98 144c5 6 19 6 24 0" stroke="#8a5330" strokeWidth="3" strokeLinecap="round" fill="none" />
      </g>
    </svg>
  );
}

// Dynamic selector matching the app's Profile > Personal Info "Gender"
// field (Male/Female — see PersonalInfo.tsx). Anything other than an
// exact "female" match (missing, null, "Other", unrecognised values)
// falls back to the boy avatar, per product decision — never blocks
// the dashboard on an unset field, and never asks the user to pick one.
export function HeroAvatar({ gender, size = 190 }: { gender?: string | null; size?: number }) {
  const isFemale = (gender || "").trim().toLowerCase() === "female";
  return isFemale ? <HeroGirlAvatar size={size} /> : <HeroBoyAvatar size={size} />;
}
