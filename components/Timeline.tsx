export default function Timeline() {
  const steps = [
    {
      icon: "👤",
      title: "Employee Login",
      desc: "Secure login with Firebase Authentication",
    },
    {
      icon: "🕒",
      title: "Attendance",
      desc: "Check-in & Check-out",
    },
    {
      icon: "📋",
      title: "Timesheet",
      desc: "Daily work updates",
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
        maxWidth: 1500,
        margin: "120px auto",
        padding: "0 30px",
      }}
    >
      <div
        style={{
          textAlign: "center",
          marginBottom: 70,
        }}
      >
        <p
          style={{
            color: "#3d6fa8",
            fontWeight: 700,
            letterSpacing: 2,
          }}
        >
          WORKFLOW
        </p>

        <h2
          style={{
            fontSize: 46,
            color: "#111",
            marginTop: 15,
          }}
        >
          Employee Journey
        </h2>

        <p
          style={{
            maxWidth: 700,
            margin: "20px auto",
            color: "#666",
            lineHeight: 1.8,
            fontSize: 18,
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
          alignItems: "center",
          flexWrap: "wrap",
          gap: 20,
        }}
      >
        {steps.map((step, index) => (
          <div
            key={step.title}
            style={{
              flex: 1,
              minWidth: 180,
              position: "relative",
              textAlign: "center",
            }}
          >
            {index !== steps.length - 1 && (
              <div
                style={{
                  position: "absolute",
                  top: 40,
                  right: "-50%",
                  width: "100%",
                  height: 4,
                  background: "#66a8e0",
                  zIndex: 0,
                }}
              />
            )}

            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                background: "#3d6fa8",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 34,
                margin: "0 auto",
                position: "relative",
                zIndex: 2,
                boxShadow: "0 15px 30px rgba(61,111,168,.3)",
              }}
            >
              {step.icon}
            </div>

            <h3
              style={{
                marginTop: 25,
                color: "#111",
              }}
            >
              {step.title}
            </h3>

            <p
              style={{
                color: "#666",
                lineHeight: 1.7,
                fontSize: 15,
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