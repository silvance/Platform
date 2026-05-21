/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  // Pick up the workspace root so build traces include the contracts package.
  outputFileTracingRoot: require("path").join(__dirname, "../../"),
};

module.exports = nextConfig;
