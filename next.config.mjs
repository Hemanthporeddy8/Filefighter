/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: false,
  async rewrites() {
    return [
      // Static HTML tool embeds
      {
        source: '/video-editor',
        destination: '/video-editor/index.html',
      },
      {
        source: '/background-remover',
        destination: '/background-remover/index.html',
      },
      {
        source: '/ai-tools',
        destination: '/ai-tools/index.html',
      },
      // PDF editor nested path
      {
        source: '/pdf-editor',
        destination: '/my-pdf-editor-main/my-pdf-editor-main/52psd2 - Copy/public/index.html',
      },
    ];
  },
  async redirects() {
    return [
      // Legacy /ai-tools redirect to proper SEO landing page
      {
        source: '/tools',
        destination: '/ai-tools',
        permanent: false,
      },
      // Document Utilities permanent SEO sub-route redirects
      { source: '/merge-pdf-online', destination: '/document-utilities/merge-pdf-online', permanent: true },
      { source: '/split-pdf-online', destination: '/document-utilities/split-pdf-online', permanent: true },
      { source: '/pdf-to-word-online', destination: '/document-utilities/pdf-to-word-online', permanent: true },
      { source: '/pdf-to-excel-online', destination: '/document-utilities/pdf-to-excel-online', permanent: true },
      { source: '/pdf-to-jpg-online', destination: '/document-utilities/pdf-to-jpg-online', permanent: true },
      { source: '/word-to-pdf-online', destination: '/document-utilities/word-to-pdf-online', permanent: true },
      { source: '/excel-to-pdf-online', destination: '/document-utilities/excel-to-pdf-online', permanent: true },
      { source: '/compress-pdf-online', destination: '/document-utilities/compress-pdf-online', permanent: true },
      { source: '/sign-pdf-online', destination: '/document-utilities/sign-pdf-online', permanent: true },
      { source: '/protect-pdf-online', destination: '/document-utilities/protect-pdf-online', permanent: true },
      { source: '/ocr-pdf-online', destination: '/document-utilities/ocr-pdf-online', permanent: true },
      { source: '/watermark-pdf-online', destination: '/document-utilities/watermark-pdf-online', permanent: true },
      { source: '/image-to-pdf-online', destination: '/document-utilities/image-to-pdf-online', permanent: true },
      // AI Tools search redirect queries
      { source: '/bgremover', destination: '/ai-tools', permanent: true },
      { source: '/image-background', destination: '/ai-tools', permanent: true },
      { source: '/image-background-removal', destination: '/ai-tools', permanent: true },
      { source: '/video-background', destination: '/ai-tools', permanent: true },
      { source: '/video-background-remover', destination: '/ai-tools', permanent: true },
      { source: '/bg-remover-online', destination: '/ai-tools', permanent: true },
    ];
  },
  experimental: {
    serverComponentsExternalPackages: ['onnxruntime-node', '@imgly/background-removal'],
    // Tree-shake large icon/UI libraries — only bundle icons actually used
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-icons',
      'date-fns',
    ],
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
        source: '/video-editor/:path*',
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
      {
        source: '/pdf-editor/:path*',
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
