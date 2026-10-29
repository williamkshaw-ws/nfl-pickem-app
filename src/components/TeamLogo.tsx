"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";

interface TeamLogoProps {
  src?: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
}

const NFL_ABBR_MAP: Record<string, string> = {
  ARI: "ARI", ATL: "ATL", BAL: "BAL", BUF: "BUF", CAR: "CAR", CHI: "CHI",
  CIN: "CIN", CLE: "CLE", DAL: "DAL", DEN: "DEN", DET: "DET", GB: "GB",
  HOU: "HOU", IND: "IND", JAX: "JAX", JAC: "JAX", KC: "KC", LV: "LV",
  LVR: "LV", OAK: "LV", LAC: "LAC", SD: "LAC", LAR: "LAR", LA: "LAR",
  STL: "LAR", MIA: "MIA", MIN: "MIN", NE: "NE", NO: "NO", NYG: "NYG",
  NYJ: "NYJ", PHI: "PHI", PIT: "PIT", SF: "SF", SEA: "SEA", TB: "TB",
  TEN: "TEN", WAS: "WAS", WSH: "WAS",
};

const TEAM_KEYWORD_MAP: Record<string, string> = {
  cardinals: "ARI", falcons: "ATL", ravens: "BAL", bills: "BUF",
  panthers: "CAR", bears: "CHI", bengals: "CIN", browns: "CLE",
  cowboys: "DAL", broncos: "DEN", lions: "DET", packers: "GB",
  texans: "HOU", colts: "IND", jaguars: "JAX", chiefs: "KC",
  raiders: "LV", chargers: "LAC", rams: "LAR", dolphins: "MIA",
  vikings: "MIN", patriots: "NE", saints: "NO", giants: "NYG",
  jets: "NYJ", eagles: "PHI", steelers: "PIT", "49ers": "SF",
  niners: "SF", seahawks: "SEA", buccaneers: "TB", bucs: "TB",
  titans: "TEN", commanders: "WAS",
};

export function resolveNflOfficialLogo(alt?: string, src?: string): string {
  const rawAlt = (alt || "").trim().toUpperCase();
  if (rawAlt === "HIDDEN" || rawAlt === "N/A") return "";

  // 1. Direct abbreviation lookup
  let abbr = NFL_ABBR_MAP[rawAlt] || NFL_ABBR_MAP[rawAlt.slice(0, 3)];

  // 2. Keyword lookup in alt string
  if (!abbr && alt) {
    const lower = alt.toLowerCase();
    for (const [key, val] of Object.entries(TEAM_KEYWORD_MAP)) {
      if (lower.includes(key)) {
        abbr = val;
        break;
      }
    }
  }

  // 3. Keyword lookup in src URL if needed
  if (!abbr && src) {
    const lowerSrc = src.toLowerCase();
    for (const [key, val] of Object.entries(NFL_ABBR_MAP)) {
      if (lowerSrc.includes(`/${key.toLowerCase()}.png`) || lowerSrc.includes(`/${key.toLowerCase()}/`)) {
        abbr = val;
        break;
      }
    }
  }

  // 4. Return official NFL.com SVG
  if (abbr) {
    return `https://static.www.nfl.com/image/upload/v1/league/api/clubs/logos/${abbr}.svg`;
  }

  // 5. Fallback to src or ESPN CDN
  if (src && src.trim() !== "") return src;
  if (rawAlt) {
    return `https://a.espncdn.com/i/teamlogos/nfl/500/${rawAlt.toLowerCase().slice(0, 3)}.png`;
  }
  return "";
}

export function TeamLogo({
  src,
  alt,
  width = 24,
  height = 24,
  className = "object-contain shrink-0",
}: TeamLogoProps) {
  const isHidden = !src && (!alt || alt.toLowerCase() === "hidden" || alt.toLowerCase() === "n/a");

  const [imgSrc, setImgSrc] = useState<string>(() => resolveNflOfficialLogo(alt, src));
  const [hasError, setHasError] = useState<boolean>(false);

  useEffect(() => {
    setImgSrc(resolveNflOfficialLogo(alt, src));
    setHasError(false);
  }, [src, alt]);

  if (isHidden) {
    return null;
  }

  if (!imgSrc || hasError) {
    const fallbackLetters = alt ? alt.slice(0, 3).toUpperCase() : "NFL";
    return (
      <span
        style={{ width, height }}
        className={`inline-flex items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-[9px] font-black text-slate-700 dark:text-slate-200 select-none ${className}`}
      >
        {fallbackLetters}
      </span>
    );
  }

  return (
    <Image
      src={imgSrc}
      alt={alt || "NFL Team"}
      width={width}
      height={height}
      className={`dark:drop-shadow-[0_0_1.5px_rgba(255,255,255,0.75)] ${className}`}
      onError={() => {
        const cleanAbbr = (alt || "").trim().toLowerCase().slice(0, 3);
        const espnFallback = `https://a.espncdn.com/i/teamlogos/nfl/500/${cleanAbbr}.png`;
        if (imgSrc !== espnFallback && !imgSrc.includes("espncdn.com")) {
          setImgSrc(espnFallback);
        } else {
          setHasError(true);
        }
      }}
      unoptimized
    />
  );
}
