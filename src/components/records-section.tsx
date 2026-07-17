import { dehydrate, HydrationBoundary } from "@tanstack/react-query"

import { getQueryClient } from "@/lib/query-client"
import { recordsQueryKey } from "@/lib/records-query"
import { listRecords } from "@/services/list-records"
import { getUnitSystem } from "@/lib/unit-system.server"
import { UnitSystemProvider } from "@/providers/unit-system-provider"
import { SiteHeader } from "@/components/site-header"
import { RecordsTable } from "@/components/records-table"

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export async function RecordsSection({
  searchParams,
  pageSize,
}: {
  searchParams: SearchParams
  pageSize: number
}) {
  // Awaiting these dynamic inputs HERE (inside <Suspense>) keeps the page shell static.
  const sp = await searchParams
  const rawPage = Array.isArray(sp.page) ? sp.page[0] : sp.page
  const page = Math.max(1, Number(rawPage) || 1)

  const system = await getUnitSystem()

  const queryClient = getQueryClient()
  await queryClient.prefetchQuery({
    queryKey: recordsQueryKey(page, pageSize),
    queryFn: () => listRecords({ page, pageSize }),
  })

  return (
    <UnitSystemProvider initialSystem={system}>
      <SiteHeader />
      <main className="flex-1 px-6 py-6">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <RecordsTable pageSize={pageSize} />
        </HydrationBoundary>
      </main>
    </UnitSystemProvider>
  )
}
