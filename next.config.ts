import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the development "N" badge in the bottom-left corner
  devIndicators: false,

  // Allow local network IP access in development
  allowedDevOrigins: [
    "192.168.1.4",
    "192.168.1.4:3000",
    "localhost:3000",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "a.espncdn.com",
      },
      {
        protocol: "https",
        hostname: "static.www.nfl.com",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/dashboard",
        destination: "/",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

