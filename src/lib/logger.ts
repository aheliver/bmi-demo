import "server-only"
import pino from "pino"

const isDev = process.env.NODE_ENV !== "production"

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "test" ? "silent" : "info"),
  ...(isDev ? { transport: { target: "pino-pretty" } } : {}),
})

export type Logger = pino.Logger
