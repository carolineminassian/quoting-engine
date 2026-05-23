import type { NextConfig } from "next";
/** @type {import('next').NextConfig} */


const nextConfig: NextConfig = {
// ... your existing config

// On navigation errors caused by stale chunks, automatically reload the page
// This handles the "Failed to load chunk" error gracefully
onDemandEntries: {
  maxInactiveAge: 25 * 1000,
  pagesBufferLength: 2,
},
};
// const nextConfig: NextConfig = {
//   /* config options here */
// };

export default nextConfig;
