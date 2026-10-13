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
        isLeaguePage ? "pb-20 md:pb-4 pt-3.5" : "py-4"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
        {/* Branding & Copyright */}
        <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 text-slate-500 dark:text-slate-400">
          <span>&copy; {new Date().getFullYear()} PocketPicks. All rights reserved.</span>
          <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>
          <span className="text-[11px] sm:text-xs">NFL Pick&apos;em &amp; Survivor Pool Platform</span>
        </div>

        {/* Social Media Links */}
        <div className="flex items-center gap-4">
          <a
            href="https://x.com/pocketpicksapp"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors group"
            title="Follow PocketPicks on X"
            aria-label="PocketPicks on X"
          >
            <svg
              className="w-3.5 h-3.5 fill-current transition-transform group-hover:scale-110"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <span className="font-semibold text-xs">@pocketpicksapp</span>
          </a>

          <span className="text-slate-300 dark:text-slate-700">•</span>

          <a
            href="https://www.instagram.com/pocketpicksapp/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-slate-500 hover:text-pink-600 dark:text-slate-400 dark:hover:text-pink-400 transition-colors group"
            title="Follow PocketPicks on Instagram"
            aria-label="PocketPicks on Instagram"
          >
            <svg
              className="w-3.5 h-3.5 fill-none stroke-current stroke-2 transition-transform group-hover:scale-110"
              viewBox="0 0 24 24"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
              <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
            </svg>
            <span className="font-semibold text-xs">Instagram</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
