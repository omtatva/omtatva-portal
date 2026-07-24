"use client";

import { Menu } from "lucide-react";
import { appSettings } from "@/config/appSettings";

interface Props {
  sidebarOpen: boolean;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function DashboardNavbar({
  sidebarOpen,
  setSidebarOpen,
}: Props) {

  return (
    <header
      style={{
        height: 70,
        background: appSettings.colors.sidebar,
        borderBottom: "1px solid #EAF3FF",
        display: "flex",
        alignItems: "center",
        padding: "0 20px",
        position: "sticky",
        top: 0,
        zIndex: 1000,
      }}
    >

      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        style={{
          border: "none",
          background: "transparent",
          cursor: "pointer",
          color: appSettings.colors.primary,
          display:"flex",
          alignItems:"center",
        }}
      >
        <Menu size={26} />
      </button>


      <div
        style={{
          display:"flex",
          alignItems:"center",
          gap:"12px",
          marginLeft:20,
        }}
      >

        {
          appSettings.branding.logo ? (

            <img
              src={appSettings.branding.logo}
              alt="logo"
              style={{
                height:40,
                width:40,
                borderRadius:8,
                objectFit:"contain",
              }}
            />

          ) : null
        }


        <h3
          style={{
            margin:0,
            color: appSettings.colors.primary,
            fontSize:"20px",
            fontWeight:700,
          }}
        >
          {appSettings.branding.companyName}
        </h3>


      </div>


    </header>
  );
}