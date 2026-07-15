export default function Stats() {
  const stats = [
    {
      icon: "👨‍💼",
      value: "20+",
      title: "Employees",
      subtitle: "Growing creative & technical team",
      color: "#3d6fa8",
    },
    {
      icon: "🎬",
      value: "10+",
      title: "Projects",
      subtitle: "Active productions",
      color: "#66a8e0",
    },
    {
      icon: "🤖",
      value: "15+",
      title: "AI Tools",
      subtitle: "Runway • Veo • Kling • Midjourney",
      color: "#7c3aed",
    },
    {
      icon: "⏱️",
      value: "1000+",
      title: "Production Hours",
      subtitle: "Successfully delivered",
      color: "#16a34a",
    },
  ];

  return (
    <section
      style={{
        margin: "80px auto",
        // maxWidth: 1400,
        padding: "0 30px",
      }}
    >
      <div
        style={{
          textAlign: "center",
          marginBottom: 50,
        }}
      >
        <p
          style={{
            color: "#3d6fa8",
            letterSpacing: 2,
            fontWeight: 700,
            marginBottom: 10,
          }}
        >
          COMPANY OVERVIEW
        </p>

        <h2
          style={{
            fontSize: 42,
            color: "#111111",
            marginBottom: 15,
          }}
        >
          Trusted by Creative Production Teams
        </h2>

        <p
          style={{
            color: "#444444",
            fontSize: 18,
            maxWidth: 700,
            margin: "0 auto",
            lineHeight: 1.8,
          }}
        >
          A unified platform for attendance, HR operations,
          AI production workflows and employee management.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
          gap: 30,
        }}
      >
        {stats.map((item) => (
          <div
            key={item.title}
            style={{
              background: "#ffffff",
              borderRadius: 25,
              padding: 35,
              boxShadow: "0 15px 40px rgba(0,0,0,.08)",
              border: "1px solid #eaf3ff",
              transition: "0.3s",
              cursor: "pointer",
            }}
          >
            <div
              style={{
                width: 75,
                height: 75,
                borderRadius: "50%",
                background: "#eaf3ff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 34,
                marginBottom: 25,
              }}
            >
              {item.icon}
            </div>

            <h1
              style={{
                fontSize: 48,
                color: item.color,
                margin: 0,
              }}
            >
              {item.value}
            </h1>

            <h3
              style={{
                color: "#111111",
                marginTop: 10,
                marginBottom: 10,
              }}
            >
              {item.title}
            </h3>

            <p
              style={{
                color: "#666666",
                lineHeight: 1.7,
              }}
            >
              {item.subtitle}
            </p>

            <div
              style={{
                marginTop: 25,
                height: 6,
                borderRadius: 20,
                background: "#eaf3ff",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  background: item.color,
                  borderRadius: 20,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}