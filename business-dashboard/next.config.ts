import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `postgres` (porsager) uses Node-native net/tls sockets. Next bundles Server
  // Component dependencies by default, which breaks those; `pg` is on Next's
  // built-in opt-out list but `postgres` is not, so it has to be named here.
  serverExternalPackages: ["postgres"],
};

export default nextConfig;
