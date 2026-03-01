/** @type {import('next').NextConfig} */
const nextConfig = {

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "assets.zyrosite.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
      {
        protocol: "https",
        hostname: "images.realestate.com.kh",
      },
      {
        protocol: "https",
        hostname: "www.realestate.com.kh",
      },
    ],
  },

  async redirects() {
    return [
      {
        source: "/south-africans-moving-to-cambodia-2025",
        destination: "/south-africans-moving-to-cambodia-2026",
        permanent: true,
      },
      {
        source: "/teaching-job-in-cambodia-2025",
        destination: "/teaching-job-in-cambodia-2026",
        permanent: true,
      },
      {
        source: "/cambodia-vs-usa-uk-south-africa-disposable-income-2025",
        destination: "/cambodia-vs-usa-uk-south-africa-disposable-income-2026",
        permanent: true,
      },
      {
        source: "/what-to-pack-for-teaching-english-in-cambodia-2025",
        destination: "/what-to-pack-for-teaching-english-in-cambodia-2026",
        permanent: true,
      },
    ];
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://vercel.live",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
              "img-src 'self' data: blob: https://assets.zyrosite.com https://images.unsplash.com https://*.public.blob.vercel-storage.com https://www.google-analytics.com https://lh3.googleusercontent.com https://*.basemaps.cartocdn.com https://images.realestate.com.kh https://www.realestate.com.kh",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://vercel.live https://*.tile.openstreetmap.org",
              "frame-src 'self' https://www.youtube.com https://vercel.live",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};
module.exports = nextConfig;
