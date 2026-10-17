import React from "react";

export function FootballIcon({
  className = "w-4 h-4",
  strokeWidth = 2,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <g transform="translate(12 12) rotate(-38) scale(1.2) translate(-12 -12)">
        {/* Prolate spheroid pointed football body - widened belly */}
        <path d="M 2.5 12 C 6 4.6, 18 4.6, 21.5 12 C 18 19.4, 6 19.4, 2.5 12 Z" />
        {/* Center lace line */}
        <line x1="8" y1="12" x2="16" y2="12" strokeWidth="1.6" />
        {/* Cross laces */}
        <line x1="9.5" y1="10.2" x2="9.5" y2="13.8" strokeWidth="1.6" />
        <line x1="11.2" y1="10.2" x2="11.2" y2="13.8" strokeWidth="1.6" />
        <line x1="12.8" y1="10.2" x2="12.8" y2="13.8" strokeWidth="1.6" />
        <line x1="14.5" y1="10.2" x2="14.5" y2="13.8" strokeWidth="1.6" />
        {/* Curved tip stripes */}
        <path d="M 6.5 8.2 C 7.6 10.5, 7.6 13.5, 6.5 15.8" strokeWidth="1.5" />
        <path d="M 17.5 8.2 C 16.4 10.5, 16.4 13.5, 17.5 15.8" strokeWidth="1.5" />
      </g>
    </svg>
  );
}
