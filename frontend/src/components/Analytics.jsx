import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { FileText, Edit3, Building2, TrendingUp } from "lucide-react";
import "./Pages.css";

import API_BASE from "../config";

function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  async function fetchAnalytics() {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/analytics`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setData(await res.json());
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchAnalytics();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (loading)
    return (
      <div className="page-container">
        <div className="empty-state">Loading analytics...</div>
      </div>
    );
  if (!data)
    return (
      <div className="page-container">
        <div className="empty-state">Failed to load analytics data.</div>
      </div>
    );

  const ORANGE = "#E8510A";

  return (
    <div className="page-container">
      <div className="page-header-row">
        <h2>Analytics Dashboard</h2>
      </div>

      {/* Stat Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <FileText size={22} />
          </div>
          <div className="stat-value">{data.stats.total_jds}</div>
          <div className="stat-label">Total JDs Generated</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <Building2 size={22} />
          </div>
          <div
            className="stat-value"
            style={{
              fontSize:
                data.stats.most_used_industry.length > 8 ? "18px" : "24px",
            }}
          >
            {data.stats.most_used_industry}
          </div>
          <div className="stat-label">Most Used Industry</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <Edit3 size={22} />
          </div>
          <div className="stat-value">{data.stats.total_edits}</div>
          <div className="stat-label">Total Edits Made</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <TrendingUp size={22} />
          </div>
          <div className="stat-value">{data.stats.jds_this_week}</div>
          <div className="stat-label">JDs This Week</div>
        </div>
      </div>

      {/* Charts */}
      <div className="charts-row">
        <div className="chart-card">
          <div className="chart-title">JDs per Industry</div>
          <div style={{ height: "280px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.industry_data}
                margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#FDDECE"
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#6B7280" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#6B7280" }}
                  allowDecimals={false}
                />
                <RechartsTooltip
                  cursor={{ fill: "#FFF7F5" }}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #FDDECE",
                    boxShadow: "0 2px 8px rgba(232,81,10,0.08)",
                    fontSize: "13px",
                  }}
                />
                <Bar
                  dataKey="value"
                  fill={ORANGE}
                  radius={[6, 6, 0, 0]}
                  barSize={36}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-title">Generation Timeline — Last 30 Days</div>
          <div style={{ height: "280px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data.timeline_data}
                margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#FDDECE"
                />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "#6B7280" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#6B7280" }}
                  allowDecimals={false}
                />
                <RechartsTooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #FDDECE",
                    boxShadow: "0 2px 8px rgba(232,81,10,0.08)",
                    fontSize: "13px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke={ORANGE}
                  strokeWidth={2.5}
                  dot={{ fill: ORANGE, strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, fill: ORANGE }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Titles Table */}
      <div className="top-titles-card">
        <div className="chart-title">Most Generated Job Titles</div>
        {data.top_titles.length === 0 ? (
          <div
            style={{
              color: "var(--text-muted)",
              fontSize: "14px",
              textAlign: "center",
              padding: "20px",
            }}
          >
            No data yet
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Job Title</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {data.top_titles.map((t, i) => (
                <tr key={i}>
                  <td>
                    <div className="rank-circle">{i + 1}</div>
                  </td>
                  <td style={{ fontWeight: 500 }}>{t.title}</td>
                  <td style={{ color: "var(--primary)", fontWeight: 600 }}>
                    {t.count} JDs
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default Analytics;
