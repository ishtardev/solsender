import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Webpack configuration for fallbacks (used when not using Turbopack)
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
      stream: false,
      url: false,
      zlib: false,
      http: false,
      https: false,
      assert: false,
      os: false,
      path: false,
      'pino-pretty': false,
    };
    
    // Ignore specific modules that cause issues
    config.externals = config.externals || [];
    config.externals.push({
      'pino-pretty': 'pino-pretty',
      'lokijs': 'lokijs',
      'encoding': 'encoding',
    });
    
    return config;
  },
};

export default nextConfig;
