"use client";

import React from "react";
import { usePathname } from "next/navigation";

export function SiteFooter() {
  const pathname = usePathname();

  // On active league pages, mobile navigation tabs sit fixed at the bottom.
  // Add extra bottom padding so the footer content is never hidden behind navigation.
  const isLeaguePage = pathname?.startsWith("/league/");

  return (
    <footer
      className={`border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 text-slate-500 dark:text-slate-400 text-xs transition-colors mt-auto ${
        isLeaguePage ? "pb-16 md:pb-4 pt-3" : "py-3.5"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-center text-center">
        {/* Branding & Copyright */}
        <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 text-slate-500 dark:text-slate-400">
          <span>&copy; {new Date().getFullYear()} PocketPicks. All rights reserved.</span>
          <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>
          <span className="text-[11px] sm:text-xs">NFL Pick&apos;em &amp; Survivor Pool Platform</span>
        </div>
      </div>
    </footer>
  );
}
