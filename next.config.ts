import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Let phones reach the dev server through an HTTPS tunnel (camera and GPS
  // need HTTPS). See README "Testing on real phones".
  allowedDevOrigins: ["*.trycloudflare.com", "*.ngrok-free.app", "*.ngrok.app", "*.loca.lt"],
};

export default nextConfig;
