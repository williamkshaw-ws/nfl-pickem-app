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
      {/* Dynamic angled football with speed trails and laces */}
      <path d="M 3.8 17.2 L 6.8 13.8 C 6.5 11.8, 8.2 6.8, 14.5 4.2 C 17.5 3.0, 19.8 4.2, 20.2 4.6 C 20.6 5.0, 21.8 7.3, 20.6 10.3 C 18.0 16.6, 13.0 18.3, 11.0 18.0 L 7.6 21.0" />
      {/* Middle speed trail */}
      <line x1="5.2" y1="19.8" x2="7.8" y2="16.8" />
      {/* 3 Laces */}
      <line
        x1="12.2"
        y1="8.0"
        x2="15.2"
        y2="11.0"
        strokeWidth={typeof strokeWidth === "number" ? strokeWidth * 0.9 : strokeWidth}
      />
      <line
        x1="10.4"
        y1="9.8"
        x2="13.4"
        y2="12.8"
        strokeWidth={typeof strokeWidth === "number" ? strokeWidth * 0.9 : strokeWidth}
      />
      <line
        x1="8.6"
        y1="11.6"
        x2="11.6"
        y2="14.6"
        strokeWidth={typeof strokeWidth === "number" ? strokeWidth * 0.9 : strokeWidth}
      />
    </svg>
  );
}
