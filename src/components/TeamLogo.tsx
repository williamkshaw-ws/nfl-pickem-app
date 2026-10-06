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

export function TeamLogo({
  src,
  alt,
  width = 24,
  height = 24,
  className = "object-contain shrink-0",
}: TeamLogoProps) {
  const getInitialSrc = () => {
    if (src && src.trim() !== "") return src;
    if (alt) {
      return `https://a.espncdn.com/i/teamlogos/nfl/500/${alt.toLowerCase().slice(0, 3)}.png`;
    }
    return "";
  };

  const [imgSrc, setImgSrc] = useState<string>(getInitialSrc());
  const [hasError, setHasError] = useState<boolean>(false);

  useEffect(() => {
    setImgSrc(getInitialSrc());
    setHasError(false);
  }, [src, alt]);

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
      className={className}
      onError={() => {
        if (imgSrc.includes("/scoreboard/")) {
          setImgSrc(imgSrc.replace("/scoreboard/", "/"));
        } else {
          setHasError(true);
        }
      }}
      unoptimized
    />
  );
}
