"use client";

import { useEffect, useState } from "react";
import { MonthlyPeriod, Distribution } from "./types";
import { fullMonthName } from "./utils";

export function useMonthlyData() {
  const [data, setData] = useState<MonthlyPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/periods");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        if (!json.data || json.data.length === 0) {
          setError("No data available. Upload an income statement to get started.");
          setData([]);
        } else {
          setData(json.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch data");
        setData([]);
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

export function useDistributions() {
  const [data, setData] = useState<Distribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/distributions');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (json.data && json.data.length > 0) {
          setData(json.data);
        } else {
          setData([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch distributions");
        setData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return { data, loading, error };
}

/** Returns "Data through {Month} {Year}" for the sidebar footer */
export function useDataThroughLabel(): { label: string | null; isStale: boolean } {
  const { data } = useMonthlyData();
  if (data.length === 0) return { label: null, isStale: false };
  const latest = data[data.length - 1];
  const label = `Data through ${fullMonthName(latest.month)} ${latest.year}`;

  // Stale if latest period is more than 45 days ago
  const periodDate = new Date(latest.year, latest.month - 1, 1);
  const daysSince = (Date.now() - periodDate.getTime()) / (1000 * 60 * 60 * 24);
  const isStale = daysSince > 75; // 75 days ≈ 2.5 months — data should be updated monthly

  return { label, isStale };
}

// Legacy alias (used by Sidebar)
export function useLastUpdated(): string | null {
  const { label } = useDataThroughLabel();
  return label;
}
