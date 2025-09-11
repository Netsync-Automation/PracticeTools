/** @type {import('next').NextConfig} */
const nextConfig = {
  generateBuildId: async () => {
    // Generate unique build ID for cache busting
    return `build-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  },
  experimental: {
    serverComponentsExternalPackages: ['@xenova/transformers', 'onnxruntime-node'],
    serverActions: {
      allowedOrigins: ['netsync.login.duosecurity.com', 'sso-79bfacfb.sso.duosecurity.com']
    }
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          }
        ]
      },
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate'
          }
        ]
      },
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      }
    ];
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('@xenova/transformers', 'onnxruntime-node');
    }
    
    // Ignore binary files
    config.module.rules.push({
      test: /\.node$/,
      use: 'ignore-loader'
    });
    
    return config;
  }
};

export default nextConfig;