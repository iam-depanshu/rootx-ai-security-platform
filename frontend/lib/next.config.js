/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    turbo: {
      root: "./",  // ← add this
    },
  },
  async rewrites() {
    return [
      {
        source: "/socket.io/:path*",
        destination: "http://localhost:4000/socket.io/:path*",
      },
      {
        source: "/api/scan",
        destination: "http://localhost:4000/api/scan",
      },
      {
        source: "/api/attacks",
        destination: "http://localhost:4000/api/attacks",
      },
      {
        source: "/api/stats",
        destination: "http://localhost:4000/api/stats",
      },
    ];
  },
};

module.exports = nextConfig;