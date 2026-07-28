export let appSettings = {
  theme: "light",

  colors: {
    primary: "#3d6fa8",
    sidebar: "#FFFFFF",
    background: "#F8FBFF",
  },

  branding: {
  companyName: "OMTATVA DIGITALS",
  logo: "",
  backgroundImage: "",
  loginImage: "",
},

media: {
  welcomeVideo: "",
  announcementVideo: "",
  bannerImage: "",
},
  dashboard: {
    showAttendance: true,
    showLeave: true,
    showHoliday: true,
    showEmployee: true,
  },
      access: {
  users: [
    {
      name: "Main Admin",
      email: "admin@omtatvadigitals.com",
      role: "Super Admin",
      permissions: [
        "Dashboard",
        "Attendance",
        "Timesheet",
        "Leave",
        "Holiday",
        "Employees",
        "Reports",
        "Settings",
      ],
    },
  ],
},
};


export function updateAppSettings(data:any){

  appSettings = {
    ...appSettings,
    ...data,
    colors:{
      ...appSettings.colors,
      ...data.colors,
    },
    branding:{
      ...appSettings.branding,
      ...data.branding,
    },
    media:{
      ...appSettings.media,
      ...data.media,
    },
    dashboard:{
      ...appSettings.dashboard,
      ...data.dashboard,
    },
    access:{
...appSettings.access,
...data.access,
},

  };

}