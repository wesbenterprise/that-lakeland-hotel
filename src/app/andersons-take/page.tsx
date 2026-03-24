"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  Legend,
  Cell,
} from "recharts";
import { AlertTriangle, TrendingDown, TrendingUp, Shield, Clock, BarChart2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Static data (sourced from SHS financial records) ─────────────────────────

const ANNUAL = [
  { year: "2023", rev: 6_971_203, nop: 1_878_518, dscr: 1.94, margin: 26.9 },
  { year: "2024", rev: 7_069_412, nop: 1_828_581, dscr: 1.89, margin: 25.9 },
  { year: "2025", rev: 6_884_571, nop: 1_640_281, dscr: 1.69, margin: 23.8 },
];

const MONTHLY_YOY = [
  { month: "Jan", rev24: 559_126, rev25: 622_738, nop24: 50_491,  nop25: 116_589 },
  { month: "Feb", rev24: 703_287, rev25: 751_384, nop24: 256_709, nop25: 317_523 },
  { month: "Mar", rev24: 725_257, rev25: 846_744, nop24: 280_200, nop25: 354_299 },
  { month: "Apr", rev24: 841_632, rev25: 748_151, nop24: 361_683, nop25: 276_035 },
  { month: "May", rev24: 548_849, rev25: 620_932, nop24: 128_261, nop25: 158_923 },
  { month: "Jun", rev24: 572_662, rev25: 510_305, nop24: 150_339, nop25:  24_272 },
  { month: "Jul", rev24: 416_212, rev25: 396_685, nop24:  27_570, nop25:   7_702 },
  { month: "Aug", rev24: 436_349, rev25: 489_670, nop24:  35_647, nop25:  49_190 },
  { month: "Sep", rev24: 489_491, rev25: 404_814, nop24:  92_595, nop25:     480 },
  { month: "Oct", rev24: 671_170, rev25: 545_593, nop24: 222_852, nop25:  81_469 },
  { month: "Nov", rev24: 542_839, rev25: 532_780, nop24: 141_312, nop25: 158_820 },
  { month: "Dec", rev24: 562_538, rev25: 414_775, nop24:  80_922, nop25:  94_979 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt$(n: number) {
  if (Math.abs(n) >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
  if (Math.abs(n) >= 1_000) return "$" + (n / 1_000).toFixed(0) + "K";
  return "$" + n.toFixed(0);
}

function fmtPct(n: number, decimals = 1) {
  return (n >= 0 ? "+" : "") + n.toFixed(decimals) + "%";
}

function deltaClass(v: number) {
  return v >= 0 ? "text-emerald-400" : "text-red-400";
}

// ─── DSCR Trend Chart ─────────────────────────────────────────────────────────

const DSCR_COLORS = ["#22c55e", "#f59e0b", "#f59e0b"]; // green for 2023, amber for 2024/2025

function DSCRChart() {
  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">DSCR Trend</h3>
          <p className="text-xs text-slate-400 mt-0.5">Debt Service Coverage Ratio · 2023–2025</p>
        </div>
        <span className="text-xs bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded px-2 py-0.5">
          Most Important
        </span>
      </div>

      {/* Trend summary */}
      <div className="flex items-center gap-4 mb-4 mt-3">
        {ANNUAL.map((d, i) => (
          <div key={d.year} className="flex items-center gap-1.5">
            <span
              className={cn(
                "text-xl font-bold",
                d.dscr >= 2.0
                  ? "text-emerald-400"
                  : d.dscr >= 1.5
                  ? "text-amber-400"
                  : "text-red-400"
              )}
            >
              {d.dscr.toFixed(2)}×
            </span>
            <span className="text-xs text-slate-500">{d.year}</span>
            {i < ANNUAL.length - 1 && (
              <TrendingDown className="h-3.5 w-3.5 text-slate-600 mx-0.5" />
            )}
          </div>
        ))}
      </div>

      <div className="h-52 lg:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={ANNUAL}
            margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="year" stroke="#64748b" fontSize={11} />
            <YAxis
              domain={[0, 2.5]}
              stroke="#64748b"
              fontSize={11}
              tickFormatter={(v) => v.toFixed(1) + "×"}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1e293b",
                border: "1px solid #334155",
                borderRadius: "8px",
                color: "#e2e8f0",
              }}
              formatter={(v: number) => [v.toFixed(2) + "×", "DSCR"]}
            />
            {/* 1.25× threshold — amber */}
            <ReferenceLine
              y={1.25}
              stroke="#f59e0b"
              strokeDasharray="5 4"
              strokeWidth={1.5}
              label={{
                value: "1.25× lender threshold",
                position: "insideTopRight",
                fill: "#f59e0b",
                fontSize: 10,
              }}
            />
            {/* 1.0× minimum — red */}
            <ReferenceLine
              y={1.0}
              stroke="#ef4444"
              strokeDasharray="5 4"
              strokeWidth={1.5}
              label={{
                value: "1.0× minimum",
                position: "insideTopRight",
                fill: "#ef4444",
                fontSize: 10,
              }}
            />
            <Bar dataKey="dscr" radius={[4, 4, 0, 0]} maxBarSize={72}>
              {ANNUAL.map((d, i) => (
                <Cell
                  key={d.year}
                  fill={DSCR_COLORS[i] + "55"}
                  stroke={DSCR_COLORS[i]}
                  strokeWidth={2}
                />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-slate-500 mt-2">
        Still comfortably above both thresholds. But the 3-year directional trend is unambiguous.
      </p>
    </div>
  );
}

// ─── 2026 Early Signal Card ───────────────────────────────────────────────────

function EarlySignalCard() {
  const jan25rev = 622_738;
  const feb25rev = 751_384;
  const jan25nop = 116_589;
  const feb25nop = 317_523;
  const base25rev = jan25rev + feb25rev;
  const base25nop = jan25nop + feb25nop;
  const rev26 = 1_389_498;
  const nop26 = 505_672;
  const revDelta = ((rev26 - base25rev) / base25rev) * 100;
  const nopDelta = ((nop26 - base25nop) / base25nop) * 100;

  return (
    <div className="bg-slate-800 rounded-lg border border-amber-500/30 p-5 relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(135deg, rgba(245,158,11,0.07) 0%, transparent 60%)",
        }}
      />
      <div className="relative">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-amber-400">
            2026 Early Signal — Jan–Feb YoY
          </h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-slate-500 mb-1">2026 Revenue</p>
            <p className="text-xl font-bold text-slate-100">{fmt$(rev26)}</p>
            <p className={cn("text-xs font-semibold mt-0.5", deltaClass(revDelta))}>
              {fmtPct(revDelta)} YoY
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">2026 NOP</p>
            <p className="text-xl font-bold text-amber-400">{fmt$(nop26)}</p>
            <p className="text-xs font-semibold text-emerald-400 mt-0.5">
              +16.5% YoY
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Occupancy</p>
            <p className="text-xl font-bold text-amber-400">86%</p>
            <p className="text-xs text-slate-500 mt-0.5">Jan–Feb avg</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">ADR</p>
            <p className="text-xl font-bold text-amber-400">$192</p>
            <p className="text-xs text-slate-500 mt-0.5">Jan–Feb avg</p>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-3 leading-relaxed">
          Two months of data isn&apos;t a trend — but the direction is right. If this holds through Q2 2026,
          the DSCR story materially improves before the refi window opens.
        </p>
      </div>
    </div>
  );
}

// ─── Monthly YoY Table ────────────────────────────────────────────────────────

function MonthlyYoYTable() {
  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-700">
        <h3 className="text-sm font-semibold text-slate-100">Monthly YoY — 2024 vs 2025</h3>
        <p className="text-xs text-slate-400 mt-0.5">Revenue and NOP delta by month · Year-over-year only</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-900/40">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Month</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">2024 Rev</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">2025 Rev</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Rev Δ%</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">2024 NOP</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">2025 NOP</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">NOP Δ%</th>
            </tr>
          </thead>
          <tbody>
            {MONTHLY_YOY.map((row) => {
              const revDelta = ((row.rev25 - row.rev24) / row.rev24) * 100;
              const nopDelta =
                row.nop24 !== 0
                  ? ((row.nop25 - row.nop24) / Math.abs(row.nop24)) * 100
                  : null;
              return (
                <tr
                  key={row.month}
                  className="border-b border-slate-700/50 last:border-0 hover:bg-slate-700/20 transition-colors"
                >
                  <td className="px-4 py-2.5 text-slate-300 font-medium">{row.month}</td>
                  <td className="px-4 py-2.5 text-right text-slate-400">{fmt$(row.rev24)}</td>
                  <td className="px-4 py-2.5 text-right text-slate-200">{fmt$(row.rev25)}</td>
                  <td className={cn("px-4 py-2.5 text-right font-semibold", deltaClass(revDelta))}>
                    {fmtPct(revDelta)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-400">{fmt$(row.nop24)}</td>
                  <td className="px-4 py-2.5 text-right text-slate-200">{fmt$(row.nop25)}</td>
                  <td className={cn("px-4 py-2.5 text-right font-semibold", nopDelta !== null ? deltaClass(nopDelta) : "text-slate-500")}>
                    {nopDelta !== null ? fmtPct(nopDelta) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-900/40 border-t border-slate-600">
              {(() => {
                const totRev24 = MONTHLY_YOY.reduce((s, r) => s + r.rev24, 0);
                const totRev25 = MONTHLY_YOY.reduce((s, r) => s + r.rev25, 0);
                const totNop24 = MONTHLY_YOY.reduce((s, r) => s + r.nop24, 0);
                const totNop25 = MONTHLY_YOY.reduce((s, r) => s + r.nop25, 0);
                const revD = ((totRev25 - totRev24) / totRev24) * 100;
                const nopD = ((totNop25 - totNop24) / totNop24) * 100;
                return (
                  <>
                    <td className="px-4 py-2.5 text-xs font-bold text-slate-300 uppercase">Full Year</td>
                    <td className="px-4 py-2.5 text-right text-xs font-bold text-slate-300">{fmt$(totRev24)}</td>
                    <td className="px-4 py-2.5 text-right text-xs font-bold text-slate-300">{fmt$(totRev25)}</td>
                    <td className={cn("px-4 py-2.5 text-right text-xs font-bold", deltaClass(revD))}>{fmtPct(revD)}</td>
                    <td className="px-4 py-2.5 text-right text-xs font-bold text-slate-300">{fmt$(totNop24)}</td>
                    <td className="px-4 py-2.5 text-right text-xs font-bold text-slate-300">{fmt$(totNop25)}</td>
                    <td className={cn("px-4 py-2.5 text-right text-xs font-bold", deltaClass(nopD))}>{fmtPct(nopD)}</td>
                  </>
                );
              })()}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── Revenue + NOP Annual Chart ───────────────────────────────────────────────

function AnnualChart() {
  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
      <h3 className="text-sm font-semibold text-slate-100 mb-1">Revenue & NOP — Annual</h3>
      <p className="text-xs text-slate-400 mb-4">Year-over-year comparison · 2023–2025</p>
      <div className="h-52 lg:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={ANNUAL}
            margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="year" stroke="#64748b" fontSize={11} />
            <YAxis
              stroke="#64748b"
              fontSize={11}
              tickFormatter={(v) =>
                v >= 1_000_000 ? "$" + (v / 1_000_000).toFixed(1) + "M" : "$" + (v / 1_000).toFixed(0) + "K"
              }
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1e293b",
                border: "1px solid #334155",
                borderRadius: "8px",
                color: "#e2e8f0",
              }}
              formatter={(v: number, name: string) => [fmt$(v), name]}
            />
            <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
            <Bar dataKey="rev" name="Total Revenue" fill="rgba(245,158,11,0.25)" stroke="#f59e0b" strokeWidth={2} radius={[4,4,0,0]} maxBarSize={72} />
            <Bar dataKey="nop" name="Net Operating Profit" fill="rgba(34,197,94,0.25)" stroke="#22c55e" strokeWidth={2} radius={[4,4,0,0]} maxBarSize={72} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── NOP Margin Chart ─────────────────────────────────────────────────────────

function MarginChart() {
  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
      <h3 className="text-sm font-semibold text-slate-100 mb-1">NOP Margin Compression</h3>
      <p className="text-xs text-slate-400 mb-4">Net operating profit as % of revenue · 2023–2025</p>
      <div className="h-52 lg:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={ANNUAL}
            margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="year" stroke="#64748b" fontSize={11} />
            <YAxis
              domain={[15, 35]}
              stroke="#64748b"
              fontSize={11}
              tickFormatter={(v) => v + "%"}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1e293b",
                border: "1px solid #334155",
                borderRadius: "8px",
                color: "#e2e8f0",
              }}
              formatter={(v: number) => [v.toFixed(1) + "%", "NOP Margin"]}
            />
            <Line
              type="monotone"
              dataKey="margin"
              name="NOP Margin"
              stroke="#f59e0b"
              strokeWidth={2.5}
              dot={{ r: 5, fill: "#f59e0b" }}
              activeDot={{ r: 7 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-slate-500 mt-2">
        26.9% → 25.9% → 23.8%. Three years of steady compression even as RevPAR held.
      </p>
    </div>
  );
}

// ─── Anderson Insight Cards ───────────────────────────────────────────────────

const INSIGHTS = [
  {
    icon: TrendingDown,
    iconColor: "text-amber-400",
    borderColor: "border-amber-500/30",
    bgGlow: "from-amber-500/5",
    badge: "DSCR Trajectory",
    badgeColor: "bg-amber-500/10 border-amber-500/30 text-amber-400",
    title: "Still healthy — but the slope matters",
    body: "DSCR has declined every year: 1.94× → 1.89× → 1.69×. The hotel comfortably covers debt service. But the directional trend is unambiguous, and a refi in 2027 with a declining DSCR story is a harder conversation than one with a stable or improving one. The 2026 recovery signal is the most important number to watch.",
  },
  {
    icon: Shield,
    iconColor: "text-emerald-400",
    borderColor: "border-emerald-500/30",
    bgGlow: "from-emerald-500/5",
    badge: "Returns",
    badgeColor: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
    title: "Cash-on-cash 23–27% — exceptional by any benchmark",
    body: "Cash-on-cash returns have run 23–27% over the 2023–2025 window. The sector benchmark for stabilized select-service hotels is 8–12%. This is not a struggling asset — it's a high-performing one. The DSCR story is a trajectory caution, not a distress signal.",
  },
  {
    icon: TrendingUp,
    iconColor: "text-emerald-400",
    borderColor: "border-emerald-500/30",
    bgGlow: "from-emerald-500/5",
    badge: "2026 Signal",
    badgeColor: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
    title: "Early 2026 recovery — NOP up +16.5% YoY",
    body: "Jan–Feb 2026 shows NOP up +16.5% YoY vs the same period in 2025, with occupancy at 86% and ADR at $192. Two months of data isn't a trend — but the direction is right. If Q2 2026 confirms, the DSCR recovery story materially strengthens before the refi window opens.",
  },
  {
    icon: Clock,
    iconColor: "text-amber-400",
    borderColor: "border-amber-500/30",
    bgGlow: "from-amber-500/5",
    badge: "Refi Timing",
    badgeColor: "bg-amber-500/10 border-amber-500/30 text-amber-400",
    title: "Begin lender conversations Q4 2026",
    body: "Loan matures Sep 15, 2027. Refi flag: Feb 1, 2027. Target close: May 2027. The relationship with the bank is good — this isn't a balloon with a hard wall. But lender conversations should begin Q4 2026, with 2026 full-year financials in hand. The stronger those numbers look, the better the refi terms.",
  },
  {
    icon: BarChart2,
    iconColor: "text-sky-400",
    borderColor: "border-sky-500/30",
    bgGlow: "from-sky-500/5",
    badge: "Margin Story",
    badgeColor: "bg-sky-500/10 border-sky-500/30 text-sky-400",
    title: "Revenue held — NOP didn't",
    body: "Revenue declined only 2.6% in 2025 vs 2024. NOP fell 10.3%. The delta is expense creep — costs rising faster than revenue. NOP margin compressed from 25.9% to 23.8% in a single year. This is the operational story McKibbon needs to address. If revenue recovers in 2026 and expense growth moderates, margins recover. If not, DSCR continues to slide.",
  },
];

function InsightCards() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-px flex-1 bg-slate-700" />
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest px-2">Anderson&apos;s Analysis</span>
        <div className="h-px flex-1 bg-slate-700" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {INSIGHTS.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.badge}
              className={cn(
                "bg-slate-800 rounded-lg border p-5 relative overflow-hidden",
                card.borderColor
              )}
            >
              <div
                className={cn(
                  "absolute inset-0 pointer-events-none bg-gradient-to-br to-transparent",
                  card.bgGlow
                )}
              />
              <div className="relative">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Icon className={cn("h-4 w-4 shrink-0", card.iconColor)} />
                    <span
                      className={cn(
                        "text-xs font-semibold border rounded px-2 py-0.5",
                        card.badgeColor
                      )}
                    >
                      {card.badge}
                    </span>
                  </div>
                </div>
                <h4 className="text-sm font-semibold text-slate-100 mb-2">{card.title}</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{card.body}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Refi Alert Banner ────────────────────────────────────────────────────────

function RefiBanner() {
  return (
    <div className="rounded-lg border border-amber-500/40 p-5 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(245,158,11,0.03) 100%)" }}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-start gap-3 flex-1">
          <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-amber-400 mb-1">
              Refinance Window — 18 Months Out
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Loan matures <strong className="text-slate-100">Sep 15, 2027</strong>. Balance:{" "}
              <strong className="text-slate-100">$13,408,631</strong> at 3.25% fixed. Refi flag:{" "}
              <strong className="text-slate-100">Feb 1, 2027</strong>, target close{" "}
              <strong className="text-slate-100">May 2027</strong>. Friendly bank relationship in place —
              this is a maturity, not a balloon. Begin lender conversations{" "}
              <strong className="text-amber-400">Q4 2026</strong> with full-year financials in hand.
            </p>
          </div>
        </div>
        <div className="flex gap-6 shrink-0 pl-8 sm:pl-0">
          <div className="text-center">
            <p className="text-lg font-bold text-amber-400">$13.4M</p>
            <p className="text-xs text-slate-500">Balance</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-amber-400">3.25%</p>
            <p className="text-xs text-slate-500">Fixed Rate</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-amber-400">Sep '27</p>
            <p className="text-xs text-slate-500">Maturity</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AndersonsTakePage() {
  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Anderson&apos;s Take</h1>
        <p className="text-slate-400 text-sm mt-1">
          Analytical view · Spring Hill Suites Lakeland · Data through Feb 2026
        </p>
      </div>

      {/* Refi banner — always first */}
      <RefiBanner />

      {/* DSCR — the most important chart */}
      <DSCRChart />

      {/* 2026 Early Signal */}
      <EarlySignalCard />

      {/* Annual charts side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <AnnualChart />
        <MarginChart />
      </div>

      {/* Monthly YoY Table */}
      <MonthlyYoYTable />

      {/* Anderson's written analysis */}
      <InsightCards />
    </div>
  );
}
