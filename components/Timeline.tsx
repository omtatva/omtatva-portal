"use client";

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
    <section style={{ maxWidth: 1300, margin: "70px auto", padding: "0 50px" }}>
      <div style={{ textAlign: "center", marginBottom: 45 }}>
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

        <h2 style={{ fontSize: 34, color: "#111", margin: "0 0 12px" }}>
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

      <div className="timeline-grid">
        {steps.map((step) => (
          <div key={step.title} className="timeline-step">
            <div className="timeline-circle">{step.icon}</div>

            <h3
              style={{
                marginTop: 18,
                marginBottom: 10,
                color: "#111",
                fontSize: 20,
              }}
            >
              {step.title}
            </h3>

            <p
              style={{
                color: "#666",
                lineHeight: 1.6,
                fontSize: 15,
                maxWidth: 170,
                margin: "0 auto",
              }}
            >
              {step.desc}
            </p>
          </div>
        ))}
      </div>

      <style jsx>{`
        .timeline-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 20px;
          align-items: start;
        }
        .timeline-step {
          text-align: center;
          padding: 10px;
          transition: transform 0.25s ease;
        }
        .timeline-step:hover {
          transform: translateY(-4px);
        }
        .timeline-circle {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: #3d6fa8;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 34px;
          margin: 0 auto;
          box-shadow: 0 15px 30px rgba(61, 111, 168, 0.3);
        }
        @media (max-width: 900px) {
          .timeline-grid {
            grid-template-columns: repeat(3, 1fr);
            row-gap: 36px;
          }
        }
        @media (max-width: 560px) {
          .timeline-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </section>
  );
}