"use client";

import { useState } from "react";
import Link from "next/link";

const features = [
  {
    icon: "🕒",
    title: "Attendance Management",
    desc: "Smart check-in, check-out and attendance analytics.",
    link: "/attendance",
    details: [
      "Punch In from the Attendance page — your phone/laptop's GPS location is checked against the office location automatically.",
      "If you punch in within the allowed time + grace period, you're marked Present. After that, you're marked Late.",
      "Punch Out anytime after you're done for the day — your total working hours are calculated automatically from Punch In to Punch Out.",
      "Staying past a buffer window after office closing time is counted as Extra Hours automatically.",
      "If you forget to Punch Out, that day shows as Incomplete — you can report the time you actually left, and HR/Admin will review and update it.",
      "You can track your full attendance history, working hours trend and calendar view — all from the same Attendance page.",
    ],
  },
  {
    icon: "📋",
    title: "Timesheet Tracking",
    desc: "Log project hours and manage daily productivity.",
    link: "/timesheet",
    details: [
      "Log the client, task, AI tool used, and hours/minutes worked for each work update.",
      "Add notes describing what you worked on, and mark the current status (Completed, In Progress, Pending Review, Blocked).",
      "View your full work history on the same page to track your productivity over time.",
    ],
  },
  {
    icon: "🏖️",
    title: "Leave Management",
    desc: "Apply, approve and monitor employee leave digitally.",
    link: "/leave",
    details: [
      "Apply for Casual, Sick, Paid, Emergency Leave or LOP by selecting a date range and reason.",
      "Track your leave balance (used, pending, allocated) for each leave type.",
      "Work From Home requests are tracked separately and don't use your leave balance.",
      "All requests go to HR/Admin for approval — you can track the status (Pending, Approved, Rejected) in your history.",
    ],
  },
  {
    icon: "⭐",
    title: "Performance Reviews",
    desc: "Evaluate employees with structured performance reviews.",
    link: "/performance",
    details: [
      "HR rates your performance periodically based on your work and attendance.",
      "Your latest rating is visible on your Dashboard, along with when it was last updated.",
    ],
  },
  {
    icon: "💰",
    title: "Payroll",
    desc: "Generate salary slips and manage payroll securely.",
    link: "/payroll",
    details: [
      "Your salary structure is set up by HR/Admin based on your employment details.",
      "Monthly payslips are generated and made available for you to view and download from My Documents.",
    ],
  },
  {
    icon: "📄",
    title: "Documents",
    desc: "Store payslips, contracts and HR documents safely.",
    link: "/documents",
    details: [
      "All your payslips, offer letters, and HR-shared documents are available in one place.",
      "Onboarding documents you uploaded (Aadhaar, PAN, resume, etc.) are also accessible here.",
      "Use the search and category filters to quickly find a specific document.",
    ],
  },
  {
    icon: "🤖",
    title: "AI Production",
    desc: "Manage AI filmmaking workflows using modern AI tools.",
    link: "/workspace",
    details: [
      "Access AI tools for scripting, image/video generation, voice generation and editing — all in one workspace.",
      "Quickly open external tools like ChatGPT, Midjourney, Runway and more directly from the workspace.",
    ],
  },
  {
    icon: "📊",
    title: "Reports & Analytics",
    desc: "Interactive dashboards with business insights.",
    link: "/reports",
    details: [
      "View attendance, timesheet and leave trends in visual charts.",
      "HR/Admin can use these insights to track team productivity and attendance patterns.",
    ],
  },
];

export default function Features() {
  const [selected, setSelected] = useState(null);

  return (
    <section style={{ margin: "70px auto", padding: "0 50px" }}>
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
          PLATFORM FEATURES
        </p>

        <h2 style={{ fontSize: 34, margin: "0 0 12px", color: "#111" }}>
          Everything You Need In One Platform
        </h2>

        <p
          style={{
            maxWidth: 650,
            margin: "0 auto",
            color: "#555",
            fontSize: 17,
            lineHeight: 1.6,
          }}
        >
          Designed for HR teams, employees and AI production companies with
          secure, cloud-based workflows.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
          gap: 22,
        }}
      >
        {features.map((item) => (
          <div key={item.title} className="feature-card">
            <div
              style={{
                width: 58,
                height: 58,
                borderRadius: 14,
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

            <h3 style={{ color: "#111", fontSize: 22, margin: "0 0 10px" }}>
              {item.title}
            </h3>

            <p
              style={{
                color: "#666",
                lineHeight: 1.6,
                fontSize: 15,
                minHeight: 70,
              }}
            >
              {item.desc}
            </p>

            <button
              className="feature-btn"
              onClick={() => setSelected(item)}
            >
              Learn More →
            </button>
          </div>
        ))}
      </div>

      {/* LEARN MORE MODAL */}
      {selected && (
        <div
          className="feature-modal-overlay"
          onClick={() => setSelected(null)}
        >
          <div
            className="feature-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="feature-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div className="feature-modal-icon">{selected.icon}</div>
                <h3 style={{ margin: 0, fontSize: 22, color: "#111" }}>
                  {selected.title}
                </h3>
              </div>

              <button
                className="feature-modal-close"
                onClick={() => setSelected(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <p style={{ color: "#555", fontSize: 15, lineHeight: 1.6, marginTop: 16 }}>
              {selected.desc}
            </p>

            <ul className="feature-modal-list">
              {selected.details.map((point, index) => (
                <li key={index}>{point}</li>
              ))}
            </ul>

            <div className="feature-modal-actions">
              <Link href={selected.link}>
                <button className="feature-btn">Go to {selected.title.split(" ")[0]} →</button>
              </Link>

              <button
                className="feature-modal-cancel"
                onClick={() => setSelected(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .feature-card {
          background: #fff;
          border-radius: 24px;
          padding: 30px;
          border: 1px solid #eaf3ff;
          box-shadow: 0 15px 35px rgba(0, 0, 0, 0.07);
          transition: transform 0.25s ease, box-shadow 0.25s ease;
        }
        .feature-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 20px 45px rgba(61, 111, 168, 0.18);
        }
        .feature-btn {
          margin-top: 18px;
          background: #3d6fa8;
          color: #fff;
          border: none;
          padding: 10px 18px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          font-size: 14px;
          transition: background 0.2s ease;
        }
        .feature-btn:hover {
          background: #2f5687;
        }
        .feature-btn:focus-visible,
        .feature-card a:focus-visible {
          outline: 3px solid #66a8e0;
          outline-offset: 2px;
        }

        .feature-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999;
          padding: 16px;
          box-sizing: border-box;
        }
        .feature-modal {
          background: #fff;
          border-radius: 22px;
          padding: 30px;
          max-width: 560px;
          width: 100%;
          max-height: 85vh;
          overflow-y: auto;
          box-shadow: 0 25px 60px rgba(0, 0, 0, 0.25);
        }
        .feature-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }
        .feature-modal-icon {
          width: 46px;
          height: 46px;
          border-radius: 12px;
          background: #eef6ff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          flex-shrink: 0;
        }
        .feature-modal-close {
          background: #f1f5f9;
          border: none;
          width: 34px;
          height: 34px;
          border-radius: 10px;
          font-size: 16px;
          cursor: pointer;
          flex-shrink: 0;
        }
        .feature-modal-list {
          margin: 18px 0 0;
          padding-left: 20px;
          color: #444;
          font-size: 14.5px;
          line-height: 1.7;
        }
        .feature-modal-list li {
          margin-bottom: 10px;
        }
        .feature-modal-actions {
          display: flex;
          gap: 12px;
          margin-top: 24px;
          flex-wrap: wrap;
        }
        .feature-modal-cancel {
          background: #f1f5f9;
          color: #334155;
          border: none;
          padding: 10px 18px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          font-size: 14px;
          margin-top: 18px;
        }

        @media (max-width: 600px) {
          .feature-modal {
            padding: 22px;
            border-radius: 18px;
          }
          .feature-modal-header h3 {
            font-size: 19px !important;
          }
          .feature-modal-actions {
            flex-direction: column;
          }
          .feature-modal-actions a,
          .feature-modal-actions button {
            width: 100%;
          }
          .feature-modal-actions .feature-btn,
          .feature-modal-cancel {
            margin-top: 0;
            width: 100%;
            box-sizing: border-box;
          }
        }
      `}</style>
    </section>
  );
}


// "use client";

// import Link from "next/link";

// export default function Features() {
//   const features = [
//     {
//       icon: "🕒",
//       title: "Attendance Management",
//       desc: "Smart check-in, check-out and attendance analytics.",
//       link: "/attendance",
//     },
//     {
//       icon: "📋",
//       title: "Timesheet Tracking",
//       desc: "Log project hours and manage daily productivity.",
//       link: "/timesheet",
//     },
//     {
//       icon: "🏖️",
//       title: "Leave Management",
//       desc: "Apply, approve and monitor employee leave digitally.",
//       link: "/leave",
//     },
//     {
//       icon: "⭐",
//       title: "Performance Reviews",
//       desc: "Evaluate employees with structured performance reviews.",
//       link: "/performance",
//     },
//     {
//       icon: "💰",
//       title: "Payroll",
//       desc: "Generate salary slips and manage payroll securely.",
//       link: "/payroll",
//     },
//     {
//       icon: "📄",
//       title: "Documents",
//       desc: "Store payslips, contracts and HR documents safely.",
//       link: "/documents",
//     },
//     {
//       icon: "🤖",
//       title: "AI Production",
//       desc: "Manage AI filmmaking workflows using modern AI tools.",
//       link: "/production",
//     },
//     {
//       icon: "📊",
//       title: "Reports & Analytics",
//       desc: "Interactive dashboards with business insights.",
//       link: "/reports",
//     },
//   ];

//   return (
//     <section
//       style={{
//         margin: "70px auto",
//         padding: "0 50px",
//       }}
//     >
//       <div
//         style={{
//           textAlign: "center",
//           marginBottom: 45,
//         }}
//       >
//         <p
//           style={{
//             color: "#3d6fa8",
//             fontWeight: 700,
//             letterSpacing: 2,
//             fontSize: 14,
//             marginBottom: 8,
//           }}
//         >
//           PLATFORM FEATURES
//         </p>

//         <h2
//           style={{
//             fontSize: 34,
//             margin: "0 0 12px",
//             color: "#111",
//           }}
//         >
//           Everything You Need In One Platform
//         </h2>

//         <p
//           style={{
//             maxWidth: 650,
//             margin: "0 auto",
//             color: "#555",
//             fontSize: 17,
//             lineHeight: 1.6,
//           }}
//         >
//           Designed for HR teams, employees and AI production companies with
//           secure, cloud-based workflows.
//         </p>
//       </div>

//       <div
//         style={{
//           display: "grid",
//           gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
//           gap: 22,
//         }}
//       >
//         {features.map((item) => (
//          <div
//   key={item.title}
//   className="feature-card"
//   style={{
//     background: "#fff",
//     borderRadius: 24,
//     padding: 30,
//     border: "1px solid #eaf3ff",
//     boxShadow: "0 15px 35px rgba(0,0,0,.07)",
//   }}
// >
//             <div
//               style={{
//                 width: 58,
//                 height: 58,
//                 borderRadius: 14,
//                 background: "#eef6ff",
//                 display: "flex",
//                 alignItems: "center",
//                 justifyContent: "center",
//                 fontSize: 28,
//                 marginBottom: 18,
//               }}
//             >
//               {item.icon}
//             </div>

//             <h3
//               style={{
//                 color: "#111",
//                 fontSize: 22,
//                 margin: "0 0 10px",
//               }}
//             >
//               {item.title}
//             </h3>

//             <p
//               style={{
//                 color: "#666",
//                 lineHeight: 1.6,
//                 fontSize: 15,
//                 minHeight: 70,
//               }}
//             >
//               {item.desc}
//             </p>

//             <Link href={item.link}>
//               <button
//                 style={{
//                   marginTop: 18,
//                   background: "#3d6fa8",
//                   color: "#fff",
//                   border: "none",
//                   padding: "10px 18px",
//                   borderRadius: 8,
//                   cursor: "pointer",
//                   fontWeight: 600,
//                   fontSize: 14,
//                 }}
//               >
//                 Learn More →
//               </button>
//             </Link>
//           </div>
//         ))}
//       </div>
//     </section>
//   );
// }


// "use client";

// import Link from "next/link";

// const features = [
//   {
//     icon: "🕒",
//     title: "Attendance Management",
//     desc: "Smart check-in, check-out and attendance analytics.",
//     link: "/attendance",
//   },
//   {
//     icon: "📋",
//     title: "Timesheet Tracking",
//     desc: "Log project hours and manage daily productivity.",
//     link: "/timesheet",
//   },
//   {
//     icon: "🏖️",
//     title: "Leave Management",
//     desc: "Apply, approve and monitor employee leave digitally.",
//     link: "/leave",
//   },
//   {
//     icon: "⭐",
//     title: "Performance Reviews",
//     desc: "Evaluate employees with structured performance reviews.",
//     link: "/performance",
//   },
//   {
//     icon: "💰",
//     title: "Payroll",
//     desc: "Generate salary slips and manage payroll securely.",
//     link: "/payroll",
//   },
//   {
//     icon: "📄",
//     title: "Documents",
//     desc: "Store payslips, contracts and HR documents safely.",
//     link: "/documents",
//   },
//   {
//     icon: "🤖",
//     title: "AI Production",
//     desc: "Manage AI filmmaking workflows using modern AI tools.",
//     link: "/ai-production",
//   },
//   {
//     icon: "📊",
//     title: "Reports & Analytics",
//     desc: "Interactive dashboards with business insights.",
//     link: "/reports",
//   },
// ];

// export default function Features() {
//   return (
//     <section style={{ margin: "70px auto", padding: "0 50px" }}>
//       <div style={{ textAlign: "center", marginBottom: 45 }}>
//         <p
//           style={{
//             color: "#3d6fa8",
//             fontWeight: 700,
//             letterSpacing: 2,
//             fontSize: 14,
//             marginBottom: 8,
//           }}
//         >
//           PLATFORM FEATURES
//         </p>

//         <h2 style={{ fontSize: 34, margin: "0 0 12px", color: "#111" }}>
//           Everything You Need In One Platform
//         </h2>

//         <p
//           style={{
//             maxWidth: 650,
//             margin: "0 auto",
//             color: "#555",
//             fontSize: 17,
//             lineHeight: 1.6,
//           }}
//         >
//           Designed for HR teams, employees and AI production companies with
//           secure, cloud-based workflows.
//         </p>
//       </div>

//       <div
//         style={{
//           display: "grid",
//           gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
//           gap: 22,
//         }}
//       >
//         {features.map((item) => (
//           <div key={item.title} className="feature-card">
//             <div
//               style={{
//                 width: 58,
//                 height: 58,
//                 borderRadius: 14,
//                 background: "#eef6ff",
//                 display: "flex",
//                 alignItems: "center",
//                 justifyContent: "center",
//                 fontSize: 28,
//                 marginBottom: 18,
//               }}
//             >
//               {item.icon}
//             </div>

//             <h3 style={{ color: "#111", fontSize: 22, margin: "0 0 10px" }}>
//               {item.title}
//             </h3>

//             <p
//               style={{
//                 color: "#666",
//                 lineHeight: 1.6,
//                 fontSize: 15,
//                 minHeight: 70,
//               }}
//             >
//               {item.desc}
//             </p>

//             <Link href={item.link}>
//               <button className="feature-btn">Learn More →</button>
//             </Link>
//           </div>
//         ))}
//       </div>

//       <style jsx>{`
//         .feature-card {
//           background: #fff;
//           border-radius: 24px;
//           padding: 30px;
//           border: 1px solid #eaf3ff;
//           box-shadow: 0 15px 35px rgba(0, 0, 0, 0.07);
//           transition: transform 0.25s ease, box-shadow 0.25s ease;
//         }
//         .feature-card:hover {
//           transform: translateY(-6px);
//           box-shadow: 0 20px 45px rgba(61, 111, 168, 0.18);
//         }
//         .feature-btn {
//           margin-top: 18px;
//           background: #3d6fa8;
//           color: #fff;
//           border: none;
//           padding: 10px 18px;
//           border-radius: 8px;
//           cursor: pointer;
//           font-weight: 600;
//           font-size: 14px;
//           transition: background 0.2s ease;
//         }
//         .feature-btn:hover {
//           background: #2f5687;
//         }
//         .feature-btn:focus-visible,
//         .feature-card a:focus-visible {
//           outline: 3px solid #66a8e0;
//           outline-offset: 2px;
//         }
//       `}</style>
//     </section>
//   );
// }