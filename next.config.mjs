import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  basePath: process.env.NODE_ENV === "production" ? "/faculty" : "",
  // The kit ships TypeScript source rather than a built bundle, so Next has to
  // compile it along with our own code.
  transpilePackages: ["@saraswati/tenant-kit"],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
