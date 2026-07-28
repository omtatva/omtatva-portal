"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { appSettings } from "@/config/appSettings";

import {
  Home,
  LayoutDashboard,
  Bot,
  Clock3,
  CalendarCheck2,
  FileText,
  FolderOpen,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";

const menus = [
  { title: "Home", href: "/#top", icon: Home },
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "AI Workspace", href: "/workspace", icon: Bot },
  { title: "Attendance", href: "/attendance", icon: Clock3 },
  { title: "Timesheets", href: "/timesheet", icon: CalendarCheck2 },
  { title: "Leave", href: "/leave", icon: FileText },
  { title: "Documents", href: "/documents", icon: FolderOpen },
  { title: "Admin", href: "/admin", icon: Users },
  { title: "Settings", href: "/settings", icon: Settings },
];

// Every logged-in employee gets these, even if they're not listed in
// appSettings.access.users. Admin / Settings stay config-gated below.
const DEFAULT_EMPLOYEE_MENU = ["Dashboard", "Attendance", "Timesheets", "Leave"];

export default function Sidebar({ open }: { open: boolean }) {
  const pathname = usePathname();
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  // Mobile drawer state — fully separate from the desktop `open`
  // (260px / 80px) collapse prop passed in from the parent layout.
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setAuthUser(u);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Close the mobile drawer automatically whenever the route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Optional: matches against appSettings.access.users for admins/HR who
  // need elevated permissions (Admin, Settings, AI Workspace, Documents).
  // NOTE: assumes each entry has an "email" field.
  const currentUser = appSettings.access?.users?.find(
    (u: any) => u.email === authUser?.email
  );

  const visibleMenus = menus.filter((menu) => {
    if (menu.title === "Home") {
      return true;
    }

    // Not logged in yet / auth still resolving -> only Home shows
    if (!authReady || !authUser) {
      return false;
    }

    // Config-matched user (admin/HR etc.) — role-based access
    if (currentUser) {
      if (currentUser.role === "Super Admin") {
        return true;
      }
      if (menu.title === "Admin") {
        return (
          currentUser.role === "Admin" || currentUser.role === "HR Admin"
        );
      }
      if (menu.title === "Settings") {
        return (
          currentUser.role === "Admin" || currentUser.role === "Super Admin"
        );
      }
      if (currentUser.permissions?.includes(menu.title)) {
        return true;
      }
      // fall through to default-employee check below for everything else
    }

    // Regular employee not in the admin config (or matched but the item
    // isn't in their permissions list) — only the default baseline menu
    if (menu.title === "Admin" || menu.title === "Settings") {
      return false;
    }

    return DEFAULT_EMPLOYEE_MENU.includes(menu.title);
  });

  const handleLogout = async () => {
    try {
      await signOut(auth);
      window.location.href = "/login";
    } catch (error) {
      console.log("Logout error:", error);
    }
  };

  return (
    <>
      {/* Mobile-only hamburger button — hidden on desktop via CSS */}
      <button
        className="mobileSidebarToggle"
        aria-label={mobileOpen ? "Close menu" : "Open menu"}
        onClick={() => setMobileOpen((prev) => !prev)}
      >
        {mobileOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      {/* Dark backdrop behind the drawer — mobile only, tap to close */}
      <div
        className={`sidebarBackdrop ${mobileOpen ? "show" : ""}`}
        onClick={() => setMobileOpen(false)}
      />

      <aside
        className={`sidebar ${mobileOpen ? "mobileOpen" : ""}`}
        style={{
          width: open ? "260px" : "80px",
          background: appSettings.colors.sidebar,
          transition: "width 0.2s ease",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          height: "100vh",
          boxSizing: "border-box",
        }}
      >
        <nav>
          {visibleMenus.map((menu) => {
            const Icon = menu.icon;
            const isActive = pathname === menu.href;

            return (
              <Link
                key={menu.href}
                href={menu.href}
                aria-current={isActive ? "page" : undefined}
                className={isActive ? "active" : ""}
                style={{
                  justifyContent: open ? "flex-start" : "center",
                }}
              >
                <span className="iconBox">
                  <Icon size={20} />
                </span>

                {open && <span>{menu.title}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div
          style={{
            padding: "16px",
            borderTop: "1px solid rgba(0,0,0,.06)",
          }}
        >
          <button
            onClick={handleLogout}
            aria-label="Logout"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: open ? "flex-start" : "center",
              gap: 10,
              width: "100%",
              border: "none",
              background: "transparent",
              color: "#dc2626",
              cursor: "pointer",
              padding: "10px 8px",
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 15,
            }}
          >
            <LogOut size={20} />
            {open && <span>Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

// "use client";

// import Link from "next/link";
// import { usePathname } from "next/navigation";
// import { useEffect, useState } from "react";
// import { onAuthStateChanged, signOut, User } from "firebase/auth";
// import { auth } from "@/lib/firebase";
// import { appSettings } from "@/config/appSettings";

// import {
//   Home,
//   LayoutDashboard,
//   Bot,
//   Clock3,
//   CalendarCheck2,
//   FileText,
//   FolderOpen,
//   Users,
//   Settings,
//   LogOut,
// } from "lucide-react";

// const menus = [
//   { title: "Home", href: "/#top", icon: Home },
//   { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
//   { title: "AI Workspace", href: "/workspace", icon: Bot },
//   { title: "Attendance", href: "/attendance", icon: Clock3 },
//   { title: "Timesheets", href: "/timesheet", icon: CalendarCheck2 },
//   { title: "Leave", href: "/leave", icon: FileText },
//   { title: "Documents", href: "/documents", icon: FolderOpen },
//   { title: "Admin", href: "/admin", icon: Users },
//   { title: "Settings", href: "/settings", icon: Settings },
// ];

// // Every logged-in employee gets these, even if they're not listed in
// // appSettings.access.users. Admin / Settings stay config-gated below.
// const DEFAULT_EMPLOYEE_MENU = ["Dashboard", "Attendance", "Timesheets", "Leave"];

// export default function Sidebar({ open }: { open: boolean }) {
//   const pathname = usePathname();
//   const [authUser, setAuthUser] = useState<User | null>(null);
//   const [authReady, setAuthReady] = useState(false);

//   useEffect(() => {
//     const unsubscribe = onAuthStateChanged(auth, (u) => {
//       setAuthUser(u);
//       setAuthReady(true);
//     });
//     return () => unsubscribe();
//   }, []);

//   // Optional: matches against appSettings.access.users for admins/HR who
//   // need elevated permissions (Admin, Settings, AI Workspace, Documents).
//   // NOTE: assumes each entry has an "email" field.
//   const currentUser = appSettings.access?.users?.find(
//     (u: any) => u.email === authUser?.email
//   );

//   const visibleMenus = menus.filter((menu) => {
//     if (menu.title === "Home") {
//       return true;
//     }

//     // Not logged in yet / auth still resolving -> only Home shows
//     if (!authReady || !authUser) {
//       return false;
//     }

//     // Config-matched user (admin/HR etc.) — role-based access
//     if (currentUser) {
//       if (currentUser.role === "Super Admin") {
//         return true;
//       }
//       if (menu.title === "Admin") {
//         return (
//           currentUser.role === "Admin" || currentUser.role === "HR Admin"
//         );
//       }
//       if (menu.title === "Settings") {
//         return (
//           currentUser.role === "Admin" || currentUser.role === "Super Admin"
//         );
//       }
//       if (currentUser.permissions?.includes(menu.title)) {
//         return true;
//       }
//       // fall through to default-employee check below for everything else
//     }

//     // Regular employee not in the admin config (or matched but the item
//     // isn't in their permissions list) — only the default baseline menu
//     if (menu.title === "Admin" || menu.title === "Settings") {
//       return false;
//     }

//     return DEFAULT_EMPLOYEE_MENU.includes(menu.title);
//   });

//   const handleLogout = async () => {
//     try {
//       await signOut(auth);
//       window.location.href = "/login";
//     } catch (error) {
//       console.log("Logout error:", error);
//     }
//   };

//   return (
//     <aside
//       className="sidebar"
//       style={{
//         width: open ? "260px" : "80px",
//         background: appSettings.colors.sidebar,
//         transition: "width 0.2s ease",
//         display: "flex",
//         flexDirection: "column",
//         justifyContent: "space-between",
//         height: "100vh",
//         boxSizing: "border-box",
//       }}
//     >
//       <nav>
//         {visibleMenus.map((menu) => {
//           const Icon = menu.icon;
//           const isActive = pathname === menu.href;

//           return (
//             <Link
//               key={menu.href}
//               href={menu.href}
//               aria-current={isActive ? "page" : undefined}
//               className={isActive ? "active" : ""}
//               style={{
//                 justifyContent: open ? "flex-start" : "center",
//               }}
//             >
//               <span className="iconBox">
//                 <Icon size={20} />
//               </span>

//               {open && <span>{menu.title}</span>}
//             </Link>
//           );
//         })}
//       </nav>

//       {/* Logout */}
//       <div
//         style={{
//           padding: "16px",
//           borderTop: "1px solid rgba(0,0,0,.06)",
//         }}
//       >
//         <button
//           onClick={handleLogout}
//           aria-label="Logout"
//           style={{
//             display: "flex",
//             alignItems: "center",
//             justifyContent: open ? "flex-start" : "center",
//             gap: 10,
//             width: "100%",
//             border: "none",
//             background: "transparent",
//             color: "#dc2626",
//             cursor: "pointer",
//             padding: "10px 8px",
//             borderRadius: 8,
//             fontWeight: 600,
//             fontSize: 15,
//           }}
//         >
//           <LogOut size={20} />
//           {open && <span>Logout</span>}
//         </button>
//       </div>
//     </aside>
//   );
// }
// "use client";

// import Link from "next/link";
// import { usePathname } from "next/navigation";

// import { appSettings } from "@/config/appSettings";

// import {
//     Home,
//   LayoutDashboard,
//   Bot,
//   Clock3,
//   CalendarCheck2,
//   FileText,
//   FolderOpen,
//   Users,
//   Settings,
// } from "lucide-react";


// const menus = [
//     { title: "Home", href: "/#top", icon: Home },
//   { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
//   { title: "AI Workspace", href: "/workspace", icon: Bot },
//   { title: "Attendance", href: "/attendance", icon: Clock3 },
//   { title: "Timesheets", href: "/timesheet", icon: CalendarCheck2 },
//   { title: "Leave", href: "/leave", icon: FileText },
//   { title: "Documents", href: "/documents", icon: FolderOpen },
//   { title: "Admin", href: "/admin", icon: Users },
//   { title: "Settings", href: "/settings", icon: Settings },
// ];


// export default function Sidebar({
//   open,
// }: {
//   open: boolean;
// }) {

// const pathname = usePathname();


// // Current user
// const currentUser = appSettings.access?.users?.[0];



// const visibleMenus = menus.filter((menu)=>{


// // Super Admin ko sab dikhega
// if(currentUser?.role === "Super Admin"){
//   return true;
// }


// // Admin menu sirf admin ke liye
// if(menu.title === "Admin"){
//   return (
//     currentUser?.role === "Admin" ||
//     currentUser?.role === "HR Admin"
//   );
// }


// // Settings sirf admin ke liye
// if(menu.title === "Settings"){
//   return (
//     currentUser?.role === "Admin" ||
//     currentUser?.role === "Super Admin"
//   );
// }


// // baki permissions se
// return currentUser?.permissions?.includes(menu.title);


// });



// return (
// <aside
// className="sidebar"
// style={{
// width: open ? "260px" : "80px",
// background: appSettings.colors.sidebar,
// }}
// >


// <nav>

// {
// visibleMenus.map((menu)=>{

// const Icon = menu.icon;


// return (

// <Link
// key={menu.href}
// href={menu.href}
// className={pathname === menu.href ? "active" : ""}
// style={{
// justifyContent: open ? "flex-start" : "center",
// }}
// >


// <span className="iconBox">

// <Icon size={20}/>

// </span>


// {open && (
// <span>
// {menu.title}
// </span>
// )}


// </Link>

// )

// })

// }

// </nav>


// </aside>
// );

// }


// // "use client";

// // import Link from "next/link";
// // import { usePathname } from "next/navigation";
// // import {
// //   LayoutDashboard,
// //   Bot,
// //   Clock3,
// //   CalendarCheck2,
// //   FileText,
// //   FolderOpen,
// //   Users,
// //   Settings,
// //   LogOut,
// // } from "lucide-react";


// // const menus = [
// //   {
// //     title: "Dashboard",
// //     href: "/dashboard",
// //     icon: LayoutDashboard,
// //   },
// //   {
// //     title: "AI Workspace",
// //     href: "/workspace",
// //     icon: Bot,
// //   },
// //   {
// //     title: "Attendance",
// //     href: "/attendance",
// //     icon: Clock3,
// //   },
// //   {
// //     title: "Timesheets",
// //     href: "/timesheet",
// //     icon: CalendarCheck2,
// //   },
// //   {
// //     title: "Leave",
// //     href: "/leave",
// //     icon: FileText,
// //   },
// //   {
// //     title: "Documents",
// //     href: "/documents",
// //     icon: FolderOpen,
// //   },
// //   {
// //     title: "Employees",
// //     href: "/employees",
// //     icon: Users,
// //   },
// //   {
// //     title: "Settings",
// //     href: "/settings",
// //     icon: Settings,
// //   },
// // ];

// // export default function Sidebar({
// //   open,
// // }: {
// //   open: boolean;
// // }) {
// //   const pathname = usePathname();

// //   return (
// //     <aside
// //       className="sidebar"
// //       style={{
// //         transform: open ? "translateX(0)" : "translateX(-100%)",
// //       }}
// //     >
// //       {/* Existing sidebar code */}
// //     </aside>
// //   );
// // }


// // // "use client";

// // // import Link from "next/link";
// // // import { usePathname } from "next/navigation";
// // // import {
// // //   LayoutDashboard,
// // //   Bot,
// // //   Users,
// // //   Clock,
// // //   Settings,
// // //   LogOut,
// // // } from "lucide-react";

// // // export default function Sidebar() {
// // //   const pathname = usePathname();

// // //   const menus = [
// // //     {
// // //       name: "Dashboard",
// // //       href: "/dashboard",
// // //       icon: <LayoutDashboard size={18} />,
// // //     },
// // //     {
// // //       name: "AI Workspace",
// // //       href: "/workspace",
// // //       icon: <Bot size={18} />,
// // //     },
// // //     {
// // //       name: "Employees",
// // //       href: "/employees",
// // //       icon: <Users size={18} />,
// // //     },
// // //     {
// // //       name: "Attendance",
// // //       href: "/attendance",
// // //       icon: <Clock size={18} />,
// // //     },
// // //     {
// // //       name: "Settings",
// // //       href: "/settings",
// // //       icon: <Settings size={18} />,
// // //     },
// // //   ];

// // //   return (
// // //     <aside className="sidebar">
// // //       <h2 className="logo">OMTATVA</h2>

// // //       <nav>
// // //         {menus.map((item) => (
// // //           <Link
// // //             key={item.href}
// // //             href={item.href}
// // //             className={pathname === item.href ? "active" : ""}
// // //           >
// // //             {item.icon}
// // //             {item.name}
// // //           </Link>
// // //         ))}
// // //       </nav>

// // //       <Link href="/logout" className="logout">
// // //         <LogOut size={18} />
// // //         Logout
// // //       </Link>
// // //     </aside>
// // //   );
// // // }