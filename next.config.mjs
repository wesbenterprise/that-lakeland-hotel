/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {},
  webpack: (config) => {
    // pdf-parse uses test files we don't need
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
