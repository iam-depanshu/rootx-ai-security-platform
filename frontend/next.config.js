/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    turbo: {
      root: "./",
    },
  },
  async rewrites() {
    return [
      {
        source: "/socket.io/:path*",
        destination: "http://localhost:4000/socket.io/:path*",
      },
      {
        source: "/api/attacks",
        destination: "http://localhost:4000/api/attacks",
      },
    ];
  },
};

module.exports = nextConfig;