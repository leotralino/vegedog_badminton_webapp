import type { NextConfig } from 'next'


const nextConfig = {
  typescript: {
    // !! 警告 !!
    // 允许生产环境构建成功，即使项目有类型错误。
    // !! 警告 !!
    ignoreBuildErrors: true,
  },
};

export default nextConfig;


// const config: NextConfig = {
//   outputFileTracingRoot: '/Users/yang/Desktop/open_source/vegdog_badminton_webapp',
//   images: {
//     remotePatterns: [
//       { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
//       { protocol: 'https', hostname: '*.googleusercontent.com' },
//     ],
//   },
// }

// export default config
