"use client";

import Link from "next/link";

export default function Features() {

  const features = [
    {
      icon: "🕒",
      title: "Attendance Management",
      desc: "Smart check-in, check-out and attendance analytics.",
      link: "/attendance",
    },
    {
      icon: "📋",
      title: "Timesheet Tracking",
      desc: "Log project hours and manage daily productivity.",
      link: "/timesheet",
    },
    {
      icon: "🏖️",
      title: "Leave Management",
      desc: "Apply, approve and monitor employee leave digitally.",
      link: "/leave",
    },
    {
      icon: "⭐",
      title: "Performance Reviews",
      desc: "HR can evaluate and release employee performance ratings.",
      link: "/performance",
    },
    {
      icon: "💰",
      title: "Payroll",
      desc: "Generate salary slips and manage payroll securely.",
      link: "/payroll",
    },
    {
      icon: "📄",
      title: "Documents",
      desc: "Store payslips, contracts and HR documents safely.",
      link: "/documents",
    },
    {
      icon: "🤖",
      title: "AI Production",
      desc: "Track AI filmmaking workflow using Runway, Veo, Kling and more.",
      link: "/production",
    },
    {
      icon: "📊",
      title: "Reports & Analytics",
      desc: "Interactive dashboards with attendance and productivity insights.",
      link: "/reports",
    },
  ];


  return (
    <section
      style={{
        margin: "100px auto",
        padding: "0 30px",
      }}
    >

      <div
        style={{
          textAlign:"center",
          marginBottom:60,
        }}
      >

        <p
          style={{
            color:"#3d6fa8",
            fontWeight:700,
            letterSpacing:2,
          }}
        >
          PLATFORM FEATURES
        </p>


        <h2
          style={{
            fontSize:44,
            margin:"15px 0",
            color:"#111",
          }}
        >
          Everything You Need In One Platform
        </h2>


        <p
          style={{
            maxWidth:750,
            margin:"0 auto",
            color:"#444",
            fontSize:18,
            lineHeight:1.8,
          }}
        >
          Designed for HR teams, employees and AI production
          companies with modern workflows and enterprise security.
        </p>

      </div>



      <div
        style={{
          display:"grid",
          gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",
          gap:28,
        }}
      >

        {features.map((item)=>(

          <div
            key={item.title}
            style={{
              background:"#fff",
              borderRadius:24,
              padding:30,
              border:"1px solid #eaf3ff",
              boxShadow:"0 15px 35px rgba(0,0,0,.07)",
            }}
          >

            <div
              style={{
                width:70,
                height:70,
                borderRadius:18,
                background:"#eaf3ff",
                display:"flex",
                alignItems:"center",
                justifyContent:"center",
                fontSize:34,
                marginBottom:25,
              }}
            >
              {item.icon}
            </div>


            <h3
              style={{
                color:"#111",
                marginBottom:15,
              }}
            >
              {item.title}
            </h3>


            <p
              style={{
                color:"#666",
                lineHeight:1.8,
                fontSize:16,
              }}
            >
              {item.desc}
            </p>


            <Link href={item.link}>

              <button
                style={{
                  marginTop:25,
                  background:"#3d6fa8",
                  color:"#fff",
                  border:"none",
                  padding:"10px 22px",
                  borderRadius:10,
                  cursor:"pointer",
                  fontWeight:600,
                }}
              >
                Learn More →
              </button>

            </Link>


          </div>

        ))}

      </div>

    </section>
  );
}