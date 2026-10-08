"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

export function SiteFooter() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  // On active league pages, mobile navigation tabs sit fixed at the bottom.
  // Add extra bottom padding so the footer content is never hidden behind navigation.
  const isLeaguePage = pathname?.startsWith("/league/");

  return (
    <footer
      className={`border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 text-slate-500 dark:text-slate-400 text-xs transition-colors mt-auto ${
        isLeaguePage ? "pb-20 md:pb-6 pt-4" : "py-5"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
        {/* Left: Branding & Copyright */}
        <div className="flex items-center gap-2 text-center sm:text-left text-slate-500 dark:text-slate-400">
          <span>&copy; {new Date().getFullYear()} PocketPicks. All rights reserved.</span>
          <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>
          <span className="hidden sm:inline">NFL Pick&apos;em &amp; Survivor Pool Platform</span>
        </div>

        {/* Right: Theme Switcher */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400 font-medium">Theme:</span>
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setTheme("light")}
              title="Light mode"
              className={`p-1 rounded-md transition-all ${
                theme === "light"
                  ? "bg-white text-amber-500 shadow-xs"
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setTheme("dark")}
              title="Dark mode"
              className={`p-1 rounded-md transition-all ${
                theme === "dark"
                  ? "bg-slate-700 text-emerald-400 shadow-xs"
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setTheme("system")}
              title="System theme"
              className={`p-1 rounded-md transition-all ${
                theme === "system"
                  ? "bg-white dark:bg-slate-700 text-blue-500 shadow-xs"
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
