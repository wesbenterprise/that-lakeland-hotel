"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, isDemoMode } from "./supabase";
import { MonthlyPeriod } from "./types";
import { relativeTime } from "./utils";

// Demo data for when Supabase isn't connected
const DEMO_DATA: MonthlyPeriod[] = generateDemoData();

function generateDemoData(): MonthlyPeriod[] {
  const data: MonthlyPeriod[] = [];
  const baseRoomRev = 500000_00; // $500K in cents
  const months = 24;
  
  for (let i = 0; i < months; i++) {
    const date = new Date(2024, i, 1);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    
    // Seasonal variation
    const seasonFactor = 1 + 0.15 * Math.sin((month - 3) * Math.PI / 6);
    const growthFactor = 1 + (i * 0.005);
    
    const roomRev = Math.round(baseRoomRev * seasonFactor * growthFactor);
    const fbRev = Math.round(roomRev * 0.08);
    const otherRev = Math.round(roomRev * 0.02);
    const miscIncome = Math.round(roomRev * 0.015);
    const totalRev = roomRev + fbRev + otherRev + miscIncome;
    
    const roomsAvail = month === 2 ? (year % 4 === 0 ? 3654 : 3528) : [3906, 3528, 3906, 3780, 3906, 3780, 3906, 3906, 3780, 3906, 3780, 3906][month - 1];
    const occupancy = 0.70 + 0.12 * Math.sin((month - 3) * Math.PI / 6) + Math.random() * 0.05;
    const roomsSold = Math.round(roomsAvail * occupancy);
    const adr = Math.round(roomRev / roomsSold);
    const revpar = Math.round(roomRev / roomsAvail);
    
    const roomsExp = Math.round(roomRev * 0.18);
    const fbExp = Math.round(fbRev * 0.35);
    const otherOpExp = Math.round(otherRev * 0.4);
    
    const adminGen = Math.round(totalRev * 0.13);
    const salesMktg = Math.round(totalRev * 0.10);
    const propOps = Math.round(totalRev * 0.035);
    const utilities = Math.round(totalRev * 0.025);
    const itTelecom = Math.round(totalRev * 0.008);
    
    const deptExpenses = roomsExp + fbExp + otherOpExp;
    const undistributed = adminGen + salesMktg + propOps + utilities + itTelecom;
    const gop = totalRev - deptExpenses - undistributed;
    const gopPct = gop / totalRev;
    
    const mgmtFees = Math.round(totalRev * 0.03);
    const propTaxes = Math.round(totalRev * 0.04);
    const insurance = Math.round(totalRev * 0.015);
    const reserve = Math.round(totalRev * 0.04);
    
    const nop = gop - mgmtFees - propTaxes - insurance - reserve;
    const nopPct = nop / totalRev;
    
    // Budget = actual * 1.02 (slightly optimistic)
    const budgetFactor = 1.02;
    
    data.push({
      period: `${year}-${String(month).padStart(2, "0")}-01`,
      year,
      month,
      rooms_available: roomsAvail,
      rooms_sold: roomsSold,
      occupancy_pct: Math.round(occupancy * 10000) / 10000,
      adr,
      revpar,
      room_revenue: roomRev,
      fb_revenue: fbRev,
      other_operated_revenue: otherRev,
      misc_income: miscIncome,
      total_revenue: totalRev,
      rooms_expense: roomsExp,
      fb_expense: fbExp,
      other_operated_expense: otherOpExp,
      admin_general: adminGen,
      sales_marketing: salesMktg,
      property_ops_maintenance: propOps,
      utilities,
      it_telecom: itTelecom,
      gross_operating_profit: gop,
      gop_pct: Math.round(gopPct * 10000) / 10000,
      management_fees: mgmtFees,
      property_taxes: propTaxes,
      insurance,
      reserve_for_replacement: reserve,
      nop_hotel: nop,
      nop_pct: Math.round(nopPct * 10000) / 10000,
      // Budget
      room_revenue_budget: Math.round(roomRev * budgetFactor),
      fb_revenue_budget: Math.round(fbRev * budgetFactor),
      total_revenue_budget: Math.round(totalRev * budgetFactor),
      rooms_expense_budget: Math.round(roomsExp * 0.98),
      fb_expense_budget: Math.round(fbExp * 0.98),
      admin_general_budget: Math.round(adminGen * 0.98),
      sales_marketing_budget: Math.round(salesMktg * 0.98),
      property_ops_maintenance_budget: Math.round(propOps * 0.98),
      utilities_budget: Math.round(utilities * 0.98),
      gop_budget: Math.round(gop * budgetFactor),
      gop_pct_budget: Math.round(gopPct * budgetFactor * 10000) / 10000,
      nop_hotel_budget: Math.round(nop * budgetFactor),
      nop_pct_budget: Math.round(nopPct * budgetFactor * 10000) / 10000,
      occupancy_pct_budget: Math.round(occupancy * budgetFactor * 10000) / 10000,
      adr_budget: Math.round(adr * budgetFactor),
      revpar_budget: Math.round(revpar * budgetFactor),
      // PY
      room_revenue_py: Math.round(roomRev * 0.94),
      fb_revenue_py: Math.round(fbRev * 0.94),
      total_revenue_py: Math.round(totalRev * 0.94),
      gop_py: Math.round(gop * 0.92),
      gop_pct_py: Math.round(gopPct * 0.98 * 10000) / 10000,
      nop_hotel_py: Math.round(nop * 0.90),
      nop_pct_py: Math.round(nopPct * 0.97 * 10000) / 10000,
      occupancy_pct_py: Math.round(occupancy * 0.96 * 10000) / 10000,
      adr_py: Math.round(adr * 0.95),
      revpar_py: Math.round(revpar * 0.93),
      // YTD
      total_revenue_ytd: Math.round(totalRev * month * 0.95),
      room_revenue_ytd: Math.round(roomRev * month * 0.95),
      gop_ytd: Math.round(gop * month * 0.95),
      gop_pct_ytd: Math.round(gopPct * 10000) / 10000,
      nop_hotel_ytd: Math.round(nop * month * 0.95),
      nop_pct_ytd: Math.round(nopPct * 10000) / 10000,
      total_revenue_ytd_budget: Math.round(totalRev * budgetFactor * month),
      gop_ytd_budget: Math.round(gop * budgetFactor * month),
      nop_hotel_ytd_budget: Math.round(nop * budgetFactor * month),
      source_file: `demo-${year}-${String(month).padStart(2, "0")}.pdf`,
    });
  }
  return data;
}

export function useMonthlyData() {
  const [data, setData] = useState<MonthlyPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Always fetch via API route (uses service role key, bypasses RLS)
        const res = await fetch("/api/periods");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        if (json.demo || !json.data || json.data.length === 0) {
          // No live data — use demo
          setData(DEMO_DATA);
        } else {
          setData(json.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch data");
        setData(DEMO_DATA);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return { data, loading, error };
}

export function useLatestPeriod() {
  const { data, loading, error } = useMonthlyData();
  const latest = data.length > 0 ? data[data.length - 1] : null;
  return { latest, allPeriods: data, loading, error };
}

export function useLastUpdated(): string | null {
  const { data } = useMonthlyData();
  if (data.length === 0) return null;
  const latest = data[data.length - 1];
  const periodDate = new Date(latest.period + "T00:00:00");
  return relativeTime(periodDate);
}
