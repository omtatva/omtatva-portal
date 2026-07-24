"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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


export default function Sidebar({
  open,
}: {
  open: boolean;
}) {

const pathname = usePathname();


// Current user
const currentUser = appSettings.access?.users?.[0];



const visibleMenus = menus.filter((menu)=>{


// Super Admin ko sab dikhega
if(currentUser?.role === "Super Admin"){
  return true;
}


// Admin menu sirf admin ke liye
if(menu.title === "Admin"){
  return (
    currentUser?.role === "Admin" ||
    currentUser?.role === "HR Admin"
  );
}


// Settings sirf admin ke liye
if(menu.title === "Settings"){
  return (
    currentUser?.role === "Admin" ||
    currentUser?.role === "Super Admin"
  );
}


// baki permissions se
return currentUser?.permissions?.includes(menu.title);


});



return (
<aside
className="sidebar"
style={{
width: open ? "260px" : "80px",
background: appSettings.colors.sidebar,
}}
>


<nav>

{
visibleMenus.map((menu)=>{

const Icon = menu.icon;


return (

<Link
key={menu.href}
href={menu.href}
className={pathname === menu.href ? "active" : ""}
style={{
justifyContent: open ? "flex-start" : "center",
}}
>


<span className="iconBox">

<Icon size={20}/>

</span>


{open && (
<span>
{menu.title}
</span>
)}


</Link>

)

})

}

</nav>


</aside>
);

}


// "use client";

// import Link from "next/link";
// import { usePathname } from "next/navigation";
// import {
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
//   {
//     title: "Dashboard",
//     href: "/dashboard",
//     icon: LayoutDashboard,
//   },
//   {
//     title: "AI Workspace",
//     href: "/workspace",
//     icon: Bot,
//   },
//   {
//     title: "Attendance",
//     href: "/attendance",
//     icon: Clock3,
//   },
//   {
//     title: "Timesheets",
//     href: "/timesheet",
//     icon: CalendarCheck2,
//   },
//   {
//     title: "Leave",
//     href: "/leave",
//     icon: FileText,
//   },
//   {
//     title: "Documents",
//     href: "/documents",
//     icon: FolderOpen,
//   },
//   {
//     title: "Employees",
//     href: "/employees",
//     icon: Users,
//   },
//   {
//     title: "Settings",
//     href: "/settings",
//     icon: Settings,
//   },
// ];

// export default function Sidebar({
//   open,
// }: {
//   open: boolean;
// }) {
//   const pathname = usePathname();

//   return (
//     <aside
//       className="sidebar"
//       style={{
//         transform: open ? "translateX(0)" : "translateX(-100%)",
//       }}
//     >
//       {/* Existing sidebar code */}
//     </aside>
//   );
// }


// // "use client";

// // import Link from "next/link";
// // import { usePathname } from "next/navigation";
// // import {
// //   LayoutDashboard,
// //   Bot,
// //   Users,
// //   Clock,
// //   Settings,
// //   LogOut,
// // } from "lucide-react";

// // export default function Sidebar() {
// //   const pathname = usePathname();

// //   const menus = [
// //     {
// //       name: "Dashboard",
// //       href: "/dashboard",
// //       icon: <LayoutDashboard size={18} />,
// //     },
// //     {
// //       name: "AI Workspace",
// //       href: "/workspace",
// //       icon: <Bot size={18} />,
// //     },
// //     {
// //       name: "Employees",
// //       href: "/employees",
// //       icon: <Users size={18} />,
// //     },
// //     {
// //       name: "Attendance",
// //       href: "/attendance",
// //       icon: <Clock size={18} />,
// //     },
// //     {
// //       name: "Settings",
// //       href: "/settings",
// //       icon: <Settings size={18} />,
// //     },
// //   ];

// //   return (
// //     <aside className="sidebar">
// //       <h2 className="logo">OMTATVA</h2>

// //       <nav>
// //         {menus.map((item) => (
// //           <Link
// //             key={item.href}
// //             href={item.href}
// //             className={pathname === item.href ? "active" : ""}
// //           >
// //             {item.icon}
// //             {item.name}
// //           </Link>
// //         ))}
// //       </nav>

// //       <Link href="/logout" className="logout">
// //         <LogOut size={18} />
// //         Logout
// //       </Link>
// //     </aside>
// //   );
// // }