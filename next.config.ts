import { loadEnvConfig } from "@next/env"
import type { NextConfig } from "next"

loadEnvConfig(process.cwd())
process.env.TZ = process.env.TZ || "UTC"

const nextConfig: NextConfig = {}

export default nextConfig
