export default function DashboardPreview() {
  return (
    <section
      style={{
        margin: "80px 0",
        display: "grid",
        gridTemplateColumns: "1.2fr .8fr",
        gap: "40px",
        alignItems: "center",
      }}
    >
      {/* LEFT */}
      <div>
        <p
          style={{
            color: "#3d6fa8",
            fontWeight: 700,
            letterSpacing: 2,
            marginBottom: 15,
          }}
        >
          SMART WORKSPACE
        </p>

        <h2
          style={{
            fontSize: 46,
            color: "#111",
            marginBottom: 20,
          }}
        >
          Everything your team needs in one dashboard
        </h2>

        <p
          style={{
            color: "#444",
            fontSize: 18,
            lineHeight: 1.8,
            maxWidth: 600,
          }}
        >
          Manage Attendance, Leave, Payroll, Timesheets,
          Performance Reviews, Documents and AI Production
          Workflows from one beautiful platform.
        </p>

        <div
          style={{
            marginTop: 40,
            display: "grid",
            gridTemplateColumns: "repeat(2,1fr)",
            gap: 20,
          }}
        >
          {[
            "Attendance",
            "Payroll",
            "Leave",
            "Performance",
            "AI Workflow",
            "Documents",
          ].map((item) => (
            <div
              key={item}
              style={{
                background: "#fff",
                padding: 18,
                borderRadius: 16,
                boxShadow: "0 10px 25px rgba(0,0,0,.06)",
                fontWeight: 600,
              }}
            >
              ✅ {item}
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT */}
      <div
        style={{
          background: "#fff",
          borderRadius: 28,
          padding: 25,
          boxShadow: "0 30px 70px rgba(0,0,0,.12)",
        }}
      >
        {/* Top Bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 25,
          }}
        >
          <div>
            <h3 style={{ margin: 0 }}>Dashboard</h3>
            <p style={{ color: "#666", marginTop: 5 }}>
              Welcome back 👋
            </p>
          </div>

          <div
            style={{
              width: 55,
              height: 55,
              borderRadius: "50%",
              background: "#3d6fa8",
            }}
          />
        </div>

        {/* Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2,1fr)",
            gap: 15,
          }}
        >
          {[
            {
              title: "Attendance",
              value: "98%",
              color: "#3d6fa8",
            },
            {
              title: "Timesheets",
              value: "248",
              color: "#16a34a",
            },
            {
              title: "Projects",
              value: "12",
              color: "#7c3aed",
            },
            {
              title: "Performance",
              value: "A+",
              color: "#f59e0b",
            },
          ].map((card) => (
            <div
              key={card.title}
              style={{
                background: "#eaf3ff",
                padding: 20,
                borderRadius: 16,
              }}
            >
              <p style={{ color: "#555" }}>{card.title}</p>

              <h2
                style={{
                  color: card.color,
                  margin: "8px 0",
                }}
              >
                {card.value}
              </h2>
            </div>
          ))}
        </div>

        {/* Chart Placeholder */}
        <div
          style={{
            marginTop: 25,
            height: 170,
            borderRadius: 18,
            background:
              "linear-gradient(135deg,#3d6fa8,#66a8e0)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontWeight: 700,
            fontSize: 22,
          }}
        >
          📈 Productivity Analytics
        </div>
      </div>
    </section>
  );
}