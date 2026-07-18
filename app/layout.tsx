import Navbar from "@/components/navbar";
import "./globals.css";
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
  style={{
    margin: 0,
    padding: 0,
    background: "#f8fbff",
    fontFamily: "Inter, sans-serif",
    overflowX: "hidden",
  }}
>
  <Navbar />

  <main
    style={{
      width: "100%",
      padding: 0,
      margin: 0,
    }}
  >
    {children}
  </main>
</body>
    </html>
  );
}



// import "./globals.css";
// import Link from "next/link";
// import LogoutButton from "./components/LogoutButton";
// export const metadata = {
//   title: "AI Filmmaking Timesheet",
//   description: "Employee Timesheet System",
// };

// export default function RootLayout({
//   children,
// }: {
//   children: React.ReactNode;
// }) {
//   return (
//     <html lang="en">
//       <body>

//         <nav
//           style={{
//             background: "#eaf3ff",
//             borderBottom: "1px solid #e5e7eb",
//             padding: "15px 40px",
//             display: "flex",
//             justifyContent: "space-between",
//             alignItems: "center",
//             position: "sticky",
//             top: 0,
//             zIndex: 100,
//           }}
//         >
//           <div
//             style={{
//               fontSize: "22px",
//               fontWeight: "bold",
//               color: "#0f172a",
//             }}
//           >
//             OMTATVA DIGITALS
//           </div>

//           <div
//             style={{
//               display: "flex",
//               gap: "25px",
//               alignItems: "center",
//             }}
//           >
//             <Link href="/">Home</Link>

//             <Link href="/dashboard">Dashboard</Link>

//             <Link href="/attendance">Attendance</Link>
//             <Link href="/leave">Leave</Link>
//             <Link href="/timesheet">Timesheet</Link>

//             <Link href="/admin/users">
//                 Users
//             </Link>

//             <Link href="/admin">Admin</Link>

//             <LogoutButton />
//           </div>
//         </nav>

        

//         <main style={{ padding: "20px" }}>
//           {children}
//         </main>

//       </body>
//     </html>
//   );
// }