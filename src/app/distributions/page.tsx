"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useDistributions } from "@/lib/hooks";
import { DistributionCalculator } from "@/components/distribution-calculator";
import { DistributionHistory } from "@/components/distribution-history";
import { DistributionROI } from "@/components/distribution-roi";

type Tab = "calculator" | "history" | "roi";

const tabs: { key: Tab; label: string }[] = [
  { key: "calculator", label: "Calculator" },
  { key: "history", label: "History" },
  { key: "roi", label: "ROI" },
];

export default function DistributionsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("calculator");
  const { data, loading } = useDistributions();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-100">Distributions</h2>
      </div>

      {/* Pill Tabs */}
      <div className="bg-slate-800/50 rounded-lg p-1 inline-flex gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "bg-slate-700 text-emerald-400 border border-slate-600"
                : "bg-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "calculator" && <DistributionCalculator />}
      {activeTab === "history" && <DistributionHistory distributions={data} loading={loading} />}
      {activeTab === "roi" && <DistributionROI distributions={data} loading={loading} />}
    </div>
  );
}
