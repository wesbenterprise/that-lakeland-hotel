"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMonthlyData } from "@/lib/hooks";

/** Redirects /month to the latest available period */
export default function MonthIndexPage() {
  const router = useRouter();
  const { data, loading } = useMonthlyData();

  useEffect(() => {
    if (!loading && data.length > 0) {
      const latest = data[data.length - 1];
      router.replace(`/month/${latest.year}-${String(latest.month).padStart(2, "0")}`);
    }
  }, [data, loading, router]);

  return (
    <div className="flex items-center justify-center h-64 text-slate-400 animate-pulse">
      Loading...
    </div>
  );
}
