import type { NextConfig } from "next";

// Browser calls go to /api/* on this origin and are proxied to FastAPI,
// so no CORS setup is needed and the backend URL stays server-side.
const BACKEND_URL = (process.env.BACKEND_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  devIndicators: false,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` }];
  },
};

export default nextConfig;
