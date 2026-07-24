"use client";

import Link from "next/link";
import {
  Palette,
  Image,
  Video,
  LayoutDashboard,
  Users,
  Bell,
  Shield,
  Database,
} from "lucide-react";

export default function SettingsPage() {

  const settings = [
    {
      title: "Appearance",
      icon: <Palette size={24}/>,
      desc: "Theme, colors and layout settings",
      link: "/settings/appearance",
    },
    {
      title: "Branding",
      icon: <Image size={24}/>,
      desc: "Logo, company name and images",
      link: "/settings/branding",
    },
    {
      title: "Media Manager",
      icon: <Video size={24}/>,
      desc: "Videos, banners and dashboard media",
      link: "/settings/media",
    },
    {
      title: "Dashboard Layout",
      icon: <LayoutDashboard size={24}/>,
      desc: "Manage dashboard cards and widgets",
      link: "/settings/dashboard",
    },
    {
      title: "Access Management",
      icon: <Users size={24}/>,
      desc: "Admin users, roles and permissions",
      link: "/settings/access",
    },
    {
      title: "Notifications",
      icon: <Bell size={24}/>,
      desc: "Alerts and announcements",
      link: "/settings/notifications",
    },
    {
      title: "Security",
      icon: <Shield size={24}/>,
      desc: "Password and login settings",
      link: "/settings/security",
    },
    {
      title: "Backup",
      icon: <Database size={24}/>,
      desc: "Export and restore settings",
      link: "/settings/backup",
    },
  ];


  return (

    <div
    style={{
      padding:"25px"
    }}
    >

      <h1
      style={{
        fontSize:"28px",
        fontWeight:700,
        marginBottom:25
      }}
      >
        ⚙ Settings
      </h1>


      <div
      style={{
        display:"grid",
        gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",
        gap:20
      }}
      >


      {
        settings.map((item)=>(
          
          <Link
          key={item.title}
          href={item.link}
          style={{
            textDecoration:"none",
            color:"inherit"
          }}
          >

          <div
          style={{
            background:"#fff",
            padding:"25px",
            borderRadius:"16px",
            boxShadow:"0 5px 20px rgba(0,0,0,.05)",
            cursor:"pointer",
            height:"150px"
          }}
          >

            <div
            style={{
              display:"flex",
              alignItems:"center",
              gap:12,
              fontSize:18,
              fontWeight:600,
              color:"#3d6fa8"
            }}
            >

              {item.icon}

              {item.title}

            </div>


            <p
            style={{
              color:"#64748B",
              marginTop:15
            }}
            >
              {item.desc}
            </p>


          </div>

          </Link>

        ))
      }


      </div>


    </div>

  );
}