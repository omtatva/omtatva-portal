"use client";


export default function Stats() {
  const stats = [
    {
      icon: "👨‍💼",
      value: "20+",
      title: "Employees",
      subtitle: "Creative & Technical Team",
      color: "#3d6fa8",
    },
    {
      icon: "🎬",
      value: "10+",
      title: "Projects",
      subtitle: "Active Productions",
      color: "#66a8e0",
    },
    {
      icon: "🤖",
      value: "15+",
      title: "AI Tools",
      subtitle: "Runway • Veo • Kling",
      color: "#7c3aed",
    },
    {
      icon: "⏱️",
      value: "1000+",
      title: "Hours",
      subtitle: "Production Delivered",
      color: "#16a34a",
    },
  ];

  return (
    <section
      style={{
        margin: "60px auto",
        padding: "0 50px",
      }}
    >
      <div
        style={{
          textAlign: "center",
          marginBottom: 40,
        }}
      >
        <p
          style={{
            color: "#3d6fa8",
            letterSpacing: 2,
            fontWeight: 700,
            fontSize: 14,
            marginBottom: 8,
          }}
        >
          COMPANY OVERVIEW
        </p>

        <h2
          style={{
            fontSize: 34,
            color: "#111",
            margin: "0 0 12px",
          }}
        >
          Trusted by Creative Production Teams
        </h2>

        <p
          style={{
            color: "#555",
            fontSize: 17,
            maxWidth: 650,
            margin: "0 auto",
            lineHeight: 1.6,
          }}
        >
          A unified platform for attendance, HR operations,
          AI production workflows and employee management.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
          gap: 25,
        }}
      >
       {stats.map((item) => (
 <div
  key={item.title}
  className="stats-card"
  style={{
    background: "#fff",
    borderRadius: 18,
    padding: 25,
    border: "1px solid #e8eef8",
    boxShadow: "0 8px 24px rgba(0,0,0,.06)",
  }}
>
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: "50%",
                background: "#eef6ff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                marginBottom: 18,
              }}
            >
              {item.icon}
            </div>

            <h1
  style={{
    fontSize: 56,
    fontWeight: 800,
    color: item.color,
    margin: 0,
  }}
>
              {item.value}
            </h1>

            <h3
              style={{
                margin: "8px 0",
                fontSize: 22,
                color: "#222",
              }}
            >
              {item.title}
            </h3>

            <p
              style={{
                color: "#666",
                lineHeight: 1.6,
                fontSize: 15,
                minHeight: 45,
              }}
            >
              {item.subtitle}
            </p>

            <div
              style={{
                marginTop: 18,
                height: 5,
                background: "#eef3fb",
                borderRadius: 10,
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  background: item.color,
                  borderRadius: 10,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}