"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  type ChartData,
  type Plugin,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";
import STR_DATA from "@/lib/str-data";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// ── Types ──────────────────────────────────────────────────────────────────────
type WeeklyRecord = {
  weekStart: string;
  year: number;
  month: number;
  quarter: number;
  occProp: number;
  adrProp: number;
  revparProp: number;
  occComp: number;
  adrComp: number;
  revparComp: number;
  mpi: number;
  ari: number;
  rgi: number;
  source: string;
};

type MonthlyRecord = {
  period: string;
  year: number;
  month: number;
  quarter: number;
  occProp: number;
  adrProp: number;
  revparProp: number;
  occComp: number;
  adrComp: number;
  revparComp: number;
  mpi: number;
  ari: number;
  rgi: number;
  source: string;
  weekCount: number;
};

// ── Constants ─────────────────────────────────────────────────────────────────
const STR_BLUE = "#60a5fa";
const STR_GREEN = "#4ade80";
const STR_RED = "#f87171";
const STR_AMBER = "#fbbf24";
const STR_PURPLE = "#c084fc";
const STR_SLATE = "#94a3b8";

ChartJS.defaults.color = "#6b7280";
ChartJS.defaults.borderColor = "#1e293b";
ChartJS.defaults.font.family = "'Inter', system-ui, sans-serif";
ChartJS.defaults.font.size = 11;

// ── Helpers ───────────────────────────────────────────────────────────────────
function getSeason(month: number): "peak" | "shoulder" | "trough" {
  const meta = (STR_DATA as any).meta;
  if (meta.seasonMap.peak.includes(month)) return "peak";
  if (meta.seasonMap.trough.includes(month)) return "trough";
  return "shoulder";
}

function computeRollingAvg(data: (number | null)[], window: number): (number | null)[] {
  return data.map((val, i) => {
    if (val === null) return null;
    const slice = data
      .slice(Math.max(0, i - window + 1), i + 1)
      .filter((v): v is number => v !== null);
    if (slice.length === 0) return null;
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

function heatmapColor(val: number | null, min: number, max: number): string {
  if (val === null) return "rgba(255,255,255,0.03)";
  const t = Math.max(0, Math.min(1, (val - min) / (max - min)));
  if (t < 0.5) {
    const tt = t * 2;
    const r = Math.round(0x1e + (0x60 - 0x1e) * tt);
    const g = Math.round(0x3a + (0xa5 - 0x3a) * tt);
    const b = Math.round(0x5f + (0xfa - 0x5f) * tt);
    return `rgb(${r},${g},${b})`;
  } else {
    const tt = (t - 0.5) * 2;
    const r = Math.round(0x60 + (0x4a - 0x60) * tt);
    const g = Math.round(0xa5 + (0xde - 0xa5) * tt);
    const b = Math.round(0xfa + (0x80 - 0xfa) * tt);
    return `rgb(${r},${g},${b})`;
  }
}

function computeSeasonalBands(weekly: WeeklyRecord[]) {
  const bands: { season: string; startIdx: number; endIdx: number }[] = [];
  let currentSeason: string | null = null;
  let startIdx = 0;
  weekly.forEach((w, i) => {
    const s = getSeason(w.month);
    if (s !== currentSeason) {
      if (currentSeason !== null) {
        bands.push({ season: currentSeason, startIdx, endIdx: i - 1 });
      }
      currentSeason = s;
      startIdx = i;
    }
    if (i === weekly.length - 1) {
      bands.push({ season: currentSeason!, startIdx, endIdx: i });
    }
  });
  return bands;
}

// ── KPI Cards ─────────────────────────────────────────────────────────────────
function KpiCards() {
  const weekly = (STR_DATA as any).weekly as WeeklyRecord[];
  const last13 = weekly.slice(-13);
  const latest = weekly[weekly.length - 1];
  const rgiVals = last13.map((w) => w.rgi);
  const rgiAvg13 = rgiVals.reduce((a, b) => a + b, 0) / rgiVals.length;
  const rgiDelta = latest.rgi - rgiAvg13;

  // YoY RevPAR — find same week from prior year
  const lyWeek = weekly.find((w) => w.weekStart === "2025-03-15");
  const revparYoy = lyWeek
    ? ((latest.revparProp / lyWeek.revparProp - 1) * 100)
    : null;

  const circumference = 2 * Math.PI * 28;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* RGI */}
      <div className="bg-slate-800 border border-slate-700 hover:border-blue-500 rounded-xl p-4 relative overflow-hidden cursor-pointer transition-colors">
        <div className="absolute top-0 left-0 w-1 h-full bg-green-400 rounded-l-xl" />
        <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">RevPAR Index</div>
        <div className="text-3xl font-bold text-green-400">{latest.rgi.toFixed(1)}</div>
        <div className={`text-sm mt-1 ${rgiDelta >= 0 ? "text-green-400" : "text-red-400"}`}>
          {rgiDelta >= 0 ? "▲ +" : "▼ "}{Math.abs(rgiDelta).toFixed(1)} pts vs 13wk avg
        </div>
        <div className="text-xs text-slate-500 mt-1">RGI ≥ 120 = strong outperformance</div>
      </div>

      {/* RevPAR */}
      <div className="bg-slate-800 border border-slate-700 hover:border-blue-500 rounded-xl p-4 relative overflow-hidden cursor-pointer transition-colors">
        <div className="absolute top-0 left-0 w-1 h-full bg-blue-400 rounded-l-xl" />
        <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">RevPAR</div>
        <div className="text-3xl font-bold text-slate-100">${latest.revparProp.toFixed(2)}</div>
        {revparYoy !== null && (
          <div className={`text-sm mt-1 ${revparYoy >= 0 ? "text-green-400" : "text-red-400"}`}>
            {revparYoy >= 0 ? "▲ +" : "▼ "}{Math.abs(revparYoy).toFixed(1)}% vs same wk LY
          </div>
        )}
        <div className="text-xs text-slate-500 mt-1">Comp: ${latest.revparComp.toFixed(2)}</div>
      </div>

      {/* Win Rate */}
      <div className="bg-slate-800 border border-slate-700 hover:border-blue-500 rounded-xl p-4 relative overflow-hidden cursor-pointer transition-colors">
        <div className="absolute top-0 left-0 w-1 h-full bg-amber-400 rounded-l-xl" />
        <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Comp Set Win Rate</div>
        <div className="flex items-center gap-3 mt-1">
          <svg width="56" height="56" viewBox="0 0 64 64" className="shrink-0">
            <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
            <circle
              cx="32" cy="32" r="28" fill="none"
              stroke="#4ade80" strokeWidth="6"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeLinecap="round"
              transform="rotate(-90 32 32)"
            />
            <text x="32" y="37" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="bold">100%</text>
          </svg>
          <div>
            <div className="text-green-400 text-sm font-medium">▲ 93-week win streak</div>
            <div className="text-xs text-slate-500 mt-1">Every tracked week: RGI &gt; 100</div>
          </div>
        </div>
      </div>

      {/* ADR Premium */}
      <div className="bg-slate-800 border border-slate-700 hover:border-blue-500 rounded-xl p-4 relative overflow-hidden cursor-pointer transition-colors">
        <div className="absolute top-0 left-0 w-1 h-full bg-purple-400 rounded-l-xl" />
        <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Rate Premium</div>
        <div className="text-3xl font-bold text-slate-100">{latest.ari.toFixed(1)}</div>
        <div className="text-sm mt-1 text-green-400">
          ▲ +${(latest.adrProp - latest.adrComp).toFixed(2)} over comp ADR
        </div>
        <div className="text-xs text-slate-500 mt-1">
          Comp ADR: ${latest.adrComp.toFixed(2)} · Prop: ${latest.adrProp.toFixed(2)}
        </div>
      </div>
    </div>
  );
}

// ── Insights Bar ──────────────────────────────────────────────────────────────
const INSIGHTS = [
  { text: "93-week competitive win streak and counting — SpringHill Suites Lakeland has never lost a week to the comp set in our data. RGI above 100 every single week since Jan 2024.", highlight: "93-week competitive win streak" },
  { text: "February 2026 posted the highest RevPAR in property history: $210.11 — driven by ADR of $236.88 and 88.7% occupancy. Now the benchmark month.", highlight: "February 2026 posted the highest RevPAR in property history" },
  { text: "Summer dominance: Jul–Aug average RGI 144.9 — far above the 128.8 all-time average. The comp set collapses in summer; SHS holds strong.", highlight: "Summer dominance" },
  { text: "⚠️ December 2025 flag: Monthly figure (RGI 111.2, RevPAR $59.19) based on only 1 weekly record (week of 12-21). Full month data pending — not representative of actual Dec performance.", highlight: "December 2025 flag" },
  { text: "ADR has risen every January: $165.93 → $173.49 → $182.23 — 10% cumulative growth over 3 years. Rate premium is durable.", highlight: "ADR has risen every January" },
  { text: "Record week: Week of 2024-09-01 — RGI 187.0. Occupancy gap was extraordinary: SHS at 73.5% vs comp set at 44.9%. MPI of 163.5 drove it all.", highlight: "Record week" },
  { text: "2026 YTD running 8.9% ahead of 2025 RevPAR ($191.50 vs $175.84 for same period). Spring strength continuing.", highlight: "2026 YTD running 8.9% ahead" },
];

function InsightsBar() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((c) => (c + 1) % INSIGHTS.length);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const insight = INSIGHTS[current];

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-xl px-5 py-3 mb-6 flex items-center gap-4">
      <span className="text-xl shrink-0">💡</span>
      <div className="flex-1 text-sm text-slate-300 leading-relaxed">
        <strong className="text-slate-100">{insight.highlight}:</strong>{" "}
        {insight.text.replace(insight.highlight + ":", "").replace(insight.highlight, "").trim()}
      </div>
      <div className="flex gap-1.5 shrink-0">
        {INSIGHTS.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`w-1.5 h-1.5 rounded-full transition-colors ${
              i === current ? "bg-amber-400" : "bg-slate-600"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// ── RevPAR Trend Chart ────────────────────────────────────────────────────────
function RevPARTrendChart() {
  const weekly = (STR_DATA as any).weekly as WeeklyRecord[];
  const labels = weekly.map((w) => w.weekStart);
  const propData = weekly.map((w) => w.revparProp);
  const compData = weekly.map((w) => w.revparComp);
  const seasonBands = useMemo(() => computeSeasonalBands(weekly), []);

  const seasonBandsPlugin: Plugin<"line"> = useMemo(
    () => ({
      id: "seasonBands",
      beforeDraw(chart) {
        const {
          ctx: c,
          chartArea,
          scales: { x, y },
        } = chart;
        if (!chartArea) return;
        const { top, bottom } = chartArea;
        seasonBands.forEach((band) => {
          const x0 = x.getPixelForValue(band.startIdx);
          const x1 = x.getPixelForValue(band.endIdx);
          c.save();
          c.fillStyle =
            band.season === "peak"
              ? "rgba(74,222,128,0.07)"
              : band.season === "trough"
              ? "rgba(248,113,113,0.07)"
              : "rgba(251,191,36,0.05)";
          c.fillRect(x0, top, x1 - x0, bottom - top);
          c.restore();
        });
      },
    }),
    [seasonBands]
  );

  const chartData: ChartData<"line"> = {
    labels,
    datasets: [
      {
        label: "SHS RevPAR",
        data: propData,
        borderColor: STR_BLUE,
        backgroundColor: "rgba(96,165,250,0.08)",
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.3,
        fill: true,
        order: 2,
      },
      {
        label: "Comp Set RevPAR",
        data: compData,
        borderColor: STR_SLATE,
        backgroundColor: "transparent",
        borderWidth: 1.5,
        borderDash: [5, 3],
        pointRadius: 0,
        tension: 0.3,
        order: 2,
      },
    ],
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-sm font-semibold text-slate-100">RevPAR Trend — Property vs Comp Set</div>
          <div className="text-xs text-slate-400 mt-0.5">Weekly, Jan 2024 – Mar 2026 · Seasonal bands overlaid</div>
        </div>
        <span className="bg-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded-full">93 weeks</span>
      </div>
      <div className="h-80">
        <Line
          data={chartData}
          plugins={[seasonBandsPlugin]}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
              legend: { labels: { color: "#94a3b8", boxWidth: 12, padding: 16 } },
              tooltip: {
                callbacks: {
                  title: (items) => "Week of " + items[0].label,
                  label: (item) =>
                    " " + item.dataset.label + ": $" + Number(item.raw).toFixed(2),
                  afterBody: (items) => {
                    if (items.length >= 2) {
                      const gap = Number(items[0].raw) - Number(items[1].raw);
                      return [
                        "",
                        " Gap: $" +
                          gap.toFixed(2) +
                          " (" +
                          ((gap / Number(items[1].raw)) * 100).toFixed(1) +
                          "%)",
                      ];
                    }
                    return [];
                  },
                },
              },
            },
            scales: {
              x: {
                grid: { color: "rgba(255,255,255,0.04)" },
                ticks: {
                  color: "#64748b",
                  maxTicksLimit: 10,
                  callback: (_, idx) => (labels[idx] ? labels[idx].slice(0, 7) : ""),
                },
              },
              y: {
                min: 0,
                grid: { color: "rgba(255,255,255,0.04)" },
                ticks: { color: "#64748b", callback: (v) => "$" + v },
              },
            },
          }}
        />
      </div>
      <div className="flex gap-4 mt-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <div className="w-3 h-3 rounded-sm" style={{ background: "rgba(74,222,128,0.3)" }} />
          Peak (Feb–Apr)
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <div className="w-3 h-3 rounded-sm" style={{ background: "rgba(251,191,36,0.2)" }} />
          Shoulder
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <div className="w-3 h-3 rounded-sm" style={{ background: "rgba(248,113,113,0.2)" }} />
          Trough (Jul–Aug, Dec)
        </div>
      </div>
    </div>
  );
}

// ── RGI Competitive Dominance Chart ──────────────────────────────────────────
function RGIChart() {
  const weekly = (STR_DATA as any).weekly as WeeklyRecord[];
  const labels = weekly.map((w) => w.weekStart);
  const rgiData = weekly.map((w) => w.rgi);
  const rolling13 = useMemo(() => computeRollingAvg(rgiData, 13), []);

  const pointColors = rgiData.map((v) =>
    v >= 130 ? STR_GREEN : v >= 100 ? STR_BLUE : STR_RED
  );

  const rgiZonesPlugin: Plugin<"line"> = useMemo(
    () => ({
      id: "rgiZones",
      beforeDraw(chart) {
        const {
          ctx: c,
          chartArea,
          scales: { x, y },
        } = chart;
        if (!chartArea) return;
        const { left, right, top, bottom } = chartArea;
        const y130 = y.getPixelForValue(130);
        const y100 = y.getPixelForValue(100);

        c.save();
        c.fillStyle = "rgba(74,222,128,0.06)";
        c.fillRect(left, top, right - left, y130 - top);
        c.fillStyle = "rgba(96,165,250,0.06)";
        c.fillRect(left, y130, right - left, y100 - y130);
        c.fillStyle = "rgba(248,113,113,0.06)";
        c.fillRect(left, y100, right - left, bottom - y100);

        // Parity line
        c.strokeStyle = "rgba(248,113,113,0.6)";
        c.lineWidth = 1.5;
        c.setLineDash([5, 4]);
        c.beginPath();
        c.moveTo(left, y100);
        c.lineTo(right, y100);
        c.stroke();
        c.setLineDash([]);
        c.fillStyle = "#f87171";
        c.font = "bold 10px Inter, system-ui";
        c.fillText("100 = Parity", right - 80, y100 - 4);

        // Dominant threshold
        c.strokeStyle = "rgba(74,222,128,0.3)";
        c.lineWidth = 1;
        c.setLineDash([3, 4]);
        c.beginPath();
        c.moveTo(left, y130);
        c.lineTo(right, y130);
        c.stroke();
        c.setLineDash([]);
        c.fillStyle = "#4ade80";
        c.font = "10px Inter, system-ui";
        c.fillText("130 = Dominant", right - 90, y130 - 4);
        c.restore();
      },
      afterDraw(chart) {
        const {
          ctx: c,
          scales: { x, y },
        } = chart;
        const highIdx = weekly.findIndex((w) => w.weekStart === "2024-09-01");
        const lowIdx = weekly.findIndex((w) => w.weekStart === "2024-04-07");

        if (highIdx >= 0) {
          const px = x.getPixelForValue(highIdx);
          const py = y.getPixelForValue(187.0);
          c.save();
          c.fillStyle = STR_AMBER;
          c.font = "bold 10px Inter, system-ui";
          c.textAlign = "center";
          c.fillText("⭐ 187.0", px, py - 14);
          c.fillText("Record High", px, py - 4);
          c.restore();
        }
        if (lowIdx >= 0) {
          const px = x.getPixelForValue(lowIdx);
          const py = y.getPixelForValue(100.1);
          c.save();
          c.fillStyle = "#f87171";
          c.font = "10px Inter, system-ui";
          c.textAlign = "center";
          c.fillText("100.1", px, py + 14);
          c.restore();
        }
      },
    }),
    []
  );

  const chartData: ChartData<"line"> = {
    labels,
    datasets: [
      {
        label: "Weekly RGI",
        data: rgiData,
        borderColor: STR_BLUE,
        backgroundColor: "transparent",
        borderWidth: 1.5,
        pointRadius: rgiData.map(() => 3),
        pointBackgroundColor: pointColors,
        pointBorderColor: pointColors,
        tension: 0.2,
        order: 2,
      },
      {
        label: "13-Week Rolling Avg",
        data: rolling13 as number[],
        borderColor: STR_PURPLE,
        backgroundColor: "transparent",
        borderWidth: 2.5,
        pointRadius: 0,
        tension: 0.4,
        order: 1,
      },
    ],
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-sm font-semibold text-slate-100">
            Competitive Dominance — RGI Weekly
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            With 13-week rolling average · Zone thresholds · Record annotations
          </div>
        </div>
        <span className="bg-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded-full">RGI</span>
      </div>
      <div className="h-80">
        <Line
          data={chartData}
          plugins={[rgiZonesPlugin]}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
              legend: { labels: { color: "#94a3b8", boxWidth: 12, padding: 16 } },
              tooltip: {
                callbacks: {
                  title: (items) => "Week of " + items[0].label,
                  label: (item) => {
                    const w = weekly[item.dataIndex];
                    if (!w) return "";
                    if (item.datasetIndex === 0)
                      return ` RGI: ${Number(item.raw).toFixed(1)} | MPI: ${w.mpi.toFixed(1)} | ARI: ${w.ari.toFixed(1)}`;
                    return ` 13wk Avg: ${Number(item.raw).toFixed(1)}`;
                  },
                },
              },
            },
            scales: {
              x: {
                grid: { color: "rgba(255,255,255,0.04)" },
                ticks: {
                  color: "#64748b",
                  maxTicksLimit: 10,
                  callback: (_, idx) => (labels[idx] ? labels[idx].slice(0, 7) : ""),
                },
              },
              y: {
                min: 85,
                max: 200,
                grid: { color: "rgba(255,255,255,0.04)" },
                ticks: { color: "#64748b" },
              },
            },
          }}
        />
      </div>
      <div className="flex gap-4 mt-3 flex-wrap">
        {[
          { color: STR_GREEN, label: "Dominant ≥130" },
          { color: STR_BLUE, label: "Winning 100–129" },
          { color: STR_RED, label: "Losing <100" },
          { color: STR_PURPLE, label: "13wk Avg" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs text-slate-400">
            <div className="w-2 h-2 rounded-full" style={{ background: color }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Index Decomposition Chart ─────────────────────────────────────────────────
function IndexDecompositionChart() {
  const monthly = (STR_DATA as any).monthly as MonthlyRecord[];
  const labels = monthly.map((m) => m.period);
  const mpiData = monthly.map((m) => m.mpi);
  const ariData = monthly.map((m) => m.ari);
  const rgiData = monthly.map((m) => m.rgi);

  const parityLinePlugin: Plugin<"bar"> = useMemo(
    () => ({
      id: "parityLine",
      afterDraw(chart) {
        const {
          ctx: c,
          chartArea: { left, right },
          scales: { y },
        } = chart;
        const y100 = y.getPixelForValue(100);
        c.save();
        c.strokeStyle = "rgba(71,85,105,0.6)";
        c.lineWidth = 1;
        c.setLineDash([4, 4]);
        c.beginPath();
        c.moveTo(left, y100);
        c.lineTo(right, y100);
        c.stroke();
        c.setLineDash([]);
        c.fillStyle = "#475569";
        c.font = "10px Inter, system-ui";
        c.fillText("100 = parity", right - 70, y100 - 3);
        c.restore();
      },
    }),
    []
  );

  const chartData: ChartData<"bar"> = {
    labels,
    datasets: [
      {
        label: "MPI (Occ Index)",
        data: mpiData,
        backgroundColor: "rgba(74,222,128,0.5)",
        borderColor: STR_GREEN,
        borderWidth: 1,
        borderRadius: 3,
        order: 2,
      },
      {
        label: "ARI (Rate Index)",
        data: ariData,
        backgroundColor: "rgba(96,165,250,0.5)",
        borderColor: STR_BLUE,
        borderWidth: 1,
        borderRadius: 3,
        order: 2,
      },
    ],
  };

  // RGI overlay as line — needs a mixed chart; we'll use a separate Line overlay
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-sm font-semibold text-slate-100">
            Index Decomposition — Where Does Our Advantage Come From?
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            MPI (occupancy) + ARI (rate) → RGI · Monthly
          </div>
        </div>
        <span className="bg-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded-full">Monthly</span>
      </div>
      <div className="h-80">
        <Bar
          data={{
            labels,
            datasets: [
              {
                label: "MPI (Occ Index)",
                data: mpiData,
                backgroundColor: "rgba(74,222,128,0.5)",
                borderColor: STR_GREEN,
                borderWidth: 1,
                // @ts-ignore
                borderRadius: 3,
                order: 2,
              },
              {
                label: "ARI (Rate Index)",
                data: ariData,
                backgroundColor: "rgba(96,165,250,0.5)",
                borderColor: STR_BLUE,
                borderWidth: 1,
                // @ts-ignore
                borderRadius: 3,
                order: 2,
              },
              {
                // @ts-ignore
                type: "line",
                label: "RGI",
                data: rgiData,
                borderColor: STR_AMBER,
                backgroundColor: "transparent",
                borderWidth: 2.5,
                pointRadius: 3,
                pointBackgroundColor: STR_AMBER,
                tension: 0.3,
                order: 1,
              },
            ],
          }}
          plugins={[parityLinePlugin]}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
              legend: { labels: { color: "#94a3b8", boxWidth: 12, padding: 12 } },
              tooltip: {
                callbacks: {
                  title: (items) => items[0].label,
                  label: (item) => {
                    const m = monthly[item.dataIndex];
                    if (item.dataset.label === "RGI")
                      return ` RGI: ${Number(item.raw).toFixed(1)}`;
                    if (item.dataset.label === "MPI (Occ Index)") {
                      const lead = m && m.mpi > m.ari ? " (Demand-led)" : "";
                      return ` MPI: ${Number(item.raw).toFixed(1)}${lead}`;
                    }
                    if (item.dataset.label === "ARI (Rate Index)") {
                      const lead = m && m.ari > m.mpi ? " (Rate-led)" : "";
                      return ` ARI: ${Number(item.raw).toFixed(1)}${lead}`;
                    }
                    return ` ${item.dataset.label}: ${Number(item.raw).toFixed(1)}`;
                  },
                },
              },
            },
            scales: {
              x: {
                grid: { color: "rgba(255,255,255,0.04)" },
                ticks: { color: "#64748b", maxTicksLimit: 9, maxRotation: 45 },
              },
              y: {
                min: 85,
                grid: { color: "rgba(255,255,255,0.04)" },
                ticks: { color: "#64748b" },
              },
            },
          }}
        />
      </div>
      <div className="flex gap-4 mt-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <div className="w-3 h-3 rounded-sm" style={{ background: "rgba(74,222,128,0.6)" }} />
          MPI (Occ Index)
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <div className="w-3 h-3 rounded-sm" style={{ background: "rgba(96,165,250,0.6)" }} />
          ARI (Rate Index)
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <div className="w-2 h-2 rounded-full" style={{ background: STR_AMBER }} />
          RGI line
        </div>
      </div>
    </div>
  );
}

// ── Seasonal Heatmap ──────────────────────────────────────────────────────────
function SeasonalHeatmap() {
  const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const years = [2024, 2025, 2026];
  const monthly = (STR_DATA as any).monthly as MonthlyRecord[];

  const lookup: Record<number, Record<number, MonthlyRecord>> = {};
  monthly.forEach((m) => {
    if (!lookup[m.year]) lookup[m.year] = {};
    lookup[m.year][m.month] = m;
  });

  const allRGI = monthly.map((m) => m.rgi);
  const minRGI = Math.min(...allRGI);
  const maxRGI = Math.max(...allRGI);

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-sm font-semibold text-slate-100">Seasonal Performance Heatmap</div>
          <div className="text-xs text-slate-400 mt-0.5">RGI by month × year · Color: low→high</div>
        </div>
        <span className="bg-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded-full">Heatmap</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="text-left text-slate-400 font-medium py-1.5 pr-3 w-14"></th>
              {monthLabels.map((m) => (
                <th key={m} className="text-center text-slate-400 font-medium py-1.5 px-1 min-w-[44px]">
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {years.map((year) => (
              <tr key={year}>
                <td className={`font-semibold pr-3 py-1 ${year === 2026 ? "text-blue-400" : "text-slate-300"}`}>
                  {year}
                </td>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((mo) => {
                  const rec = lookup[year]?.[mo];
                  if (!rec) {
                    return (
                      <td key={mo} className="text-center py-1 px-1">
                        <div
                          className="rounded text-slate-600 text-xs py-1"
                          style={{ background: "rgba(255,255,255,0.03)" }}
                        >
                          —
                        </div>
                      </td>
                    );
                  }
                  const color = heatmapColor(rec.rgi, minRGI, maxRGI);
                  const isAnomaly = year === 2025 && mo === 12;
                  const textColor = rec.rgi > (minRGI + maxRGI) / 2 ? "#0f172a" : "#fff";
                  return (
                    <td key={mo} className="text-center py-1 px-1">
                      <div
                        className={`rounded text-xs py-1 font-medium transition-transform hover:scale-110 cursor-default relative ${
                          isAnomaly ? "ring-1 ring-amber-400" : ""
                        }`}
                        style={{ background: color, color: textColor }}
                        title={
                          isAnomaly
                            ? "Dec 2025 based on 1 weekly record (week of 12-21). Full month data pending."
                            : `${rec.period} · RGI ${rec.rgi.toFixed(1)} · RevPAR $${rec.revparProp.toFixed(0)} · Occ ${(rec.occProp * 100).toFixed(1)}%`
                        }
                      >
                        {rec.rgi.toFixed(1)}
                        {isAnomaly && (
                          <span className="absolute -top-1 -right-1 text-amber-400 text-[9px]">⚠</span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-4 mt-3">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <div className="w-3 h-3 rounded" style={{ background: "#1e3a5f" }} />
          Low RGI
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <div className="w-3 h-3 rounded" style={{ background: "#60a5fa" }} />
          Mid
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <div className="w-3 h-3 rounded" style={{ background: "#4ade80" }} />
          High RGI
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400 ml-auto">
          <span className="text-amber-400">⚠</span>
          Anomaly flag
        </div>
      </div>
    </div>
  );
}

// ── Records & Streaks ─────────────────────────────────────────────────────────
function RecordsSection() {
  const records = [
    { icon: "🏆", value: "RGI 187.0", label: "Highest RGI Week", when: "Week of 2024-09-01" },
    { icon: "💰", value: "$210.11", label: "Highest RevPAR Month", when: "February 2026" },
    { icon: "🔥", value: "93 Weeks", label: "Active Win Streak", when: "2024-01-07 – present · RGI > 100" },
    { icon: "☀️", value: "RGI 152.6", label: "Best Summer Month", when: "August 2024" },
    { icon: "📈", value: "$324.25", label: "Highest Single-Week RevPAR", when: "Week of 2025-03-30" },
    { icon: "🏨", value: "98.6%", label: "Highest Occupancy Week", when: "Week of 2024-10-13" },
  ];

  const strRecords = (STR_DATA as any).records;
  const seasonLabel: Record<string, string> = {
    peak: "🌸 Peak",
    shoulder: "🌥️ Shoulder",
    trough: "🌞 Trough",
  };

  return (
    <div className="space-y-6">
      {/* Records grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {records.map((r, i) => (
          <div
            key={i}
            className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center"
          >
            <div className="text-2xl mb-1">{r.icon}</div>
            <div className="text-lg font-bold text-slate-100">{r.value}</div>
            <div className="text-xs text-slate-400 mt-0.5">{r.label}</div>
            <div className="text-xs text-slate-500 mt-1">{r.when}</div>
          </div>
        ))}
      </div>

      {/* Best / Worst weeks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div className="text-sm font-semibold text-amber-400 mb-3">🏆 Top 5 Weeks by RGI</div>
          <div className="space-y-2">
            {strRecords.top10WeeksByRGI.slice(0, 5).map((w: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-slate-700/50 last:border-0">
                <span className="text-slate-400 font-mono">{w.weekStart}</span>
                <span className="text-slate-500 flex-1 mx-3">
                  {seasonLabel[w.season] || w.season} · RevPAR ${w.revparProp.toFixed(0)} · MPI {w.mpi}
                </span>
                <span className="text-green-400 font-bold">{w.rgi.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div className="text-sm font-semibold text-slate-400 mb-3">⚠️ Bottom 5 Weeks by RGI</div>
          <div className="space-y-2">
            {strRecords.bottom10WeeksByRGI.slice(0, 5).map((w: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-slate-700/50 last:border-0">
                <span className="text-slate-400 font-mono">{w.weekStart}</span>
                <span className="text-slate-500 flex-1 mx-3">
                  {seasonLabel[w.season] || w.season} · RevPAR ${w.revparProp.toFixed(0)} · MPI {w.mpi}
                </span>
                <span className="text-amber-400 font-bold">{w.rgi.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Monthly Data Table ────────────────────────────────────────────────────────
function MonthlyTable() {
  const monthly = (STR_DATA as any).monthly as MonthlyRecord[];

  function rgiColor(rgi: number) {
    if (rgi >= 130) return "text-green-400 font-bold";
    if (rgi >= 100) return "text-blue-400";
    return "text-red-400";
  }

  // Compute YoY delta for RevPAR (compare same period last year)
  function getYoyDelta(period: MonthlyRecord) {
    const lyPeriod = `${period.year - 1}-${String(period.month).padStart(2, "0")}`;
    const ly = monthly.find((m) => m.period === lyPeriod);
    if (!ly) return null;
    return ((period.revparProp / ly.revparProp - 1) * 100);
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <div className="mb-4">
        <div className="text-sm font-semibold text-slate-100">
          Monthly STR Summary — All Months 2024–2026
        </div>
        <div className="text-xs text-slate-400 mt-0.5">
          Occ%, ADR, RevPAR, RGI vs comp set · RGI color-coded:{" "}
          <span className="text-green-400">■ Dominant ≥130</span> ·{" "}
          <span className="text-blue-400">■ Winning 100–129</span> ·{" "}
          <span className="text-red-400">■ Below 100</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700">
              {[
                "Period",
                "Occ% Prop",
                "Occ% Comp",
                "MPI",
                "ADR Prop",
                "ADR Comp",
                "ARI",
                "RevPAR Prop",
                "RevPAR Comp",
                "RevPAR YoY",
                "RGI",
              ].map((h) => (
                <th
                  key={h}
                  className={`py-2 px-2 font-semibold text-slate-400 uppercase tracking-wide ${
                    h === "Period" ? "text-left" : "text-right"
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...monthly].reverse().map((d, i) => {
              const yoy = getYoyDelta(d);
              const isDec25 = d.period === "2025-12";
              return (
                <tr
                  key={d.period}
                  className={`border-b border-slate-700/30 hover:bg-blue-500/5 transition-colors ${
                    isDec25 ? "bg-amber-900/10" : ""
                  }`}
                  title={
                    isDec25
                      ? "⚠️ Dec 2025: 1 weekly record only. Not representative of full month."
                      : undefined
                  }
                >
                  <td className="py-2 px-2 text-slate-300 font-mono font-medium">
                    {d.period}
                    {isDec25 && " ⚠️"}
                  </td>
                  <td className="py-2 px-2 text-right text-slate-300">
                    {(d.occProp * 100).toFixed(1)}%
                  </td>
                  <td className="py-2 px-2 text-right text-slate-500">
                    {(d.occComp * 100).toFixed(1)}%
                  </td>
                  <td
                    className={`py-2 px-2 text-right ${
                      d.mpi >= 100 ? "text-slate-300" : "text-red-400"
                    }`}
                  >
                    {d.mpi.toFixed(1)}
                  </td>
                  <td className="py-2 px-2 text-right text-slate-300">
                    ${d.adrProp.toFixed(2)}
                  </td>
                  <td className="py-2 px-2 text-right text-slate-500">
                    ${d.adrComp.toFixed(2)}
                  </td>
                  <td
                    className={`py-2 px-2 text-right ${
                      d.ari >= 100 ? "text-slate-300" : "text-red-400"
                    }`}
                  >
                    {d.ari.toFixed(1)}
                  </td>
                  <td className="py-2 px-2 text-right font-medium text-slate-100">
                    ${d.revparProp.toFixed(2)}
                  </td>
                  <td className="py-2 px-2 text-right text-slate-500">
                    ${d.revparComp.toFixed(2)}
                  </td>
                  <td className="py-2 px-2 text-right">
                    {yoy !== null ? (
                      <span className={yoy >= 0 ? "text-green-400" : "text-red-400"}>
                        {yoy >= 0 ? "+" : ""}{yoy.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className={`py-2 px-2 text-right ${rgiColor(d.rgi)}`}>
                    {d.rgi.toFixed(1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Section Header ────────────────────────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">{title}</h2>
      <div className="flex-1 h-px bg-slate-700" />
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function STRPerformancePage() {
  const meta = (STR_DATA as any).meta;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="p-6 max-w-[1600px] mx-auto">
        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-100">STR Performance</h1>
              <p className="text-sm text-slate-400 mt-0.5">
                SpringHill Suites Lakeland · Competitive Intelligence ·{" "}
                <span className="text-blue-400">
                  {meta.totalWeeks} weeks · {meta.dataFrom} – {meta.dataThrough}
                </span>
              </p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-1.5">
                <div className="text-xs text-slate-400">All-Time Avg RGI</div>
                <div className="text-lg font-bold text-green-400">{meta.avgRGI}</div>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-1.5">
                <div className="text-xs text-slate-400">Win Streak</div>
                <div className="text-lg font-bold text-blue-400">{meta.streakAbove100} weeks</div>
              </div>
            </div>
          </div>
        </div>

        {/* A. KPI Hero Cards */}
        <SectionHeader title="A. Current Performance — Week of Mar 15, 2026" />
        <KpiCards />

        {/* Insights Bar */}
        <InsightsBar />

        {/* B. Trend Intelligence */}
        <SectionHeader title="B. Trend Intelligence — 93 Weeks" />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-8">
          <RevPARTrendChart />
          <RGIChart />
        </div>

        {/* C. Pattern Analysis */}
        <SectionHeader title="C. Pattern Analysis" />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-8">
          <IndexDecompositionChart />
          <SeasonalHeatmap />
        </div>

        {/* D. Records & Streaks */}
        <SectionHeader title="D. Records & Streaks" />
        <div className="mb-8">
          <RecordsSection />
        </div>

        {/* E. Monthly Performance Table */}
        <SectionHeader title="E. Monthly Performance — Full History" />
        <MonthlyTable />

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-slate-800 text-xs text-slate-600 text-center">
          Spring Hill Suites by Marriott — Lakeland, FL · Lakeland Hospitality Group · Confidential ·
          Generated by Anderson · {meta.generatedAt}
        </div>
      </div>
    </div>
  );
}
