import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    serverActions: {
      // Three CNIC images at the API's 5 MB ceiling, plus multipart overhead
      // (FR-CUS-04-v2). The default 1 MB would reject a single photo.
      bodySizeLimit: "16mb",
    },
  },
};

export default nextConfig;
