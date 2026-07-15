export default function Hero() {
  return (
    <section
    id="top"
  style={{
    width: "100%",
    // padding: "40px 4vw",
    // marginTop: 20,
    marginBottom: 80,
    boxSizing: "border-box",
  }}
>
      <div
  style={{
    width: "100%",
    minHeight: "650px",
    display: "grid",
    gridTemplateColumns: "1.1fr .9fr",
    gap: "60px",
    alignItems: "center",
    padding: "80px",
    borderRadius: "35px",
    background:
      "linear-gradient(135deg,#3d6fa8 0%,#66a8e0 100%)",
    overflow: "hidden",
    position: "relative",
    boxSizing: "border-box",
    boxShadow: "0 30px 80px rgba(61,111,168,.25)",
  }}
>
        {/* Decorative circles */}

        <div
          style={{
            position: "absolute",
            width: 420,
            height: 420,
            borderRadius: "50%",
            background: "rgba(255,255,255,.08)",
            top: -180,
            right: -120,
          }}
        />

        <div
          style={{
            position: "absolute",
            width: 240,
            height: 240,
            borderRadius: "50%",
            background: "rgba(255,255,255,.05)",
            bottom: -80,
            left: -60,
          }}
        />

        {/* LEFT */}

        <div style={{ position: "relative", zIndex: 2 }}>
          {/* <img
            src="/logo.ico"
            alt="OMTATVA"
            style={{
              width: 90,
              marginBottom: 30,
            }} */}
          {/* /> */}

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

          <h1
            style={{
            fontSize: "clamp(56px,6vw,90px)",
            fontWeight: 800,
            lineHeight: 1,
            color: "#fff",
            margin: "20px 0",
            }}
          >
            OMTATVA
            <br />
            DIGITALS
          </h1>

          <p
            style={{
              color: "#fff",
              opacity: .95,
              marginTop: 30,
              fontSize: 20,
              lineHeight: 1.9,
              maxWidth: 650,
            }}
          >
            OMTATVA DIGITALS provides a modern cloud-based
            platform for attendance, payroll, HR operations,
            AI production workflows and employee management.
          </p>

          <div
            style={{
              display: "flex",
              gap: 20,
              marginTop: 45,
            }}
          >
            <a href="/login">
              <button
                style={{
                  background: "#fff",
                  color: "#3d6fa8",
                  border: "none",
                  padding: "18px 38px",
                  borderRadius: 15,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: 16,
                  boxShadow: "0 10px 25px rgba(0,0,0,.18)",
                }}
              >
                Employee Login
              </button>
            </a>

            <button
              style={{
                background: "transparent",
                color: "#fff",
                border: "2px solid rgba(255,255,255,.6)",
                padding: "18px 38px",
                borderRadius: 15,
                fontWeight: 700,
                cursor: "pointer",
                fontSize: 16,
              }}
            >
                ▶ Watch Demo
            </button>
          </div>

          {/* Floating cards */}

          <div
            style={{
              display: "flex",
              gap: 20,
              marginTop: 45,
              flexWrap: "wrap",
            }}
          >
            {[
              "Attendance",
              "Payroll",
              "AI Workflow",
              "Performance",
            ].map((item) => (
              <div
                key={item}
                style={{
                  background: "rgba(255,255,255,.18)",
                  backdropFilter: "blur(10px)",
                  color: "#fff",
                  padding: "12px 22px",
                  borderRadius: 40,
                  fontWeight: 600,
                }}
              >
                ✓ {item}
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT */}
<div
  style={{
    background: "#fff",
    borderRadius: 28,
    padding: 10,
    boxShadow: "0 20px 60px rgba(0,0,0,.18)",
    overflow: "hidden",
  }}
>
  <video
    autoPlay
    muted
    loop
    playsInline
    style={{
      width: "100%",
      display: "block",
      borderRadius: 22,
      opacity: 0.92,
      objectFit: "cover",
    }}
  >
    <source
      src="/company.mp4"
      type="video/mp4"
    />
  </video>
</div>
  
          {/* Floating analytics

          <div
            style={{
              position: "absolute",
              left: -40,
              bottom: -35,
              background: "#fff",
              padding: "18px 25px",
              borderRadius: 20,
              boxShadow: "0 20px 40px rgba(0,0,0,.15)",
            }}
          >
            <h3
              style={{
                margin: 0,
                color: "#3d6fa8",
              }}
            >
              98%
            </h3>

            <p
              style={{
                margin: "5px 0 0",
                color: "#444",
              }}
            >
              Attendance Rate
            </p>
          </div>

          <div
            style={{
              position: "absolute",
              right: -25,
              top: 35,
              background: "#fff",
              padding: "18px 25px",
              borderRadius: 20,
              boxShadow: "0 20px 40px rgba(0,0,0,.15)",
            }}
          >
            <h3
              style={{
                margin: 0,
                color: "#16a34a",
              }}
            >
              12
            </h3>

            <p
              style={{
                margin: "5px 0 0",
                color: "#444",
              }}
            >
              Active Projects
            </p>
          </div> */}
      
      </div>
    </section>
  );
}