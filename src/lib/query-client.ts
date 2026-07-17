import { QueryClient, isServer } from "@tanstack/react-query"

let browserClient: QueryClient | undefined

export function getQueryClient(): QueryClient {
  const make = () => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000 } } })
  if (isServer) return make()
  return (browserClient ??= make())
}
