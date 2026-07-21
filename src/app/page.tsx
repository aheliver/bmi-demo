import { cookies } from "next/headers"
import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import { createLoader } from "nuqs/server"
import type { SearchParams } from "nuqs/server"

import { getQueryClient } from "@/lib/query-client"
import { unitSystemSchema } from "@/lib/unit-system"
import { UNIT_COOKIE } from "@/config/constants"
import { listParticipants } from "@/infrastructure/participant-repo"
import { recordsQueryKey } from "@/features/records/api/get-records"
import { recordsSearchParsers } from "@/features/records/search-params"
import { UnitSystemProvider } from "@/providers/unit-system-provider"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { AddFab } from "@/components/add-fab"
import { RecordsTable } from "@/features/records/components/records-table"

const PAGE_SIZE = 20
const loadSearchParams = createLoader(recordsSearchParsers)

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { page, sort, order } = await loadSearchParams(searchParams)
  const store = await cookies()
  const system = unitSystemSchema
    .catch("metric")
    .parse(store.get(UNIT_COOKIE)?.value)

  const query = { page, pageSize: PAGE_SIZE, sort, order }
  const queryClient = getQueryClient()
  await queryClient.prefetchQuery({
    queryKey: recordsQueryKey(query),
    queryFn: () => listParticipants(query),
  })

  return (
    <UnitSystemProvider initialSystem={system}>
      <div className="flex min-h-svh flex-col">
        <SiteHeader />
        <main className="flex-1 px-6 py-6">
          <HydrationBoundary state={dehydrate(queryClient)}>
            <RecordsTable pageSize={PAGE_SIZE} />
          </HydrationBoundary>
        </main>
        <SiteFooter />
        <AddFab />
      </div>
    </UnitSystemProvider>
  )
}
