import Hero from "@/components/Hero";
import Stats from "@/components/Stats";
import Features from "@/components/Features";
import Timeline from "@/components/Timeline";
import Testimonials from "@/components/Testimonials";
import Footer from "@/components/Footer";

export default function HomePage() {
  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        background: "#f7fbff",
        overflowX: "hidden",
      }}
    >
      <Hero />
      <Stats />
      <Features />
      <Timeline />
      <Testimonials />
      <Footer />
    </div>
  );
}












// import { CSSProperties } from "react";
// export default function HomePage() {
//   return (
//     <div>
      
//       {/* HERO SECTION */}

//       {/* ================= HERO ================= */}

// <section
//   style={{
//     marginTop: 40,
//     borderRadius: 30,
//     overflow: "hidden",
//     background:
//       "linear-gradient(135deg,#3d6fa8,#66a8e0)",
//     padding: "70px",
//     display: "grid",
//     gridTemplateColumns: "1fr 1fr",
//     gap: 60,
//     alignItems: "center",
//   }}
// >
//   {/* Left */}

//   <div>
//     <img
//       src="/logo.png"
//       style={{
//         width: 90,
//         marginBottom: 20,
//       }}
//     />

//     <h1
//       style={{
//         color: "#fff",
//         fontSize: 64,
//         lineHeight: 1.1,
//         marginBottom: 25,
//       }}
//     >
//       AI Production &
//       <br />
//       HR Management
//     </h1>

//     <p
//       style={{
//         color: "#f8fafc",
//         fontSize: 21,
//         lineHeight: 1.8,
//         marginBottom: 40,
//       }}
//     >
//       Everything your company needs
//       to manage employees,
//       attendance,
//       production,
//       payroll,
//       leave,
//       documents
//       and AI workflows
//       in one beautiful platform.
//     </p>

//     <div
//       style={{
//         display: "flex",
//         gap: 20,
//       }}
//     >
//       <button
//         style={{
//           padding: "16px 35px",
//           borderRadius: 14,
//           border: "none",
//           background: "#fff",
//           color: "#3d6fa8",
//           fontWeight: 700,
//           fontSize: 16,
//         }}
//       >
//         Employee Login
//       </button>

//       <button
//         style={{
//           padding: "16px 35px",
//           borderRadius: 14,
//           border: "2px solid #fff",
//           background: "transparent",
//           color: "#fff",
//           fontWeight: 700,
//           fontSize: 16,
//         }}
//       >
//         Watch Demo
//       </button>
//     </div>
//   </div>

//   {/* Right */}

//   <div>
//     <video
//       autoPlay
//       muted
//       loop
//       playsInline
//       style={{
//         width: "100%",
//         borderRadius: 25,
//         boxShadow:
//           "0 25px 60px rgba(0,0,0,.25)",
//       }}
//     >
//       <source
//         src="/company.mp4"
//         type="video/mp4"
//       />
//     </video>
//   </div>
// </section>
//       {/* STATS */}
// {/* ================= COMPANY STATS ================= */}

// <section
//   style={{
//     marginTop: "60px",
//     display: "grid",
//     gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))",
//     gap: "25px",
//   }}
// >
//   {[
//     {
//       title: "Employees",
//       value: "20+",
//       icon: "👨‍💼",
//       color: "#3d6fa8",
//     },
//     {
//       title: "Projects",
//       value: "10+",
//       icon: "🎬",
//       color: "#66a8e0",
//     },
//     {
//       title: "AI Tools",
//       value: "15+",
//       icon: "🤖",
//       color: "#4f46e5",
//     },
//     {
//       title: "Production Hours",
//       value: "1000+",
//       icon: "⏱",
//       color: "#16a34a",
//     },
//   ].map((item) => (
//     <div
//       key={item.title}
//       style={{
//         background: "#fff",
//         borderRadius: 24,
//         padding: 35,
//         textAlign: "center",
//         boxShadow: "0 12px 35px rgba(0,0,0,.08)",
//         transition: ".3s",
//         cursor: "pointer",
//       }}
//     >
//       <div
//         style={{
//           width: 75,
//           height: 75,
//           borderRadius: "50%",
//           margin: "0 auto",
//           background: "#eaf3ff",
//           display: "flex",
//           alignItems: "center",
//           justifyContent: "center",
//           fontSize: 34,
//         }}
//       >
//         {item.icon}
//       </div>

//       <h1
//         style={{
//           marginTop: 20,
//           fontSize: 46,
//           color: item.color,
//         }}
//       >
//         {item.value}
//       </h1>

//       <h3>{item.title}</h3>
//     </div>
//   ))}
// </section>

//       {/* ABOUT */}

//       <section
//         style={{
//           marginTop: "60px",
//           padding: "30px",
//           background: "#f8fafc",
//           borderRadius: "10px",
//         }}
//       >
//         <h2>About OMTATVA DIGITALS</h2>

//         <p
//           style={{
//             lineHeight: "1.8",
//             marginTop: "15px",
//           }}
//         >
//           OMTATVA DIGITALS specializes in AI-powered
//           filmmaking, creative automation, video production,
//           virtual production workflows, and next-generation
//           storytelling using cutting-edge AI technologies.
//         </p>
//       </section>

//       {/* FOOTER */}

//       <footer
//         style={{
//           textAlign: "center",
//           marginTop: "60px",
//           padding: "20px",
//           color: "#666",
//         }}
//       >
//         © 2026 OMTATVA DIGITALS | AI Production Management Platform
//       </footer>
//     </div>
//   );
// }

// const styles: {
//   card: CSSProperties;
//   featureCard: CSSProperties;
//   primaryButton: CSSProperties;
//   secondaryButton: CSSProperties;

//   statCard: CSSProperties;
//   iconCircle: CSSProperties;
//   statNumber: CSSProperties;
//   statTitle: CSSProperties;
//   statText: CSSProperties;
//   featureModernCard: CSSProperties;
// featureIcon: CSSProperties;
// } = {
//   card: {
//     background: "#fff",
//     padding: "25px",
//     borderRadius: "12px",
//     boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
//     textAlign: "center",
//   },

//   featureCard: {
//     background: "#fff",
//     padding: "25px",
//     borderRadius: "12px",
//     boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
//   },

//   primaryButton: {
//     padding: "12px 25px",
//     backgroundColor: "#2563eb",
//     color: "#fff",
//     border: "none",
//     borderRadius: "8px",
//     cursor: "pointer",
//   },

//   secondaryButton: {
//     padding: "12px 25px",
//     backgroundColor: "#334155",
//     color: "#fff",
//     border: "none",
//     borderRadius: "8px",
//     cursor: "pointer",
//   },
//   statCard: {
//   background: "#ffffff",
//   padding: "35px",
//   borderRadius: "20px",
//   textAlign: "center",
//   border: "1px solid #eaf3ff",
//   boxShadow: "0 15px 35px rgba(61,111,168,.12)",
//   transition: ".3s",
// },

// iconCircle: {
//   width: "80px",
//   height: "80px",
//   borderRadius: "50%",
//   background: "#eaf3ff",
//   display: "flex",
//   justifyContent: "center",
//   alignItems: "center",
//   fontSize: "38px",
//   margin: "0 auto 20px",
// },

// statNumber: {
//   fontSize: "48px",
//   color: "#3d6fa8",
//   margin: "10px 0",
//   fontWeight: 800,
// },

// statTitle: {
//   color: "#111111",
//   fontSize: "22px",
//   marginBottom: "10px",
// },

// statText: {
//   color: "#444444",
//   lineHeight: 1.6,
// },
// featureModernCard: {
//   background: "#ffffff",
//   padding: "35px",
//   borderRadius: "20px",
//   border: "1px solid #eaf3ff",
//   boxShadow: "0 15px 35px rgba(61,111,168,.10)",
//   transition: ".3s",
// },

// featureIcon: {
//   width: "70px",
//   height: "70px",
//   borderRadius: "18px",
//   background: "#eaf3ff",
//   display: "flex",
//   justifyContent: "center",
//   alignItems: "center",
//   fontSize: "34px",
//   marginBottom: "20px",
// },
// };


