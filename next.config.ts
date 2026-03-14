import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cards.scryfall.io",
      },
      {
        protocol: "https",
        hostname: "images.ctfassets.net",
      },
    ],
  },
};

export default nextConfig;
