import { QueryClient, environmentManager } from "@tanstack/react-query"

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { staleTime: 60_000 } } })
}

let browserQueryClient: QueryClient | undefined

export function getQueryClient() {
  if (environmentManager.isServer()) {
    return makeQueryClient() // new client per request on the server
  }
  return (browserQueryClient ??= makeQueryClient()) // reuse in the browser
}
