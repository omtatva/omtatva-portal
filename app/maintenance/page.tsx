// Deliberately a plain server component — no client-side Firebase calls,
// no "use client". Kept dependency-free on purpose: this page is what
// visitors see while the portal is in maintenance mode, so it must not
// rely on Firestore/Auth being reachable or configured correctly.

export const metadata = {
  title: "Portal Temporarily Unavailable | OMTATVA DIGITALS",
};

export default function MaintenancePage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "linear-gradient(135deg, #eaf3ff 0%, #f8fbff 60%, #ffffff 100%)",
        boxSizing: "border-box",
      }}
    >
      <div
        className="maintenance-card"
        style={{
          width: "100%",
          maxWidth: 480,
          background: "#ffffff",
          borderRadius: 24,
          padding: "48px 36px",
          textAlign: "center",
          boxShadow: "0 20px 60px rgba(61,111,168,.15)",
          border: "1px solid #eaf3ff",
        }}
      >
        <img
          src="/logo.ico"
          alt="OMTATVA DIGITALS logo"
          style={{ width: 56, height: 56, margin: "0 auto 22px", display: "block" }}
        />

        {/* Simple inline "under maintenance" icon — a gear/wrench glyph,
            no external asset dependency. */}
        <div
          style={{
            width: 84,
            height: 84,
            margin: "0 auto 26px",
            borderRadius: "50%",
            background: "linear-gradient(135deg,#3d6fa8,#66a8e0)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 10px 25px rgba(61,111,168,.3)",
          }}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.5-3.5a5 5 0 0 1-6.7 6.7L6.7 20.3a2 2 0 0 1-2.8-2.8L11.7 9.7a5 5 0 0 1 6.7-6.7z"
              stroke="#fff"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1
          style={{
            margin: "0 0 14px",
            fontSize: "clamp(22px, 5vw, 28px)",
            fontWeight: 800,
            color: "#0f172a",
          }}
        >
          Portal Temporarily Unavailable
        </h1>

        <p
          style={{
            margin: 0,
            color: "#64748b",
            fontSize: 15.5,
            lineHeight: 1.7,
          }}
        >
          We are currently performing maintenance.
          <br />
          Please check back soon.
        </p>

        <div
          style={{
            marginTop: 30,
            paddingTop: 22,
            borderTop: "1px solid #eaf3ff",
            color: "#94a3b8",
            fontSize: 13,
          }}
        >
          OMTATVA DIGITALS &middot; HR &amp; Production Portal
        </div>
      </div>

      <style>{`
        @media (max-width: 480px) {
          .maintenance-card {
            padding: 36px 24px !important;
            border-radius: 18px !important;
          }
        }
      `}</style>
    </div>
  );
}
