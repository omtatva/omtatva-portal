"use client";

import { useEffect, useState } from "react";

import { onAuthStateChanged } from "firebase/auth";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import { auth, db } from "@/lib/firebase";

import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  getDoc,
} from "firebase/firestore";

import AttendanceCalendar from "./AttendanceCalendar";

export default function AttendancePage() {
  const [user, setUser] = useState(null);
  const [todayData, setTodayData] = useState(null);
  const [history, setHistory] = useState([]);
  const [attendanceRules, setAttendanceRules] = useState(null);
  const [locationStatus, setLocationStatus] = useState("");
  const [distance, setDistance] = useState(0);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [attendanceSource, setAttendanceSource] = useState("Loading...");
  const [insideOffice, setInsideOffice] = useState(false);
  const [stats, setStats] = useState({
    present: 0,
    absent: 0,
    late: 0,
    incomplete: 0,
    hours: 0,
  });
  const [holidayDates, setHolidayDates] = useState(new Set());
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [requestTimes, setRequestTimes] = useState({});
  const [requestNotes, setRequestNotes] = useState({});
  const [submittingId, setSubmittingId] = useState(null);

  const today = new Date().toISOString().substring(0, 10);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        window.location.href = "/login";
        return;
      }

      setUser(currentUser);
      setAttendanceSource(getAttendanceSource());

      const rules = await loadAttendanceRules();
      const holidays = await loadHolidayDates();
      setHolidayDates(holidays);

      await loadToday(currentUser.uid);

      // Backfill any missing past working days as "Absent" before
      // loading history, so the dashboard (and anything reading the
      // attendance collection, e.g. payroll) sees them. Company
      // holidays are excluded so they don't get marked Absent.
      await syncMissingAbsences(currentUser.uid, holidays);
      await loadHistory(currentUser.uid, rules);

      if (rules) {
        await checkOfficeRange(rules);
      }
    });

    return () => unsubscribe();
  }, []);

  // =======================
  // LOAD ATTENDANCE RULES
  // =======================

  async function loadAttendanceRules() {
    try {
      const snap = await getDoc(doc(db, "settings", "attendanceRules"));

      if (snap.exists()) {
        const rules = snap.data();
        setAttendanceRules(rules);
        return rules;
      }

      return null;
    } catch (error) {
      console.log(error);
      return null;
    }
  }

  // =======================
  // DATE HELPERS
  // =======================

  function convertDate(value) {
    if (!value) return null;
    if (value.toDate) return value.toDate();
    return new Date(value);
  }

  function formatTime(value) {
    const d = convertDate(value);
    if (!d) return "--";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  // Fetches the "holidays" collection (added in HolidaysPage.js) and
  // returns a Set of "YYYY-MM-DD" strings for quick lookup.
  async function loadHolidayDates() {
    try {
      const snap = await getDocs(collection(db, "holidays"));
      return new Set(snap.docs.map((d) => d.data().date));
    } catch (error) {
      console.log("Holiday fetch error:", error);
      return new Set();
    }
  }

  // Returns working dates (all days except Sunday and company holidays)
  // as "YYYY-MM-DD", from the 1st of the current month up to (but not
  // including) today — since today isn't "over" yet, it shouldn't be
  // marked absent prematurely.
  function getWorkingDaysBeforeToday(todayStr, holidayDates = new Set()) {
    const todayDate = new Date(todayStr);
    const year = todayDate.getFullYear();
    const month = todayDate.getMonth();

    const dates = [];
    const cursor = new Date(year, month, 1);

    while (cursor < todayDate) {
      const dow = cursor.getDay(); // 0 = Sun
      const dateStr = cursor.toISOString().slice(0, 10);

      if (dow !== 0 && !holidayDates.has(dateStr)) {
        dates.push(dateStr);
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    return dates;
  }

  // Determines Present / Late / Absent / Incomplete for display +
  // calendar coloring. Based on Firestore settings/attendanceRules:
  // officeStartTime (e.g. "10:00") + graceMinutes (e.g. 15) define the
  // late cutoff.
  function getDisplayStatus(item, rules) {
    if (item.status === "Absent") {
      return "Absent";
    }

    const punch = convertDate(item.PunchIn);
    if (!punch) {
      return item.status || "Present";
    }

    // Punched in but the day is already over and there's still no
    // punch-out — actual hours worked are unknown, so don't count
    // this as a real "Present" day. Today itself is excluded since
    // the employee may still punch out later today.
    const punchOut = convertDate(item.PunchOut);
    if (!punchOut && item.date !== today) {
      return "Incomplete";
    }

    const officeStartTime = rules?.officeStartTime || "10:00";
    const graceMinutes = Number(rules?.graceMinutes ?? 15);

    const [officeHour, officeMinute] = officeStartTime.split(":").map(Number);

    const cutoff = new Date(punch);
    cutoff.setHours(officeHour, officeMinute + graceMinutes, 0, 0);

    const isLate = punch > cutoff;

    return isLate ? "Late" : "Present";
  }

  // =======================
  // GPS
  // =======================

  async function getCurrentLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Location not supported on this device"));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => resolve(position),
        (error) => {
          // First attempt (high accuracy) failed — retry once with
          // relaxed settings before giving up. This handles weak GPS
          // signal indoors, which is the most common real-world cause
          // of punch-in failures even when location permission is
          // already granted.
          if (
            error.code === error.TIMEOUT ||
            error.code === error.POSITION_UNAVAILABLE
          ) {
            navigator.geolocation.getCurrentPosition(
              (position) => resolve(position),
              (retryError) => reject(retryError),
              { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
            );
          } else {
            reject(error);
          }
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  }

  // Turns a GeolocationPositionError into a specific, actionable
  // message instead of one generic "enable location" alert — so
  // employees can tell a blocked browser permission apart from a
  // device-level GPS toggle being off, or just a weak signal.
  function getLocationErrorMessage(error) {
    if (error?.code === 1) {
      // On some Android/Chrome versions, if the device's system-wide
      // Location toggle is OFF, the browser reports PERMISSION_DENIED
      // even though this site is allowed — so this message has to
      // cover both causes, not just the site-level permission.
      return "Could not access location. Please check TWO things: 1) Your phone's Location/GPS is turned ON in system settings, and 2) This site has location permission allowed in your browser settings. Then reload the page and try again.";
    }
    if (error?.code === 2) {
      return "GPS signal not found. Please make sure your device's Location/GPS is turned ON (not just browser permission), then try again.";
    }
    if (error?.code === 3) {
      return "GPS took too long to respond. Please move to an open area or near a window and try again.";
    }
    return "Unable to get GPS location. Please enable location.";
  }

  // =======================
  // DISTANCE
  // =======================

  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c);
  }

  // =======================
  // CHECK OFFICE RANGE
  // =======================

  async function checkOfficeRange(rules) {
    if (!rules) return false;

    try {
      const position = await getCurrentLocation();

      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      const accuracy = position.coords.accuracy;

      setCurrentLocation({ latitude, longitude, accuracy });

      const meter = calculateDistance(
        latitude,
        longitude,
        Number(rules.officeLatitude),
        Number(rules.officeLongitude)
      );

      setDistance(meter);

      const inside = meter <= Number(rules.officeRadius);
      setInsideOffice(inside);
      setLocationStatus(inside ? "Inside Office" : "Outside Office");

      return inside;
    } catch (error) {
      console.log(error);
      // Runs automatically on page load — don't interrupt the user
      // with a popup; just reflect the failure in the status badge.
      setLocationStatus(getLocationErrorMessage(error));
      return false;
    }
  }

  async function loadToday(uid) {
    const q = query(
      collection(db, "attendance"),
      where("userId", "==", uid),
      where("date", "==", today)
    );

    const snap = await getDocs(q);

    if (!snap.empty) {
      setTodayData({ id: snap.docs[0].id, ...snap.docs[0].data() });
    } else {
      setTodayData(null);
    }
  }

  // Fills in "Absent" attendance docs for any working day this month
  // (before today, excluding Sundays and company holidays) that has no
  // attendance record at all for this user.
  async function syncMissingAbsences(uid, holidayDates = new Set()) {
    try {
      const q = query(collection(db, "attendance"), where("userId", "==", uid));
      const snap = await getDocs(q);

      const existingDates = new Set(snap.docs.map((d) => d.data().date));
      const workingDays = getWorkingDaysBeforeToday(today, holidayDates);
      const missingDays = workingDays.filter((d) => !existingDates.has(d));

      for (const date of missingDays) {
        await addDoc(collection(db, "attendance"), {
          userId: uid,
          employeeName: user?.displayName || "",
          email: user?.email || "",
          date,
          PunchIn: null,
          PunchOut: null,
          totalHours: 0,
          extraHours: 0,
          status: "Absent",
          attendanceSource: "Auto-marked (no punch-in)",
          createdAt: new Date(),
        });
      }
    } catch (error) {
      console.log("Absence sync error:", error);
    }
  }

  async function loadHistory(uid, rules) {
    const q = query(collection(db, "attendance"), where("userId", "==", uid));

    const snap = await getDocs(q);

    const list = snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .map((item) => ({
        ...item,
        displayStatus: getDisplayStatus(item, rules || attendanceRules),
      }))
      .sort((a, b) => (a.date < b.date ? 1 : -1));

    setHistory(list);

    let hours = 0;
    let present = 0;
    let late = 0;
    let absent = 0;
    let incomplete = 0;

    list.forEach((item) => {
      hours += Number(item.totalHours || 0);

      if (item.displayStatus === "Late") late++;
      else if (item.displayStatus === "Absent") absent++;
      else if (item.displayStatus === "Incomplete") incomplete++;
      else present++;
    });

    setStats({
      present,
      absent,
      late,
      incomplete,
      hours: Number(hours.toFixed(1)),
    });
  }

  function getAttendanceSource() {
    const ua = navigator.userAgent;

    if (/Android/i.test(ua)) return "Android Mobile";
    if (/iPhone/i.test(ua)) return "iPhone";
    if (/iPad/i.test(ua)) return "iPad";
    if (/Windows/i.test(ua)) return "Windows Laptop";
    if (/Macintosh|Mac OS X/i.test(ua)) return "MacBook";
    if (/Linux/i.test(ua)) return "Linux Laptop";

    return "Unknown Device";
  }

  async function punchIn() {
    try {
      if (!user) return;

      if (todayData) {
        alert("Already punched in today");
        return;
      }

      const snap = await getDoc(doc(db, "settings", "attendanceRules"));

      if (!snap.exists()) {
        alert("Attendance Rules not found.");
        return;
      }

      const rules = snap.data();

      const officeLatitude = Number(rules.officeLatitude);
      const officeLongitude = Number(rules.officeLongitude);
      const allowedRadius = Number(rules.officeRadius);

      const position = await getCurrentLocation();

      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      const accuracy = position.coords.accuracy;

      const meter = calculateDistance(latitude, longitude, officeLatitude, officeLongitude);

      setDistance(meter);
      setCurrentLocation({ latitude, longitude, accuracy });

      const inside = meter <= allowedRadius;
      setInsideOffice(inside);
      setLocationStatus(inside ? "Inside Office" : "Outside Office");

      if (!inside && rules.restrictOutsideOffice && !rules.allowRemotePunch) {
        alert(`You are outside office range.\n\nDistance: ${meter} m`);
        return;
      }

      await addDoc(collection(db, "attendance"), {
        userId: user.uid,
        employeeName: user.displayName || "",
        email: user.email,
        date: today,
        PunchIn: new Date(),
        PunchOut: null,
        totalHours: 0,
        extraHours: 0,
        status: "Present",
        attendanceSource: getAttendanceSource(),
        sourceDetails: {
          deviceType: getAttendanceSource(),
          userAgent: navigator.userAgent,
        },
        latitude,
        longitude,
        accuracy,
        distanceFromOffice: meter,
        gpsStatus: inside ? "Inside Office" : "Outside Office",
        createdAt: new Date(),
      });

      await loadToday(user.uid);
      await loadHistory(user.uid, attendanceRules);

      alert("Punch In Successful");
    } catch (error) {
      console.log(error);
      alert(getLocationErrorMessage(error));
    }
  }

  async function punchOut() {
    try {
      if (!todayData) {
        alert("Please punch in first");
        return;
      }

      if (todayData.PunchOut) {
        alert("Already punched out");
        return;
      }

      const q = query(
        collection(db, "attendance"),
        where("userId", "==", user.uid),
        where("date", "==", today)
      );

      const snap = await getDocs(q);
      const ref = snap.docs[0].ref;

      const start = convertDate(todayData.PunchIn);
      const end = new Date();
      const hours = ((end - start) / (1000 * 60 * 60)).toFixed(2);

      // Re-fetch fresh rules (mirrors punchIn) instead of relying on
      // possibly-stale state.
      const rulesSnap = await getDoc(doc(db, "settings", "attendanceRules"));
      const rules = rulesSnap.exists() ? rulesSnap.data() : attendanceRules;

      // Extra (overtime) hours — time worked PAST a buffer window after
      // office end time (officeEndTime from Attendance Settings, e.g.
      // "19:00"). Punching out anytime up to 60 minutes after office end
      // time (e.g. 19:00–20:00) is treated as normal — no extra hours.
      // Only time worked beyond that buffer counts as extra. Punching
      // out before office end time simply results in fewer totalHours,
      // which is already reflected automatically — no separate logic
      // needed for that case.
      const officeEndTime = rules?.officeEndTime || "19:00";
      const extraBufferMinutes = Number(rules?.extraBufferMinutes ?? 60);

      const [endHour, endMinute] = officeEndTime.split(":").map(Number);

      const extraCutoff = new Date(end);
      extraCutoff.setHours(endHour, endMinute + extraBufferMinutes, 0, 0);

      const extraHours =
        end > extraCutoff
          ? Number(
              ((end - extraCutoff) / (1000 * 60 * 60)).toFixed(2)
            )
          : 0;

      const position = await getCurrentLocation();
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      const accuracy = position.coords.accuracy;

      const meter = calculateDistance(
        latitude,
        longitude,
        Number(rules?.officeLatitude),
        Number(rules?.officeLongitude)
      );

      const inside = meter <= Number(rules?.officeRadius);
      const punchOutGpsStatus = inside ? "Inside Office" : "Outside Office";

      // Keep the on-screen GPS status/UI in sync with what was just
      // measured, same as checkOfficeRange/punchIn already do.
      setDistance(meter);
      setCurrentLocation({ latitude, longitude, accuracy });
      setInsideOffice(inside);
      setLocationStatus(punchOutGpsStatus);

      // Block the punch-out itself when outside the office radius —
      // mirrors the exact same restriction punchIn() already enforces,
      // so the same admin toggles (restrictOutsideOffice /
      // allowRemotePunch) govern both punch-in and punch-out.
      if (!inside && rules?.restrictOutsideOffice && !rules?.allowRemotePunch) {
        alert(
          `You are outside office range, so Punch Out isn't allowed.\n\nDistance: ${meter} m`
        );
        return;
      }

      await updateDoc(ref, {
        PunchOut: end,
        totalHours: Number(hours),
        extraHours: extraHours,
        punchOutLatitude: latitude,
        punchOutLongitude: longitude,
        punchOutAccuracy: accuracy,
        punchOutDistanceFromOffice: meter,
        punchOutGpsStatus: punchOutGpsStatus,
      });

      await loadToday(user.uid);
      await loadHistory(user.uid, attendanceRules);

      alert(
        extraHours > 0
          ? `Punch Out Successful! Extra hours: ${extraHours} hrs`
          : "Punch Out Successful"
      );
    } catch (error) {
      console.log(error);
      alert(getLocationErrorMessage(error));
    }
  }

  // Lets an employee tell HR/Admin the time they actually left on a
  // day they forgot to punch out (displayStatus === "Incomplete").
  // This does NOT write PunchOut directly — it only records a request
  // for Admin to review and apply from the backend (admin attendance
  // page's Update popup), so employees can't self-report their own
  // hours unchecked.
  async function submitPunchOutRequest(item) {
    const timeStr = requestTimes[item.id];

    if (!timeStr) {
      alert("Please choose the time you actually left.");
      return;
    }

    const start = convertDate(item.PunchIn);
    const requested = new Date(`${item.date}T${timeStr}:00`);

    if (requested <= start) {
      alert("That time must be after your punch-in time.");
      return;
    }

    try {
      setSubmittingId(item.id);

      await updateDoc(doc(db, "attendance", item.id), {
        correctionRequest: {
          requestedPunchOut: requested,
          note: requestNotes[item.id] || "",
          status: "Pending",
          requestedAt: new Date(),
        },
      });

      await loadHistory(user.uid, attendanceRules);

      alert("Sent to HR/Admin — they'll review and update it.");
    } catch (error) {
      console.log(error);
      alert("Could not send your request. Please try again.");
    } finally {
      setSubmittingId(null);
    }
  }

  const chartData = history.map((item) => ({
    date: item.date,
    hours: Number(item.totalHours || 0),
  }));

  const pieData = [
    { name: "Present", value: stats.present },
    { name: "Late", value: stats.late },
    { name: "Incomplete", value: stats.incomplete },
    { name: "Absent", value: stats.absent },
  ];

  const statusBadgeClass = (displayStatus) => {
    if (displayStatus === "Absent") return "bg-red-100 text-red-700";
    if (displayStatus === "Late") return "bg-yellow-100 text-yellow-700";
    if (displayStatus === "Incomplete") return "bg-orange-100 text-orange-700";
    return "bg-green-100 text-green-700";
  };

  const pendingPunchOuts = history.filter(
    (item) => item.displayStatus === "Incomplete"
  );

  return (
    <div className="w-full flex flex-col gap-4">
      <main className="w-full max-w-full px-3 sm:px-6 lg:px-8 py-4">
        {/* TOP HEADER */}
        <section className="bg-[var(--card-bg)] rounded-3xl p-4 sm:p-8 mb-6 border border-[var(--border-color)] shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-5">
            <div>
              <h1 className="text-xl sm:text-3xl lg:text-5xl font-extrabold text-[var(--text-color)] tracking-tight">
                📅 Attendance Dashboard
              </h1>

              <p className="text-sm sm:text-lg text-[var(--text-muted)] mt-2 sm:mt-3">
                Track attendance, working hours, GPS verification and employee presence.
              </p>

              <div className="flex gap-2 sm:gap-3 mt-4 sm:mt-5 flex-wrap">
                <span className="bg-[var(--accent-bg)] text-[#3d6fa8] px-3 sm:px-5 py-1.5 sm:py-2 rounded-full font-semibold text-xs sm:text-base">
                  📍 GPS Enabled
                </span>
                <span className="bg-[var(--accent-bg)] text-[#3d6fa8] px-3 sm:px-5 py-1.5 sm:py-2 rounded-full font-semibold text-xs sm:text-base">
                  🕒 Real Time Tracking
                </span>
                <span className="bg-[var(--accent-bg)] text-[#3d6fa8] px-3 sm:px-5 py-1.5 sm:py-2 rounded-full font-semibold text-xs sm:text-base">
                  🏢 Office Attendance
                </span>
              </div>
            </div>

            <div className="bg-[#3d6fa8] text-white px-6 sm:px-8 py-4 sm:py-5 rounded-2xl shadow-md text-center w-full sm:w-auto sm:min-w-[220px]">
              <p className="text-sm opacity-80">Today's Status</p>
              <h2 className="text-xl sm:text-2xl font-bold mt-2">
                {todayData ? "🟢 Present" : "⚪ Not Checked"}
              </h2>
              {todayData?.PunchIn && (
                <p className="text-sm mt-2">Punch In: {formatTime(todayData.PunchIn)}</p>
              )}
            </div>
          </div>
        </section>

        {/* PENDING PUNCH-OUTS BANNER */}
        {pendingPunchOuts.length > 0 && (
          <section className="bg-orange-50 border border-orange-200 rounded-3xl p-4 sm:p-5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="font-semibold text-[#111] text-sm sm:text-base">
                  {pendingPunchOuts.length} day
                  {pendingPunchOuts.length > 1 ? "s" : ""} missing a punch-out
                </p>
                <p className="text-xs sm:text-sm text-[#666]">
                  These aren't counted as Present until fixed.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowPendingModal(true)}
              className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white px-5 py-3 rounded-xl font-semibold text-sm sm:text-base"
            >
              Report Missed Punch-Out
            </button>
          </section>
        )}

        {/* GPS STATUS CARD */}
        <section className="bg-[var(--card-bg)] rounded-3xl border border-[var(--border-color)] shadow-sm p-4 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-5 gap-3">
            <h2 className="text-lg sm:text-xl font-bold text-[var(--text-color)]">📍 GPS Status</h2>
            <div
              className={`px-4 py-2 rounded-xl font-semibold text-sm sm:text-base w-fit ${
                insideOffice ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
              }`}
            >
              {locationStatus || "Checking..."}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-5">
            <div className="bg-[var(--accent-bg)] rounded-2xl p-4 sm:p-5">
              <p className="text-sm text-[var(--text-muted)]">Distance From Office</p>
              <h3 className="text-xl sm:text-2xl font-bold mt-2 text-[var(--text-color)]">
                {distance ? `${Math.round(distance)} m` : "--"}
              </h3>
            </div>

            <div className="bg-[var(--accent-bg)] rounded-2xl p-4 sm:p-5">
              <p className="text-sm text-[var(--text-muted)]">GPS Accuracy</p>
              <h3 className="text-xl sm:text-2xl font-bold mt-2 text-[var(--text-color)]">
                {currentLocation?.accuracy ? `${Math.round(currentLocation.accuracy)} m` : "--"}
              </h3>
            </div>

            <div className="bg-[var(--accent-bg)] rounded-2xl p-4 sm:p-5">
              <p className="text-sm text-[var(--text-muted)]">Attendance Source</p>
              <h3 className="text-xl sm:text-2xl font-bold mt-2 text-[var(--text-color)]">{attendanceSource}</h3>
            </div>
          </div>
        </section>

        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3 mb-5">
          <StatCard icon="🟢" title="Present Days" value={stats.present} />
          <StatCard icon="🔴" title="Absent Days" value={stats.absent} />
          <StatCard icon="🟡" title="Late Days" value={stats.late} />
          <StatCard icon="⚠️" title="Incomplete Days" value={stats.incomplete} />
          <StatCard icon="⏱" title="Working Hours" value={`${stats.hours} hrs`} />
        </div>

        {/* MAIN GRID */}
        <div className="grid xl:grid-cols-2 gap-6 mb-8">
          {/* TODAY ATTENDANCE */}
          <div className="bg-[var(--card-bg)] rounded-3xl p-4 sm:p-7 border border-[var(--border-color)] shadow-sm">
            <h2 className="text-lg sm:text-xl font-bold text-[var(--text-color)]">Today's Attendance</h2>

            <div className="grid grid-cols-2 gap-3 sm:gap-5 mt-5 sm:mt-6">
              <InfoBox title="Punch In" value={formatTime(todayData?.PunchIn)} />
              <InfoBox title="Punch Out" value={formatTime(todayData?.PunchOut)} />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6 sm:mt-8">
              <button
                onClick={punchIn}
                disabled={todayData}
                className="flex-1 bg-[#3d6fa8] text-white py-3 rounded-xl font-semibold disabled:bg-gray-300 hover:bg-[#325d8d] transition"
              >
                Punch In
              </button>

              <button
                onClick={punchOut}
                disabled={!todayData || todayData.PunchOut}
                className="flex-1 bg-[#66a8e0] text-white py-3 rounded-xl font-semibold disabled:bg-gray-300 hover:bg-[#5595ca] transition"
              >
                Punch Out
              </button>
            </div>

            {todayData?.PunchOut && (
              <div className="grid grid-cols-2 gap-3 sm:gap-5 mt-4 sm:mt-5">
                <InfoBox title="Total Hours" value={`${todayData.totalHours || 0} hrs`} />
                <InfoBox title="Extra Hours" value={`${todayData.extraHours || 0} hrs`} />
              </div>
            )}
          </div>

          {/* CALENDAR */}
          <AttendanceCalendar history={history} holidayDates={holidayDates} />
        </div>

        {/* GRAPH SECTION */}
        <div className="grid xl:grid-cols-2 gap-6 mb-8">
          <div className="bg-[var(--card-bg)] rounded-3xl p-4 sm:p-7 border border-[var(--border-color)] shadow-sm">
            <h2 className="text-lg sm:text-xl font-bold mb-4 sm:mb-5 text-[var(--text-color)]">Working Hours</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="hours" fill="#3d6fa8" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-[var(--card-bg)] rounded-3xl p-4 sm:p-7 border border-[var(--border-color)] shadow-sm">
            <h2 className="text-lg sm:text-xl font-bold mb-4 sm:mb-5 text-[var(--text-color)]">Attendance Trend</h2>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="hours" stroke="#66a8e0" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* PIE + HISTORY */}
        <div className="grid xl:grid-cols-3 gap-6 mb-8">
          <div className="bg-[var(--card-bg)] rounded-3xl p-4 sm:p-7 border border-[var(--border-color)] shadow-sm">
            <h2 className="text-lg sm:text-xl font-bold mb-4 sm:mb-5 text-[var(--text-color)]">Attendance Status</h2>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={70} label>
                  <Cell fill="#3d6fa8" />
                  <Cell fill="#f2c94c" />
                  <Cell fill="#f2994a" />
                  <Cell fill="#e05353" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="xl:col-span-2 bg-[var(--card-bg)] rounded-3xl p-4 sm:p-7 border border-[var(--border-color)] shadow-sm">
            <h2 className="text-lg sm:text-xl font-bold mb-4 sm:mb-5 text-[var(--text-color)]">Attendance History</h2>

            {/* MOBILE: card list (avoids horizontal table scrolling) */}
            <div className="flex flex-col gap-3 sm:hidden">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="border border-[var(--border-color)] rounded-2xl p-4"
                >
                  <div className="flex justify-between items-center mb-3">
                    <p className="font-semibold text-[var(--text-color)]">{item.date}</p>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${statusBadgeClass(
                        item.displayStatus
                      )}`}
                    >
                      {item.displayStatus}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-y-2 text-sm text-[var(--text-muted)]">
                    <p>
                      Punch In:{" "}
                      <span className="font-semibold text-[var(--text-color)]">
                        {formatTime(item.PunchIn)}
                      </span>
                    </p>
                    <p>
                      Punch Out:{" "}
                      <span className="font-semibold text-[var(--text-color)]">
                        {formatTime(item.PunchOut)}
                      </span>
                    </p>
                    <p>
                      Hours:{" "}
                      <span className="font-semibold text-[var(--text-color)]">
                        {item.totalHours || 0} hrs
                      </span>
                    </p>
                    <p>
                      Extra:{" "}
                      <span className="font-semibold text-[var(--text-color)]">
                        {item.extraHours || 0} hrs
                      </span>
                    </p>
                  </div>
                </div>
              ))}

              {history.length === 0 && (
                <p className="text-center text-[var(--text-muted)] py-8">
                  No attendance records yet
                </p>
              )}
            </div>

            {/* DESKTOP / TABLET: table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left min-w-[560px]">
                <thead>
                  <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)]">
                    <th className="py-3">Date</th>
                    <th>Punch In</th>
                    <th>Punch Out</th>
                    <th>Hours</th>
                    <th>Extra</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {history.map((item) => (
                    <tr key={item.id} className="border-b border-[var(--border-color)] hover:bg-[var(--accent-bg)] transition text-[var(--text-color)]">
                      <td className="py-4">{item.date}</td>
                      <td>{formatTime(item.PunchIn)}</td>
                      <td>{formatTime(item.PunchOut)}</td>
                      <td>{item.totalHours || 0} hrs</td>
                      <td>{item.extraHours || 0} hrs</td>
                      <td>
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-semibold ${statusBadgeClass(
                            item.displayStatus
                          )}`}
                        >
                          {item.displayStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* MISSED PUNCH-OUT REPORT POPUP */}
      {showPendingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-[var(--card-bg)] rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center px-5 sm:px-6 py-4 sm:py-5 border-b border-[var(--border-color)]">
              <h2 className="text-lg sm:text-xl font-bold text-[var(--text-color)]">Report Missed Punch-Out</h2>
              <button
                onClick={() => setShowPendingModal(false)}
                className="text-2xl leading-none px-2 text-[var(--text-color)]"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex flex-col gap-4 sm:gap-5">
              <p className="text-sm text-[var(--text-muted)]">
                Tell us what time you actually left — this gets sent to
                HR/Admin to review and update, it won't change your
                attendance automatically.
              </p>

              {pendingPunchOuts.map((item) => {
                const alreadyRequested = item.correctionRequest?.status === "Pending";

                return (
                  <div key={item.id} className="bg-orange-50 rounded-2xl p-4">
                    <p className="font-semibold text-[#111]">{item.date}</p>
                    <p className="text-sm text-[#666] mb-3">
                      Punched in at {formatTime(item.PunchIn)}
                    </p>

                    {alreadyRequested ? (
                      <p className="text-sm text-orange-700 font-semibold">
                        ✅ Sent — waiting for HR/Admin to update it
                        {item.correctionRequest?.requestedPunchOut && (
                          <>
                            {" "}
                            (you reported{" "}
                            {formatTime(item.correctionRequest.requestedPunchOut)})
                          </>
                        )}
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <input
                          type="time"
                          value={requestTimes[item.id] || ""}
                          onChange={(e) =>
                            setRequestTimes((prev) => ({
                              ...prev,
                              [item.id]: e.target.value,
                            }))
                          }
                          className="border border-orange-200 rounded-xl px-3 py-2 text-sm"
                        />

                        <input
                          type="text"
                          placeholder="Optional note (e.g. reason)"
                          value={requestNotes[item.id] || ""}
                          onChange={(e) =>
                            setRequestNotes((prev) => ({
                              ...prev,
                              [item.id]: e.target.value,
                            }))
                          }
                          className="border border-orange-200 rounded-xl px-3 py-2 text-sm"
                        />

                        <button
                          onClick={() => submitPunchOutRequest(item)}
                          disabled={submittingId === item.id}
                          className="bg-orange-500 text-white px-5 py-2 rounded-xl font-semibold text-sm hover:bg-orange-600 transition disabled:bg-gray-300"
                        >
                          {submittingId === item.id ? "Sending..." : "Send to HR/Admin"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ================= COMPONENTS =================

function StatCard({ icon, title, value }) {
  return (
    <div className="bg-[var(--card-bg)] rounded-3xl p-3 sm:p-6 border border-[var(--border-color)] shadow-sm hover:shadow-md transition">
      <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-xl bg-[var(--accent-bg)] flex items-center justify-center text-base sm:text-2xl">
        {icon}
      </div>
      <p className="mt-2 sm:mt-4 text-[var(--text-muted)] text-[11px] sm:text-sm leading-tight">{title}</p>
      <h2 className="text-lg sm:text-3xl font-bold text-[var(--text-color)] mt-1">{value}</h2>
    </div>
  );
}

function InfoBox({ title, value }) {
  return (
    <div className="bg-[var(--accent-bg)] rounded-2xl p-3 sm:p-5">
      <p className="text-[var(--text-muted)] text-xs sm:text-sm">{title}</p>
      <h3 className="text-base sm:text-xl font-bold text-[var(--text-color)] mt-1 sm:mt-2">{value}</h3>
    </div>
  );
}

// "use client";

// import {useEffect,useState} from "react";

// import {
// onAuthStateChanged
// } from "firebase/auth";



// import {
// BarChart,
// Bar,
// LineChart,
// Line,
// XAxis,
// YAxis,
// Tooltip,
// ResponsiveContainer,
// PieChart,
// Pie,
// Cell
// } from "recharts";


// import { auth, db } from "@/lib/firebase";

// import {
//   collection,
//   addDoc,
//   query,
//   where,
//   getDocs,
//   updateDoc,
//   doc,
//   getDoc
// } from "firebase/firestore";


// import AttendanceCalendar from "./AttendanceCalendar";



// export default function AttendancePage(){


// const [user,setUser]=useState(null);

// const [todayData,setTodayData]=useState(null);

// const [history,setHistory]=useState([]);

// const [attendanceRules,setAttendanceRules]=useState(null);

// const [locationStatus,setLocationStatus]=useState("");

// const [distance,setDistance]=useState(0);

// const [currentLocation,setCurrentLocation]=useState(null);
// const [attendanceSource, setAttendanceSource] = useState("Loading...");
// const [insideOffice,setInsideOffice]=useState(false);
// const [stats,setStats]=useState({

// present:0,

// absent:0,

// late:0,

// hours:0

// });



// const today =
// new Date()
// .toISOString()
// .substring(0,10);


// useEffect(() => {

//   const unsubscribe = onAuthStateChanged(
//     auth,
//     async (currentUser) => {

//       if (!currentUser) {
//         window.location.href = "/login";
//         return;
//       }

//       setUser(currentUser);
// setAttendanceSource(getAttendanceSource());
// console.log("Source:", getAttendanceSource());
// console.log("UserAgent:", navigator.userAgent);
//       const rules = await loadAttendanceRules();

// await loadToday(currentUser.uid);
// await loadHistory(currentUser.uid);

// if (rules) {
//   await checkOfficeRange(rules);
// }

//     }
//   );

//   return () => unsubscribe();

// }, []);

// // =======================
// // LOAD ATTENDANCE RULES
// // =======================

// async function loadAttendanceRules() {
//   try {
//     const snap = await getDoc(
//       doc(db, "settings", "attendanceRules")
//     );

//     if (snap.exists()) {
//       const rules = snap.data();
//       setAttendanceRules(rules);
//       return rules;
//     }

//     return null;
//   } catch (error) {
//     console.log(error);
//     return null;
//   }
// }


// // =======================
// // DATE HELPERS
// // =======================

// function convertDate(value){

// if(!value) return null;

// if(value.toDate)
// return value.toDate();

// return new Date(value);

// }

// function formatTime(value){

// const d = convertDate(value);

// if(!d) return "--";

// return d.toLocaleTimeString([],{
// hour:"2-digit",
// minute:"2-digit"
// });

// }



// // =======================
// // GPS
// // =======================

// async function getCurrentLocation(){

// return new Promise((resolve,reject)=>{

// if(!navigator.geolocation){

// reject(new Error("Location not supported"));
// return;

// }

// navigator.geolocation.getCurrentPosition(

// (position)=>{

// resolve(position);

// },

// (error)=>{

// reject(error);

// },

// {

// enableHighAccuracy:true,

// timeout:10000,

// maximumAge:0

// }

// );

// });

// }



// // =======================
// // DISTANCE
// // =======================

// function calculateDistance(
// lat1,
// lon1,
// lat2,
// lon2
// ){

// const R = 6371000;

// const dLat =
// (lat2-lat1) *
// Math.PI/180;

// const dLon =
// (lon2-lon1) *
// Math.PI/180;

// const a =

// Math.sin(dLat/2) *
// Math.sin(dLat/2)

// +

// Math.cos(lat1*Math.PI/180)

// *

// Math.cos(lat2*Math.PI/180)

// *

// Math.sin(dLon/2)

// *

// Math.sin(dLon/2);

// const c =

// 2 *

// Math.atan2(

// Math.sqrt(a),

// Math.sqrt(1-a)

// );

// return Math.round(R*c);

// }



// // =======================
// // CHECK OFFICE RANGE
// // =======================

// async function checkOfficeRange(rules) {
//   if (!rules) return false;

//   try {
//     const position = await getCurrentLocation();

//     const latitude = position.coords.latitude;
//     const longitude = position.coords.longitude;
//     const accuracy = position.coords.accuracy;

//     setCurrentLocation({
//       latitude,
//       longitude,
//       accuracy,
//     });

//     const meter = calculateDistance(
//       latitude,
//       longitude,
//       Number(rules.officeLatitude),
//       Number(rules.officeLongitude)
//     );

//     setDistance(meter);

//     const inside = meter <= Number(rules.officeRadius);

//     setInsideOffice(inside);

//     setLocationStatus(
//       inside ? "Inside Office" : "Outside Office"
//     );

//     return inside;

//   } catch (error) {
//     console.log(error);
//     alert("Unable to fetch GPS");
//     return false;
//   }
// }

// async function loadToday(uid){


// const q=query(

// collection(db,"attendance"),

// where(
// "userId",
// "==",
// uid
// ),

// where(
// "date",
// "==",
// today
// )

// );



// const snap=
// await getDocs(q);



// if(!snap.empty){


// setTodayData({

// id:snap.docs[0].id,

// ...snap.docs[0].data()

// });


// }
// else{


// setTodayData(null);


// }


// }


// async function loadHistory(uid){


// const q=query(

// collection(db,"attendance"),

// where(
// "userId",
// "==",
// uid
// )

// );



// const snap=
// await getDocs(q);



// const list=
// snap.docs.map(doc=>({

// id:doc.id,

// ...doc.data()

// }));


// setHistory(list);



// let hours=0;

// let late=0;



// list.forEach(item=>{


// hours+=Number(
// item.totalHours || 0
// );



// const punch=
// convertDate(
// item.PunchIn
// );



// if(punch){

// if(
// punch.getHours()>9 ||
// (
// punch.getHours()===9 &&
// punch.getMinutes()>30
// )

// ){

// late++;

// }

// }


// });




// setStats({

// present:list.length,

// absent:0,

// late,

// hours:Number(
// hours.toFixed(1)
// )

// });


// }
// function getAttendanceSource() {
//   const ua = navigator.userAgent;

//   console.log("User Agent:", ua);

//   if (/Android/i.test(ua)) return "Android Mobile";
//   if (/iPhone/i.test(ua)) return "iPhone";
//   if (/iPad/i.test(ua)) return "iPad";
//   if (/Windows/i.test(ua)) return "Windows Laptop";
//   if (/Macintosh|Mac OS X/i.test(ua)) return "MacBook";
//   if (/Linux/i.test(ua)) return "Linux Laptop";

//   return "Unknown Device";
// }


// async function punchIn() {
//   try {

//     if (!user) return;

//     if (todayData) {
//       alert("Already punched in today");
//       return;
//     }

//     // Always fetch latest attendance rules
//     const snap = await getDoc(
//       doc(db, "settings", "attendanceRules")
//     );

//     if (!snap.exists()) {
//       alert("Attendance Rules not found.");
//       return;
//     }

//     const attendanceRules = snap.data();

//     const officeLatitude = Number(attendanceRules.officeLatitude);
//     const officeLongitude = Number(attendanceRules.officeLongitude);
//     const allowedRadius = Number(attendanceRules.officeRadius);

//     // Current GPS
//     const position = await getCurrentLocation();

//     const latitude = position.coords.latitude;
//     const longitude = position.coords.longitude;
//     const accuracy = position.coords.accuracy;

//     const meter = calculateDistance(
//       latitude,
//       longitude,
//       officeLatitude,
//       officeLongitude
//     );

//     setDistance(meter);

//     setCurrentLocation({
//       latitude,
//       longitude,
//       accuracy,
//     });

//     const inside = meter <= allowedRadius;

//     setInsideOffice(inside);

//     setLocationStatus(
//       inside ? "Inside Office" : "Outside Office"
//     );

//     if (
//       !inside &&
//       attendanceRules.restrictOutsideOffice &&
//       !attendanceRules.allowRemotePunch
//     ) {
//       alert(`You are outside office range.\n\nDistance: ${meter} m`);
//       return;
//     }



// // Save Attendance

// await addDoc(

// collection(db,"attendance"),

// {

// userId:user.uid,

// employeeName:
// user.displayName || "",

// email:user.email,

// date:today,

// PunchIn:new Date(),

// PunchOut:null,

// totalHours:0,

// status:"Present",

// attendanceSource:getAttendanceSource(),

// sourceDetails:{

// deviceType:getAttendanceSource(),

// userAgent:navigator.userAgent

// },

// latitude,

// longitude,

// accuracy,

// distanceFromOffice:meter,

// gpsStatus:

// inside
// ?
// "Inside Office"
// :
// "Outside Office",

// createdAt:new Date()

// }

// );

// await loadToday(user.uid);

// await loadHistory(user.uid);

// alert("Punch In Successful");

// }

// catch(error){

// console.log(error);

// alert(
// "Unable to get GPS location. Please enable location."
// );

// }


// };



// async function punchOut(){


// try{


// if(!todayData){

// alert("Please punch in first");

// return;

// }



// if(todayData.PunchOut){

// alert("Already punched out");

// return;

// }





// const q=query(

// collection(db,"attendance"),

// where(
// "userId",
// "==",
// user.uid
// ),

// where(
// "date",
// "==",
// today
// )

// );



// const snap=
// await getDocs(q);



// const ref=
// snap.docs[0].ref;




// const start=
// convertDate(
// todayData.PunchIn
// );



// const end=
// new Date();




// const hours=
// (
// (end-start)/
// (1000*60*60)

// ).toFixed(2);


// const position =
// await getCurrentLocation();

// const latitude =
// position.coords.latitude;

// const longitude =
// position.coords.longitude;

// const accuracy =
// position.coords.accuracy;


// const meter =
// calculateDistance(

// latitude,

// longitude,

// Number(attendanceRules.officeLatitude),

// Number(attendanceRules.officeLongitude)

// );
// const inside =
// meter <= Number(attendanceRules.officeRadius);


// const punchOutGpsStatus =
// inside
// ?
// "Inside Office"
// :
// "Outside Office";

// await updateDoc(
// ref,
// {

// PunchOut:end,

// totalHours:Number(hours),

// punchOutLatitude:latitude,

// punchOutLongitude:longitude,

// punchOutAccuracy:accuracy,

// punchOutDistanceFromOffice:meter,

// punchOutGpsStatus:punchOutGpsStatus

// }

// );



// await loadToday(user.uid);

// await loadHistory(user.uid);



// alert("Punch Out Successful");



// }
// catch(error){

// console.log(error);

// alert(error.message);

// }



// }

// const chartData =
// history.map(item=>({

// date:item.date,

// hours:Number(
// item.totalHours || 0
// )

// }));





// const pieData=[

// {
// name:"Present",
// value:stats.present
// },

// {
// name:"Late",
// value:stats.late
// },

// {
// name:"Absent",
// value:stats.absent
// }

// ];


// return (
// <div className="
// w-full
// flex
// flex-col
// gap-4
// ">

// <main className="
// w-full
// max-w-full
// px-4
// sm:px-6
// lg:px-8
// py-4
// overflow-x-auto
// overflow-y-auto
// ">
// {/* TOP HEADER */}
// {/* TOP HEADER */}

// <section
// className="
// bg-white
// rounded-3xl
// p-8
// mb-6
// border
// border-[#eaf3ff]
// shadow-sm
// "
// >

// <div
// className="
// flex
// justify-between
// items-center
// flex-wrap
// gap-5
// "
// >

// <div>

// <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#111111] tracking-tight">
// 📅 Attendance Dashboard
// </h1>


// <p
// className="
// text-lg
// text-[#444444]
// mt-3
// "
// >
// Track attendance, working hours, GPS verification and employee presence.
// </p>


// <div
// className="
// flex
// gap-3
// mt-5
// flex-wrap
// "
// >

// <span
// className="
// bg-[#eaf3ff]
// text-[#3d6fa8]
// px-5
// py-2
// rounded-full
// font-semibold
// "
// >
// 📍 GPS Enabled
// </span>


// <span
// className="
// bg-[#eaf3ff]
// text-[#3d6fa8]
// px-5
// py-2
// rounded-full
// font-semibold
// "
// >
// 🕒 Real Time Tracking
// </span>


// <span
// className="
// bg-[#eaf3ff]
// text-[#3d6fa8]
// px-5
// py-2
// rounded-full
// font-semibold
// "
// >
// 🏢 Office Attendance
// </span>


// </div>


// </div>




// <div className="bg-[#3d6fa8] text-white px-6 sm:px-8 py-5 rounded-2xl shadow-md text-center w-full sm:w-auto sm:min-w-[220px]">


// <p
// className="
// text-sm
// opacity-80
// "
// >
// Today's Status
// </p>


// <h2
// className="
// text-2xl
// font-bold
// mt-2
// "
// >

// {
// todayData

// ?

// "🟢 Present"

// :

// "⚪ Not Checked"

// }

// </h2>


// {
// todayData?.PunchIn &&

// <p
// className="
// text-sm
// mt-2
// "
// >
// Punch In: {formatTime(todayData.PunchIn)}
// </p>

// }


// </div>


// </div>

// </section>

// {/* GPS STATUS CARD */}

// <section className="
// bg-white
// rounded-3xl
// border
// border-[#eaf3ff]
// shadow-sm
// p-6
// mb-6
// ">

// <div className="flex justify-between items-center mb-5">

// <h2 className="
// text-xl
// font-bold
// text-[#111]
// ">
// 📍 GPS Status
// </h2>

// <div
// className={`
// px-4
// py-2
// rounded-xl
// font-semibold
// ${
// insideOffice
// ?
// "bg-green-100 text-green-700"
// :
// "bg-red-100 text-red-700"
// }
// `}
// >

// {
// locationStatus || "Checking..."
// }

// </div>

// </div>


// <div className="
// grid
// md:grid-cols-3
// gap-5
// ">


// <div className="
// bg-[#f8fbff]
// rounded-2xl
// p-5
// ">

// <p className="text-sm text-[#555]">
// Distance From Office
// </p>

// <h3 className="
// text-2xl
// font-bold
// mt-2
// ">

// {
// distance
// ?
// `${Math.round(distance)} m`
// :
// "--"
// }

// </h3>

// </div>



// <div className="
// bg-[#f8fbff]
// rounded-2xl
// p-5
// ">

// <p className="text-sm text-[#555]">
// GPS Accuracy
// </p>

// <h3 className="
// text-2xl
// font-bold
// mt-2
// ">

// {
// currentLocation?.accuracy
// ?
// `${Math.round(
// currentLocation.accuracy
// )} m`
// :
// "--"
// }

// </h3>

// </div>



// <div className="
// bg-[#f8fbff]
// rounded-2xl
// p-5
// ">

// <p className="text-sm text-[#555]">
// Attendance Source
// </p>

// <h3 className="text-2xl font-bold mt-2">
//   {attendanceSource}
// </h3>

// </div>


// </div>

// </section>






// {/* SUMMARY CARDS */}


// <div className="
// grid
// grid-cols-2
// lg:grid-cols-4
// gap-3
// mb-5
// ">



// <StatCard

// icon="🟢"

// title="Present Days"

// value={stats.present}

// />



// <StatCard

// icon="🔴"

// title="Absent Days"

// value={stats.absent}

// />



// <StatCard

// icon="🟡"

// title="Late Days"

// value={stats.late}

// />



// <StatCard

// icon="⏱"

// title="Working Hours"

// value={`${stats.hours} hrs`}

// />



// </div>

// {/* MAIN GRID */}

// <div className="
// grid
// xl:grid-cols-2
// gap-6
// mb-8
// ">



// {/* TODAY ATTENDANCE */}

// <div className="
// bg-white
// rounded-3xl
// p-7
// border
// border-[#eaf3ff]
// shadow-sm
// ">


// <h2 className="
// text-xl
// font-bold
// text-[#111]
// ">

// Today's Attendance

// </h2>



// <div className="
// grid
// grid-cols-2
// gap-5
// mt-6
// ">


// <InfoBox

// title="Punch In"

// value={
// formatTime(
// todayData?.PunchIn
// )
// }

// />



// <InfoBox

// title="Punch Out"

// value={
// formatTime(
// todayData?.PunchOut
// )
// }

// />



// </div>





// <div className="
// flex
// gap-4
// mt-8
// ">


// <button

// onClick={punchIn}

// disabled={todayData}

// className="
// flex-1
// bg-[#3d6fa8]
// text-white
// py-3
// rounded-xl
// font-semibold
// disabled:bg-gray-300
// hover:bg-[#325d8d]
// transition
// "

// >

// Punch In

// </button>





// <button

// onClick={punchOut}

// disabled={
// !todayData ||
// todayData.PunchOut
// }

// className="
// flex-1
// bg-[#66a8e0]
// text-white
// py-3
// rounded-xl
// font-semibold
// disabled:bg-gray-300
// hover:bg-[#5595ca]
// transition
// "

// >

// Punch Out

// </button>


// </div>



// </div>





// {/* CALENDAR */}


// <AttendanceCalendar

// history={history}

// />



// </div>







// {/* GRAPH SECTION */}


// <div className="
// grid
// xl:grid-cols-2
// gap-6
// mb-8
// ">





// {/* BAR CHART */}


// <div className="
// bg-white
// rounded-3xl
// p-7
// border
// border-[#eaf3ff]
// shadow-sm
// ">


// <h2 className="
// text-xl
// font-bold
// mb-5
// ">

// Working Hours

// </h2>



// <ResponsiveContainer

// width="100%"

// height={280}

// >


// <BarChart data={chartData}>


// <XAxis

// dataKey="date"

// />


// <YAxis/>


// <Tooltip/>


// <Bar

// dataKey="hours"

// fill="#3d6fa8"

// radius={[
// 8,
// 8,
// 0,
// 0
// ]}

// />


// </BarChart>



// </ResponsiveContainer>


// </div>








// {/* LINE CHART */}


// <div className="
// bg-white
// rounded-3xl
// p-7
// border
// border-[#eaf3ff]
// shadow-sm
// ">


// <h2 className="
// text-xl
// font-bold
// mb-5
// ">

// Attendance Trend

// </h2>



// <ResponsiveContainer

// width="100%"

// height={280}

// >


// <LineChart

// data={chartData}

// >


// <XAxis

// dataKey="date"

// />


// <YAxis/>


// <Tooltip/>


// <Line

// type="monotone"

// dataKey="hours"

// stroke="#66a8e0"

// strokeWidth={3}

// />



// </LineChart>



// </ResponsiveContainer>


// </div>



// </div>

// {/* // ================= PIE + HISTORY ================= */}


// <div className="
// grid
// xl:grid-cols-3
// gap-6
// mb-8
// ">



// {/* PIE CHART */}


// <div className="
// bg-white
// rounded-3xl
// p-7
// border
// border-[#eaf3ff]
// shadow-sm
// ">


// <h2 className="
// text-xl
// font-bold
// mb-5
// ">

// Attendance Status

// </h2>



// <ResponsiveContainer

// width="100%"

// height={260}

// >


// <PieChart>


// <Pie

// data={pieData}

// dataKey="value"

// nameKey="name"

// outerRadius={90}

// label

// >


// <Cell fill="#3d6fa8"/>

// <Cell fill="#66a8e0"/>

// <Cell fill="#eaf3ff"/>


// </Pie>


// </PieChart>



// </ResponsiveContainer>



// </div>








// {/* HISTORY TABLE */}



// <div className="
// xl:col-span-2
// bg-white
// rounded-3xl
// p-7
// border
// border-[#eaf3ff]
// shadow-sm
// ">


// <h2 className="
// text-xl
// font-bold
// mb-5
// ">

// Attendance History

// </h2>



// <div className="
// overflow-x-auto
// ">


// <table className="
// w-full
// text-left
// ">


// <thead>


// <tr className="
// border-b
// text-[#444]
// ">


// <th className="
// py-3
// ">

// Date

// </th>


// <th>

// Punch In

// </th>


// <th>

// Punch Out

// </th>


// <th>

// Hours

// </th>


// <th>

// Status

// </th>


// </tr>


// </thead>



// <tbody>


// {
// history.map(item=>(


// <tr

// key={item.id}

// className="
// border-b
// hover:bg-[#eaf3ff]
// transition
// "

// >


// <td className="
// py-4
// ">

// {item.date}

// </td>



// <td>

// {
// formatTime(
// item.PunchIn
// )
// }

// </td>



// <td>

// {
// formatTime(
// item.PunchOut
// )
// }

// </td>



// <td>

// {
// item.totalHours || 0
// }

//  hrs

// </td>




// <td>


// <span className="
// bg-[#eaf3ff]
// text-[#3d6fa8]
// px-3
// py-1
// rounded-full
// text-sm
// ">

// {
// item.status
// }

// </span>


// </td>


// </tr>


// ))

// }



// </tbody>


// </table>


// </div>


// </div>


// </div>

//   </main>
// </div>

// );

// }




// // ================= COMPONENTS =================


// function StatCard({
// icon,
// title,
// value
// }){


// return (

// <div className="
// bg-white
// rounded-3xl
// p-6
// border
// border-[#eaf3ff]
// shadow-sm
// hover:shadow-md
// transition
// ">


// <div className="
// w-12
// h-12
// rounded-xl
// bg-[#eaf3ff]
// flex
// items-center
// justify-center
// text-2xl
// ">

// {icon}

// </div>



// <p className="
// mt-4
// text-[#444]
// text-sm
// ">

// {title}

// </p>



// <h2 className="
// text-3xl
// font-bold
// text-[#111]
// mt-1
// ">

// {value}

// </h2>



// </div>


// );


// }







// function InfoBox({
// title,
// value
// }){


// return (

// <div className="
// bg-[#eaf3ff]
// rounded-2xl
// p-5
// ">


// <p className="
// text-[#444]
// text-sm
// ">

// {title}

// </p>



// <h3 className="
// text-xl
// font-bold
// text-[#111]
// mt-2
// ">

// {value}

// </h3>


// </div>


// );


// }


// // "use client";

// // import { useEffect, useState } from "react";
// // import { onAuthStateChanged } from "firebase/auth";

// // import {
// //   addDoc,
// //   collection,
// //   getDocs,
// //   query,
// //   where,
// //   updateDoc,
// // } from "firebase/firestore";

// // import { auth, db } from "../../lib/firebase";


// // export default function AttendancePage() {

// //   const [attendance, setAttendance] = useState(null);
// //   const [currentUser, setCurrentUser] = useState(null);
  
// // const [myAttendance, setMyAttendance] = useState([]);
// //   const [attendanceHistory, setAttendanceHistory] = useState([]);

// //   const [presentDays, setPresentDays] = useState(0);
// //   const [absentDays, setAbsentDays] = useState(0);
// //   const [lateDays, setLateDays] = useState(0);
// //   const [workingHours, setWorkingHours] = useState(0);

// //   const today = new Date().toISOString().split("T")[0];

// // useEffect(() => {

// //   const unsubscribe = onAuthStateChanged(auth, async (user) => {

// //     if (!user) {
// //       window.location.href = "/login";
// //       return;
// //     }

// //     setCurrentUser(user);

// //     await loadAttendance(user.uid);

// //     await loadAttendanceHistory(user.uid);

// //   });

// //   return () => unsubscribe();

// // }, []);

// // const loadAttendance = async (uid) => {

// //   const q = query(
// //     collection(db, "attendance"),
// //     where("userId", "==", uid),
// //     where("date", "==", today)
// //   );

// //   const snapshot = await getDocs(q);

// //   if (!snapshot.empty) {

// //     setAttendance({
// //       id: snapshot.docs[0].id,
// //       ...snapshot.docs[0].data(),
// //     });

// //   } else {

// //     setAttendance(null);

// //   }

// // };

// // const loadAttendanceHistory = async (uid) => {

// //   const q = query(
// //     collection(db, "attendance"),
// //     where("userId", "==", uid)
// //   );

// //   const snapshot = await getDocs(q);

// //   const list = snapshot.docs.map(doc => ({
// //     id: doc.id,
// //     ...doc.data(),
// //   }));

// //   setAttendanceHistory(list);
// // setMyAttendance(list);

// //   // Present Days
// //   setPresentDays(list.length);

// //   // Absent Days (you can improve this later)
// //   setAbsentDays(0);

// //   let late = 0;
// //   let totalHours = 0;

// //   list.forEach(item => {

// //     if (item.PunchIn) {

// //       const punchIn = item.PunchIn.toDate
// //         ? item.PunchIn.toDate()
// //         : new Date(item.PunchIn);

// //       // Late after 9:15 AM
// //       if (
// //         punchIn.getHours() > 9 ||
// //         (punchIn.getHours() === 9 &&
// //           punchIn.getMinutes() > 15)
// //       ) {
// //         late++;
// //       }

// //     }

// //     if (item.PunchIn && item.PunchOut) {

// //       const inTime = item.PunchIn.toDate
// //         ? item.PunchIn.toDate()
// //         : new Date(item.PunchIn);

// //       const outTime = item.PunchOut.toDate
// //         ? item.PunchOut.toDate()
// //         : new Date(item.PunchOut);

// //       totalHours +=
// //         (outTime - inTime) /
// //         (1000 * 60 * 60);

// //     }

// //   });

// //   setLateDays(late);
// //   setWorkingHours(totalHours.toFixed(1));

// // };

// // const PunchIn = async () => {

// //   const user = auth.currentUser;

// //   if (!user) {
// //     alert("Please login first");
// //     return;
// //   }

// //   if (attendance) {
// //     alert("Already Punched In Today");
// //     return;
// //   }

// //   try {

// //     await addDoc(collection(db, "attendance"), {
// //   userId: user.uid,
// //   employeeName: user.displayName || user.email,
// //   email: user.email,

// //   date: today,

// //   PunchIn: new Date(),
// //   PunchOut: null,

// //   PunchIn: new Date(),
// //   PunchOut: null,

// //   totalHours: 0,

// //   status: "Present",
// // });

// //     await loadAttendance(user.uid);
// //     await loadAttendanceHistory(user.uid);

// //     alert("Punch In Successful");

// //   } catch (error) {

// //     console.error(error);
// //     alert("Punch In Failed");

// //   }

// // };

// // const PunchOut = async () => {

// //   const user = auth.currentUser;

// //   if (!user) {
// //     alert("Please login first");
// //     return;
// //   }

// //   if (!attendance) {
// //     alert("Please Punch In First");
// //     return;
// //   }

// //   if (attendance.PunchOut) {
// //     alert("Already Punched Out");
// //     return;
// //   }

// //   try {

// //     const q = query(
// //       collection(db, "attendance"),
// //       where("userId", "==", user.uid),
// //       where("date", "==", today)
// //     );

// //     const snapshot = await getDocs(q);

// //     if (snapshot.empty) {
// //       alert("Attendance record not found.");
// //       return;
// //     }

// //     const docRef = snapshot.docs[0].ref;

// //     const outTime = new Date();

// // const inTime = attendance.PunchIn.toDate
// //   ? attendance.PunchIn.toDate()
// //   : new Date(attendance.PunchIn);

// // const hours =
// //   ((outTime - inTime) / (1000 * 60 * 60)).toFixed(2);

// // await updateDoc(docRef,{
// //   PunchOut: outTime,

// //   PunchOut: outTime,

// //   totalHours: hours,

// //   status: "Present",
// // });

// //     await loadAttendance(user.uid);
// //     await loadAttendanceHistory(user.uid);

// //     alert("Punch Out Successful");

// //   } catch (error) {

// //     console.error(error);
// //     alert("Punch Out Failed");

// //   }

// // };

// // const totalHours =
// //   attendance?.PunchIn && attendance?.PunchOut
// //     ? (
// //         (
// //           (
// //             (attendance.PunchOut.toDate
// //               ? attendance.PunchOut.toDate()
// //               : new Date(attendance.PunchOut))
// //             -
// //             (attendance.PunchIn.toDate
// //               ? attendance.PunchIn.toDate()
// //               : new Date(attendance.PunchIn))
// //           ) /
// //           (1000 * 60 * 60)
// //         ).toFixed(2)
// //       )
// //     : "--";

// // return (
// //   <div
// //     style={{
// //       maxWidth: "1400px",
// //       margin: "40px auto",
// //       padding: "30px",
// //     }}
// //   >
// //     <h1>📅 Attendance Dashboard</h1>

// //     <p
// //       style={{
// //         color: "#64748b",
// //         marginBottom: "30px",
// //       }}
// //     >
// //       Track your attendance, working hours and attendance history.
// //     </p>

// //     {/* Summary Cards */}

// //     <div
// //       style={{
// //         display: "grid",
// //         gridTemplateColumns: "repeat(4,1fr)",
// //         gap: "20px",
// //         marginBottom: "30px",
// //       }}
// //     >

// //       <div style={cardStyle}>
// //         <h3>Present Days</h3>
// //         <h1>{presentDays}</h1>
// //       </div>

// //       <div style={cardStyle}>
// //         <h3>Absent Days</h3>
// //         <h1>{absentDays}</h1>
// //       </div>

// //       <div style={cardStyle}>
// //         <h3>Late Days</h3>
// //         <h1>{lateDays}</h1>
// //       </div>

// //       <div style={cardStyle}>
// //         <h3>Working Hours</h3>
// //         <h1>{workingHours} hrs</h1>
// //       </div>

// //     </div>

// //     {/* Today's Attendance */}

// //     <div
// //       style={{
// //         background: "#fff",
// //         padding: "30px",
// //         borderRadius: "15px",
// //         boxShadow: "0 10px 25px rgba(0,0,0,.08)",
// //       }}
// //     >

// //       <h2>🟢 Today's Attendance</h2>

// //       <p>
// //         <b>Employee :</b> {currentUser?.displayName || currentUser?.email}
// //       </p>

// //       <p>
// //         <b>Date :</b> {today}
// //       </p>

// //       <p>
// //         <b>Status :</b> {attendance?.status || "Not Punched In"}
// //       </p>

// //       <p>
// //         <b>Punch In :</b>{" "}
// //         {attendance?.PunchIn
// //           ? (attendance.PunchIn.toDate
// //               ? attendance.PunchIn.toDate()
// //               : new Date(attendance.PunchIn)
// //             ).toLocaleTimeString()
// //           : "--"}
// //       </p>

// //       <p>
// //         <b>Punch Out :</b>{" "}
// //         {attendance?.PunchOut
// //           ? (attendance.PunchOut.toDate
// //               ? attendance.PunchOut.toDate()
// //               : new Date(attendance.PunchOut)
// //             ).toLocaleTimeString()
// //           : "--"}
// //       </p>

// //       <p>
// //         <b>Total Hours :</b> {totalHours} {totalHours !== "--" && "hrs"}
// //       </p>

// //       <div
// //         style={{
// //           display: "flex",
// //           gap: "15px",
// //           marginTop: "20px",
// //         }}
// //       >

// //         <button
// //           onClick={PunchIn}
// //           style={greenBtn}
// //           disabled={attendance && !attendance?.PunchOut}
// //         >
// //           Punch In
// //         </button>

// //         <button
// //           onClick={PunchOut}
// //           style={redBtn}
// //           disabled={!attendance || attendance?.PunchOut}
// //         >
// //           Punch Out
// //         </button>

// //       </div>

// //     </div>
// // {/* Attendance History */}
// //   <div
// //     style={{
// //       background: "#fff",
// //       padding: "25px",
// //       borderRadius: "15px",
// //       boxShadow:
// //         "0 5px 20px rgba(0,0,0,0.08)",
// //       marginBottom: "30px",
// //     }}
// //   >
// //     <h2>📅 Attendance History</h2>

// //     <table
// //       style={{
// //         width: "100%",
// //         marginTop: "20px",
// //         borderCollapse: "collapse",
// //       }}
// //     >
// //       <thead>
// //         <tr>
// //           <th style={thStyle}>Date</th>
// //           <th style={thStyle}>Punch In</th>
// //           <th style={thStyle}>Punch Out</th>
// //         </tr>
// //       </thead>

// //       <tbody>
// //         {myAttendance.map((item) => (
// //           <tr key={item.id}>
// //             <td style={tdStyle}>{item.date}</td>

// //             <td style={tdStyle}>
// //               {item.PunchIn
// //                 ? item.PunchIn
// //                     .toDate()
// //                     .toLocaleTimeString()
// //                 : "-"}
// //             </td>

// //             <td style={tdStyle}>
// //               {item.PunchOut
// //                 ? item.PunchOut
// //                     .toDate()
// //                     .toLocaleTimeString()
// //                 : "-"}
// //             </td>
// //           </tr>
// //         ))}
// //       </tbody>
// //     </table>
// //   </div>

 
// //   </div>
// // );
// // }


// // const thStyle = {
// // borderBottom: "1px solid #ddd",
// // padding: "12px",
// // textAlign: "left",
// // background: "#f8fafc",
// // };

// // const tdStyle = {
// // borderBottom: "1px solid #eee",
// // padding: "12px",
// // }; 
// // const cardStyle = {
// //   background: "#fff",
// //   padding: "25px",
// //   borderRadius: "15px",
// //   textAlign: "center",
// //   boxShadow: "0 10px 20px rgba(0,0,0,.08)",
// // };

// // const greenBtn = {
// //   background: "#22c55e",
// //   color: "#fff",
// //   padding: "12px 24px",
// //   border: "none",
// //   borderRadius: "10px",
// //   cursor: "pointer",
// //   fontWeight: "bold",
// // };

// // const redBtn = {
// //   background: "#ef4444",
// //   color: "#fff",
// //   padding: "12px 24px",
// //   border: "none",
// //   borderRadius: "10px",
// //   cursor: "pointer",
// //   fontWeight: "bold",
// // };
