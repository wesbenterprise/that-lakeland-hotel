"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "./auth-provider";
import { useLastUpdated } from "@/lib/hooks";
import {
  BarChart3,
  TrendingUp,
  FileText,
  Upload,
  LogOut,
  Building2,
  Menu,
  X,
  Calendar,
  DollarSign,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Overview", icon: BarChart3 },
  { href: "/trends", label: "Trends", icon: TrendingUp },
  { href: "/month", label: "Month Detail", icon: FileText },
  { href: "/yearly", label: "Yearly", icon: Calendar },
  { href: "/distributions", label: "Distributions", icon: DollarSign },
  { divider: true },
  { href: "/upload", label: "Upload", icon: Upload },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const lastUpdated = useLastUpdated();
  const [isOpen, setIsOpen] = useState(false);

  if (pathname === "/login") return null;

  const close = () => setIsOpen(false);

  return (
    <>
      {/* Mobile top bar — hidden on desktop */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-slate-800 border-b border-slate-700 flex items-center px-4 gap-3">
        <button
          onClick={() => setIsOpen(true)}
          className="text-slate-300 hover:text-slate-100"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Building2 className="h-5 w-5 text-emerald-500" />
        <span className="font-bold text-sm text-slate-100">SHS Lakeland</span>
      </div>

      {/* Overlay backdrop — mobile only, visible when drawer is open */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* Sidebar drawer */}
      <aside
        className={cn(
          // Base: fixed overlay drawer
          "fixed inset-y-0 left-0 z-50 w-60 bg-slate-800 border-r border-slate-700 flex flex-col transition-transform duration-200",
          // Desktop: participate in flex flow, always visible
          "lg:relative lg:translate-x-0",
          // Mobile: slide in/out
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo + close button */}
        <div className="p-4 border-b border-slate-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-emerald-500" />
            <div>
              <h1 className="text-sm font-bold text-slate-100">SHS Lakeland</h1>
              <p className="text-xs text-slate-400">Financial Dashboard</p>
            </div>
          </div>
          <button
            onClick={close}
            className="lg:hidden text-slate-400 hover:text-slate-100 transition-colors"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {navItems.map((item, i) => {
            if ("divider" in item) {
              return <div key={i} className="my-2 border-t border-slate-700" />;
            }
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  isActive
                    ? "bg-slate-700 text-emerald-400 border-l-2 border-emerald-500"
                    : "text-slate-300 hover:bg-slate-700/50 hover:text-slate-100"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 space-y-3 shrink-0">
          {lastUpdated && (
            <p className="text-xs text-slate-500">Last updated {lastUpdated}</p>
          )}
          {user && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 truncate max-w-[140px]">
                {user.email}
              </span>
              <button
                onClick={() => signOut()}
                className="text-slate-500 hover:text-slate-300 transition-colors"
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
