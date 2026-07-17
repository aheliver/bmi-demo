import { unstable_rethrow } from "next/navigation"

import { logger, type Logger } from "./logger"

type Handler = (req: Request, log: Logger) => Promise<Response>

export function withRequestLog(event: string, handler: Handler) {
  return async (req: Request): Promise<Response> => {
    const start = performance.now()
    const method = req.method
    const log = logger.child({ event })
    try {
      const res = await handler(req, log)
      log.info(
        { method, status: res.status, durationMs: Math.round(performance.now() - start) },
        "http.request.completed",
      )
      return res
    } catch (err) {
      // Re-throw Next.js control-flow signals (redirect, notFound, prerender bail-out) —
      // they are not real failures and must propagate for the framework to handle.
      unstable_rethrow(err)
      log.error(
        { method, status: 500, durationMs: Math.round(performance.now() - start), err },
        "http.request.failed",
      )
      return new Response(JSON.stringify({ error: "Internal Server Error" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      })
    }
  }
}
