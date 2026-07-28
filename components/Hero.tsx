// 

"use client";

export default function Hero() {
  const pills = ["Attendance", "Payroll", "AI Workflow", "Performance"];

  return (
    <section id="top" className="hero-section">
      <div className="hero-card">
        {/* Decorative circles */}
        <div className="hero-circle hero-circle-1" />
        <div className="hero-circle hero-circle-2" />

        {/* LEFT */}
        <div style={{ position: "relative", zIndex: 2 }}>
          <p
            style={{
              color: "#eaf3ff",
              letterSpacing: 3,
              fontWeight: 700,
              marginBottom: 12,
            }}
          >
            AI PRODUCTION PLATFORM
          </p>

          <h1 className="hero-title">
            OMTATVA
            <br />
            DIGITALS
          </h1>

          <p
            style={{
              color: "#fff",
              opacity: 0.95,
              marginTop: 30,
              fontSize: 17,
              lineHeight: 1.6,
              maxWidth: 520,
            }}
          >
            OMTATVA DIGITALS provides a modern cloud-based platform for
            attendance, payroll, HR operations, AI production workflows and
            employee management.
          </p>

          <div className="hero-buttons">
            <a href="/login">
              <button className="hero-btn-primary">Employee Login</button>
            </a>
            <a href="/demo">
              <button className="hero-btn-secondary">▶ Watch Demo</button>
            </a>
          </div>

          {/* Floating pills */}
          <div
            style={{
              display: "flex",
              gap: 20,
              marginTop: 45,
              flexWrap: "wrap",
            }}
          >
            {pills.map((item) => (
              <div key={item} className="hero-pill">
                ✓ {item}
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT */}
        <div className="hero-video-frame">
          <video
            autoPlay
            muted
            loop
            playsInline
            poster="/video-poster.jpg"
            style={{
              width: "100%",
              display: "block",
              borderRadius: 22,
              opacity: 0.92,
              objectFit: "cover",
            }}
          >
            <source
              src="https://storage.googleapis.com/omtatva_portal_bucket/videos/Draft%2001%20with%20sound%20(2).mp4"
              type="video/mp4"
            />
          </video>
        </div>
      </div>

      <style jsx>{`
        .hero-section {
          width: 100%;
          margin-bottom: 80px;
          box-sizing: border-box;
        }
        .hero-card {
          width: 100%;
          min-height: 520px;
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 40px;
          align-items: center;
          padding: 50px 60px;
          border-radius: 35px;
          background: linear-gradient(135deg, #3d6fa8 0%, #66a8e0 100%);
          overflow: hidden;
          position: relative;
          box-sizing: border-box;
          box-shadow: 0 30px 80px rgba(61, 111, 168, 0.25);
        }
        .hero-circle {
          position: absolute;
          border-radius: 50%;
        }
        .hero-circle-1 {
          width: 420px;
          height: 420px;
          background: rgba(255, 255, 255, 0.08);
          top: -180px;
          right: -120px;
        }
        .hero-circle-2 {
          width: 240px;
          height: 240px;
          background: rgba(255, 255, 255, 0.05);
          bottom: -80px;
          left: -60px;
        }
        .hero-title {
          font-size: clamp(42px, 5vw, 68px);
          font-weight: 800;
          line-height: 1;
          color: #fff;
          margin: 15px 0;
        }
        .hero-buttons {
          display: flex;
          gap: 20px;
          margin-top: 30px;
          flex-wrap: wrap;
        }
        .hero-btn-primary {
          background: #fff;
          color: #3d6fa8;
          border: none;
          padding: 14px 28px;
          border-radius: 15px;
          font-weight: 700;
          cursor: pointer;
          font-size: 15px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.18);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .hero-btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 14px 30px rgba(0, 0, 0, 0.22);
        }
        .hero-btn-secondary {
          background: transparent;
          color: #fff;
          border: 2px solid rgba(255, 255, 255, 0.6);
          padding: 14px 28px;
          border-radius: 15px;
          font-weight: 700;
          cursor: pointer;
          font-size: 15px;
          transition: background 0.2s ease, border-color 0.2s ease;
        }
        .hero-btn-secondary:hover {
          background: rgba(255, 255, 255, 0.12);
          border-color: rgba(255, 255, 255, 0.9);
        }
        .hero-btn-primary:focus-visible,
        .hero-btn-secondary:focus-visible {
          outline: 3px solid #fff;
          outline-offset: 2px;
        }
        .hero-pill {
          background: rgba(255, 255, 255, 0.18);
          backdrop-filter: blur(10px);
          color: #fff;
          padding: 8px 16px;
          border-radius: 40px;
          font-weight: 500;
          font-size: 14px;
        }
        .hero-video-frame {
          background: #fff;
          border-radius: 28px;
          padding: 10px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.18);
          overflow: hidden;
        }

        @media (max-width: 900px) {
          .hero-card {
            grid-template-columns: 1fr;
            padding: 36px 28px;
            min-height: unset;
          }
          .hero-circle-1,
          .hero-circle-2 {
            display: none;
          }
        }
        @media (max-width: 480px) {
          .hero-card {
            padding: 28px 18px;
            border-radius: 24px;
          }
          .hero-buttons {
            flex-direction: column;
          }
          .hero-btn-primary,
          .hero-btn-secondary {
            width: 100%;
            text-align: center;
          }
        }
      `}</style>
    </section>
  );
}