"use client";

import { useState, useCallback, useRef } from "react";
import { MonthlyPeriod } from "@/lib/types";
import { formatCurrency, formatPct, fullMonthName } from "@/lib/utils";
import { Upload, FileSpreadsheet, Check, AlertCircle, Loader2 } from "lucide-react";

type Stage = "idle" | "parsing" | "preview" | "uploading" | "done" | "error";

export default function UploadPage() {
  const [stage, setStage] = useState<Stage>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Partial<MonthlyPeriod> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setStage("parsing");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", f);

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || "Parse failed");

      setPreview(json.data);
      setStage("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStage("error");
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith(".xlsx") || f.name.endsWith(".xls"))) {
      handleFile(f);
    } else {
      setError("Please upload an .xlsx or .xls file");
      setStage("error");
    }
  }, [handleFile]);

  const handleConfirm = useCallback(async () => {
    if (!file || !preview) return;
    setStage("uploading");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("confirm", "true");

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || "Upload failed");
      setStage("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setStage("error");
    }
  }, [file, preview]);

  const reset = () => {
    setStage("idle");
    setFile(null);
    setPreview(null);
    setError(null);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold">Upload Financial Statement</h1>
      <p className="text-sm text-slate-400">
        Upload a McKibbon income statement XLSX file. The parser will extract period data and show a preview before saving.
      </p>

      {/* Drop Zone */}
      {(stage === "idle" || stage === "error") && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors
            ${dragOver ? "border-emerald-500 bg-emerald-500/10" : "border-slate-600 hover:border-slate-500 bg-slate-800"}
          `}
        >
          <Upload className="h-10 w-10 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-300 font-medium">Drop XLSX file here or click to browse</p>
          <p className="text-xs text-slate-500 mt-1">McKibbon Income Statement format</p>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </div>
      )}

      {/* Parsing spinner */}
      {stage === "parsing" && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500 mx-auto mb-3" />
          <p className="text-slate-300">Parsing {file?.name}...</p>
        </div>
      )}

      {/* Error */}
      {stage === "error" && error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-red-300 font-medium">Error</p>
            <p className="text-red-400 text-sm mt-1">{error}</p>
            <button onClick={reset} className="text-sm text-emerald-400 hover:underline mt-2">Try again</button>
          </div>
        </div>
      )}

      {/* Preview */}
      {stage === "preview" && preview && (
        <div className="space-y-4">
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <div className="flex items-center gap-3 mb-4">
              <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
              <div>
                <p className="text-slate-200 font-medium">{file?.name}</p>
                <p className="text-sm text-slate-400">
                  Period: {preview.month && preview.year ? `${fullMonthName(preview.month)} ${preview.year}` : "Unknown"}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-xs text-slate-400">
                    <th className="px-3 py-2 text-left">Field</th>
                    <th className="px-3 py-2 text-right">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: "Occupancy", value: formatPct(preview.occupancy_pct ?? null) },
                    { label: "ADR", value: formatCurrency(preview.adr ?? null) },
                    { label: "RevPAR", value: formatCurrency(preview.revpar ?? null) },
                    { label: "Room Revenue", value: formatCurrency(preview.room_revenue ?? null) },
                    { label: "F&B Revenue", value: formatCurrency(preview.fb_revenue ?? null) },
                    { label: "Total Revenue", value: formatCurrency(preview.total_revenue ?? null) },
                    { label: "GOP", value: formatCurrency(preview.gross_operating_profit ?? null) },
                    { label: "GOP %", value: formatPct(preview.gop_pct ?? null) },
                    { label: "NOP Hotel", value: formatCurrency(preview.nop_hotel ?? null) },
                    { label: "NOP %", value: formatPct(preview.nop_pct ?? null) },
                  ].map((row) => (
                    <tr key={row.label} className="border-t border-slate-700/30">
                      <td className="px-3 py-1.5 text-slate-300">{row.label}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleConfirm}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm font-medium transition-colors"
            >
              Confirm & Save
            </button>
            <button
              onClick={reset}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Uploading */}
      {stage === "uploading" && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500 mx-auto mb-3" />
          <p className="text-slate-300">Saving to database...</p>
        </div>
      )}

      {/* Done */}
      {stage === "done" && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-6 text-center">
          <Check className="h-8 w-8 text-emerald-400 mx-auto mb-3" />
          <p className="text-emerald-300 font-medium">Data uploaded successfully!</p>
          <p className="text-sm text-emerald-400/70 mt-1">
            {preview?.month && preview?.year ? `${fullMonthName(preview.month)} ${preview.year}` : "Period"} has been loaded.
          </p>
          <button onClick={reset} className="mt-4 text-sm text-emerald-400 hover:underline">Upload another</button>
        </div>
      )}
    </div>
  );
}
