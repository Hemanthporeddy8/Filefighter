/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: false,
  async rewrites() {
    return [
      {
        source: '/video-editor',
        destination: '/video-editor.html',
      },
    ];
  },
  experimental: {
    serverComponentsExternalPackages: ['onnxruntime-node', '@imgly/background-removal'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
        ],
      },
    ];
  },
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      // Step 1: Provide fallbacks for Node.js modules
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        http: false,
        https: false,
        stream: false,
        os: false,
        url: false,
        zlib: false,
        net: false,
        tls: false,
        child_process: false,
        dns: false,
      };

      // Step 2: Handle "node:" scheme errors by stripping the prefix
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
          resource.request = resource.request.replace(/^node:/, "");
        })
      );

      // Step 3: Global alias for node-specific modules used by libraries like xlsx/pptxgenjs
      config.resolve.alias = {
        ...config.resolve.alias,
        'onnxruntime-node': false,
        'node:fs': false,
        'node:path': false,
        'node:http': false,
        'node:https': false,
        'node:stream': false,
        'node:crypto': false,
        'node:os': false,
        'node:url': false,
        'node:zlib': false,
      };
    }
    return config;
  },
};

export default nextConfig;
