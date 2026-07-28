"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type UsageRow = {
  id: string;
  userId: string;
  employeeName: string;
  email: string;
  tool: string;
  date: string;
  createdAt?: any;
};

export default function AdminToolsReport() {
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Default range: last 7 days
  const todayStr = new Date().toISOString().substring(0, 10);
  const weekAgoStr = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
    .toISOString()
    .substring(0, 10);

  const [fromDate, setFromDate] = useState(weekAgoStr);
  const [toDate, setToDate] = useState(todayStr);

  async function loadUsage() {
    setLoading(true);
    try {
      const q = query(
        collection(db, "toolUsage"),
        where("date", ">=", fromDate),
        where("date", "<=", toDate)
      );

      const snap = await getDocs(q);

      const list = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as UsageRow[];

      setRows(list);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- Aggregations -----

  // Total opens per tool (for the chart)
  const toolCounts: Record<string, number> = {};
  rows.forEach((row) => {
    toolCounts[row.tool] = (toolCounts[row.tool] || 0) + 1;
  });

  const chartData = Object.entries(toolCounts)
    .map(([tool, count]) => ({ tool, count }))
    .sort((a, b) => b.count - a.count);

  // Per employee x tool breakdown (for the table)
  type BreakdownEntry = {
    employeeName: string;
    email: string;
    tool: string;
    count: number;
    lastUsed: string;
  };

  const breakdownMap: Record<string, BreakdownEntry> = {};

  rows.forEach((row) => {
    const key = `${row.userId}__${row.tool}`;

    if (!breakdownMap[key]) {
      breakdownMap[key] = {
        employeeName: row.employeeName || row.email || "Unknown",
        email: row.email,
        tool: row.tool,
        count: 0,
        lastUsed: row.date,
      };
    }

    breakdownMap[key].count += 1;

    if (row.date > breakdownMap[key].lastUsed) {
      breakdownMap[key].lastUsed = row.date;
    }
  });

  const breakdown = Object.values(breakdownMap).sort(
    (a, b) => b.count - a.count
  );

  const totalOpens = rows.length;
  const activeEmployees = new Set(rows.map((r) => r.userId)).size;
  const toolsUsed = Object.keys(toolCounts).length;

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-4">
      {/* HEADER */}
      <section className="bg-white rounded-3xl p-6 sm:p-8 mb-6 border border-[#eaf3ff] shadow-sm">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-[#111111] tracking-tight">
          📊 AI Tools Usage Report
        </h1>
        <p className="text-base sm:text-lg text-[#444444] mt-3">
          See which AI tools your team is opening, and how often.
        </p>

        {/* DATE FILTER */}
        <div className="flex flex-wrap items-end gap-4 mt-6">
          <div>
            <label className="block text-sm text-[#64748b] mb-1">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="border border-[#e2e8f0] rounded-xl px-4 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm text-[#64748b] mb-1">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="border border-[#e2e8f0] rounded-xl px-4 py-2 text-sm"
            />
          </div>

          <button
            onClick={loadUsage}
            className="bg-[#3d6fa8] text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-[#325d8d] transition"
          >
            Apply Filter
          </button>
        </div>
      </section>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-3xl p-6 border border-[#eaf3ff] shadow-sm">
          <p className="text-sm text-[#64748b]">Total Opens</p>
          <h2 className="text-3xl font-bold text-[#111] mt-1">{totalOpens}</h2>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-[#eaf3ff] shadow-sm">
          <p className="text-sm text-[#64748b]">Active Employees</p>
          <h2 className="text-3xl font-bold text-[#111] mt-1">{activeEmployees}</h2>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-[#eaf3ff] shadow-sm">
          <p className="text-sm text-[#64748b]">Tools Used</p>
          <h2 className="text-3xl font-bold text-[#111] mt-1">{toolsUsed}</h2>
        </div>
      </div>

      {/* CHART */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#eaf3ff] shadow-sm mb-6">
        <h2 className="text-xl font-bold text-[#111] mb-5">Opens by Tool</h2>

        {chartData.length === 0 ? (
          <p className="text-[#64748b] text-sm">
            No usage data for this date range yet.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <XAxis dataKey="tool" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#3d6fa8" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#eaf3ff] shadow-sm">
        <h2 className="text-xl font-bold text-[#111] mb-5">
          Employee Breakdown
        </h2>

        {loading ? (
          <p className="text-[#64748b] text-sm">Loading...</p>
        ) : breakdown.length === 0 ? (
          <p className="text-[#64748b] text-sm">
            No usage data for this date range yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
              <thead>
                <tr className="border-b text-[#444]">
                  <th className="py-3">Employee</th>
                  <th>Email</th>
                  <th>Tool</th>
                  <th>Opens</th>
                  <th>Last Used</th>
                </tr>
              </thead>

              <tbody>
                {breakdown.map((entry, i) => (
                  <tr key={i} className="border-b hover:bg-[#eaf3ff] transition">
                    <td className="py-4">{entry.employeeName}</td>
                    <td className="text-[#64748b]">{entry.email}</td>
                    <td>
                      <span className="bg-[#eaf3ff] text-[#3d6fa8] px-3 py-1 rounded-full text-sm">
                        {entry.tool}
                      </span>
                    </td>
                    <td className="font-semibold">{entry.count}</td>
                    <td className="text-[#64748b]">{entry.lastUsed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}