import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  // Permite HMR / RSC desde iPad y otros dispositivos en LAN durante `next dev`.
  // Next hace match picomatch-style: `*` no cruza puntos, así que una IP de
  // 4 octetos necesita wildcards por segmento.
  allowedDevOrigins: [
    "10.*.*.*",
    "172.16.*.*", "172.17.*.*", "172.18.*.*", "172.19.*.*",
    "172.20.*.*", "172.21.*.*", "172.22.*.*", "172.23.*.*",
    "172.24.*.*", "172.25.*.*", "172.26.*.*", "172.27.*.*",
    "172.28.*.*", "172.29.*.*", "172.30.*.*", "172.31.*.*",
    "192.168.*.*",
    "*.local",
  ],
};

export default nextConfig;
