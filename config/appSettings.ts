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
  // Company-wide annual leave quotas. LeavePage.js reads these instead
  // of hardcoding the numbers, so HR can adjust policy in one place.
  leavePolicy: {
    casualLeave: 12,
    sickLeave: 10,
    paidLeave: 18,
  },
  access: {
    users: [
      {
        name: "Main Admin",
        email: "admin@omtavta.com",
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

export function updateAppSettings(data: any) {
  appSettings = {
    ...appSettings,
    ...data,
    colors: {
      ...appSettings.colors,
      ...data.colors,
    },
    branding: {
      ...appSettings.branding,
      ...data.branding,
    },
    media: {
      ...appSettings.media,
      ...data.media,
    },
    dashboard: {
      ...appSettings.dashboard,
      ...data.dashboard,
    },
    leavePolicy: {
      ...appSettings.leavePolicy,
      ...data.leavePolicy,
    },
    access: {
      ...appSettings.access,
      ...data.access,
    },
  };
}