/** @type {import('next').NextConfig} */
const nextConfig = {
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