export default function Timeline() {
  const steps = [
    {
      icon: "👤",
      title: "Employee Login",
      desc: "Secure Firebase authentication",
    },
    {
      icon: "🕒",
      title: "Attendance",
      desc: "Check-in & Check-out",
    },
    {
      icon: "📋",
      title: "Timesheet",
      desc: "Daily work logging",
    },
    {
      icon: "👨‍💼",
      title: "Manager Review",
      desc: "Approval workflow",
    },
    {
      icon: "🎬",
      title: "AI Production",
      desc: "Creative production pipeline",
    },
    {
      icon: "💰",
      title: "Payroll",
      desc: "Salary processing",
    },
  ];

  return (
    <section
      style={{
        maxWidth: 1300,
        margin: "70px auto",
        padding: "0 50px",
      }}
    >
      <div
        style={{
          textAlign: "center",
          marginBottom: 45,
        }}
      >
        <p
          style={{
            color: "#3d6fa8",
            fontWeight: 700,
            letterSpacing: 2,
            fontSize: 14,
            marginBottom: 8,
          }}
        >
          WORKFLOW
        </p>

        <h2
          style={{
            fontSize: 34,
            color: "#111",
            margin: "0 0 12px",
          }}
        >
          Employee Journey
        </h2>

        <p
          style={{
            maxWidth: 650,
            margin: "0 auto",
            color: "#555",
            lineHeight: 1.6,
            fontSize: 17,
          }}
        >
          Every employee follows a streamlined digital workflow from
          attendance to payroll and AI production.
        </p>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 20,
        }}
      >
        {steps.map((step, index) => (
          <div
            key={step.title}
            style={{
              flex: 1,
              minWidth: 170,
              textAlign: "center",
              position: "relative",
            }}
          >
            {index !== steps.length - 1 && (
              <div
                style={{
                  position: "absolute",
                  top: 30,
                  right: "-50%",
                  width: "100%",
                  height: 3,
                  background: "#66a8e0",
                  opacity: 0.3,
                  zIndex: 0,
                }}
              />
            )}

            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: "50%",
                background: "#3d6fa8",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                margin: "0 auto",
                position: "relative",
                zIndex: 2,
                boxShadow: "0 8px 20px rgba(61,111,168,.25)",
              }}
            >
              {step.icon}
            </div>

            <h3
              style={{
                marginTop: 16,
                marginBottom: 8,
                color: "#111",
                fontSize: 20,
              }}
            >
              {step.title}
            </h3>

            <p
              style={{
                color: "#666",
                lineHeight: 1.5,
                fontSize: 14,
                maxWidth: 150,
                margin: "0 auto",
              }}
            >
              {step.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}