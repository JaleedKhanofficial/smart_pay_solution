import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    serverActions: {
      // Three CNIC images at the API's 10 MB ceiling, plus multipart overhead
      // (FR-CUS-04-v2). The default 1 MB would reject a single photo, and a
      // cap below 3 x 10 MB would reject the save before it reached the API.
      bodySizeLimit: "32mb",
    },
  },
};

export default nextConfig;
