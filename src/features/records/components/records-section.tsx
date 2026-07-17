import { cookies } from "next/headers"
import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import type { SearchParams } from "nuqs/server"

import { getQueryClient } from "@/lib/query-client"
import { unitSystemSchema } from "@/lib/unit-system"
import { UNIT_COOKIE } from "@/config/constants"
import { listParticipants } from "@/infrastructure/participant-repo"
import { recordsQueryKey } from "@/features/records/api/get-records"
import { loadRecordsSearchParams } from "@/features/records/search-params"
import { UnitSystemProvider } from "@/providers/unit-system-provider"
import { SiteHeader } from "@/components/site-header"
import { RecordsTable } from "@/features/records/components/records-table"

export async function RecordsSection({
  searchParams,
  pageSize,
}: {
  searchParams: Promise<SearchParams>
  pageSize: number
}) {
  const { page } = await loadRecordsSearchParams(searchParams)
  const store = await cookies()
  const system = unitSystemSchema.catch("metric").parse(store.get(UNIT_COOKIE)?.value)

  const queryClient = getQueryClient()
  await queryClient.prefetchQuery({
    queryKey: recordsQueryKey(page, pageSize),
    queryFn: () => listParticipants({ page, pageSize }),
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
