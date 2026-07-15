export default function Testimonials() {
  const testimonials = [
    {
      name: "Rahul Sharma",
      role: "AI Video Editor",
      image: "👨🏻",
      review:
        "The OMTATVA platform has completely simplified attendance, timesheets and AI production workflow.",
    },
    {
      name: "Priya Mehta",
      role: "HR Manager",
      image: "👩🏻",
      review:
        "Managing employees, leave approvals and performance reviews has become effortless.",
    },
    {
      name: "Aman Verma",
      role: "Creative Director",
      image: "🧑🏻",
      review:
        "Everything from AI production to payroll is available in one beautiful dashboard.",
    },
  ];

  return (
    <section
      style={{
        background: "#eaf3ff",
        padding: "100px 40px",
        marginTop: "80px",
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          margin: "auto",
        }}
      >
        <div
          style={{
            textAlign: "center",
            marginBottom: 60,
          }}
        >
          <p
            style={{
              color: "#3d6fa8",
              fontWeight: 700,
              letterSpacing: 2,
            }}
          >
            TESTIMONIALS
          </p>

          <h2
            style={{
              fontSize: 44,
              color: "#111111",
              marginTop: 10,
            }}
          >
            What Our Team Says
          </h2>

          <p
            style={{
              color: "#444",
              maxWidth: 700,
              margin: "20px auto",
              lineHeight: 1.8,
              fontSize: 18,
            }}
          >
            Our employees love working with the OMTATVA Digital
            Management Platform.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(320px,1fr))",
            gap: 30,
          }}
        >
          {testimonials.map((item) => (
            <div
              key={item.name}
              style={{
                background: "#fff",
                borderRadius: 24,
                padding: 35,
                boxShadow: "0 15px 40px rgba(0,0,0,.08)",
              }}
            >
              <div
                style={{
                  fontSize: 55,
                }}
              >
                {item.image}
              </div>

              <div
                style={{
                  marginTop: 15,
                  color: "#f59e0b",
                  fontSize: 20,
                }}
              >
                ⭐⭐⭐⭐⭐
              </div>

              <p
                style={{
                  color: "#444",
                  lineHeight: 1.9,
                  marginTop: 20,
                  fontSize: 16,
                }}
              >
                "{item.review}"
              </p>

              <hr
                style={{
                  margin: "25px 0",
                  border: "none",
                  borderTop: "1px solid #eee",
                }}
              />

              <h3
                style={{
                  margin: 0,
                  color: "#111",
                }}
              >
                {item.name}
              </h3>

              <p
                style={{
                  color: "#3d6fa8",
                  marginTop: 5,
                }}
              >
                {item.role}
              </p>
            </div>
          ))}
        </div>

        {/* Bottom Numbers */}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(220px,1fr))",
            gap: 25,
            marginTop: 80,
          }}
        >
          {[
            {
              value: "98%",
              title: "Employee Satisfaction",
            },
            {
              value: "100+",
              title: "Projects Delivered",
            },
            {
              value: "24/7",
              title: "Cloud Availability",
            },
            {
              value: "15+",
              title: "AI Technologies",
            },
          ].map((item) => (
            <div
              key={item.title}
              style={{
                background: "#fff",
                padding: 30,
                borderRadius: 22,
                textAlign: "center",
                boxShadow: "0 10px 30px rgba(0,0,0,.06)",
              }}
            >
              <h1
                style={{
                  color: "#3d6fa8",
                  fontSize: 46,
                  margin: 0,
                }}
              >
                {item.value}
              </h1>

              <p
                style={{
                  color: "#555",
                  marginTop: 10,
                }}
              >
                {item.title}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}