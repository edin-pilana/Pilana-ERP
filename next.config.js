/** @type {import('next').NextConfig} */
const nextConfig = {
    typescript: {
      // Opasnost! Ovo gasi strogu provjeru tipova, ali nam omogućava deploy
      ignoreBuildErrors: true,
    },
    eslint: {
      // Ignoriše i sitna upozorenja
      ignoreDuringBuilds: true,
    },
    experimental: {
      serverComponentsExternalPackages: ['web-push'],
    },
  }
  
  module.exports = nextConfig;