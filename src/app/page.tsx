import { Suspense } from "react"
import type { SearchParams } from "nuqs/server"

import { SiteFooter } from "@/components/site-footer"
import { AddFab } from "@/components/add-fab"
import { RecordsSection } from "@/features/records/components/records-section"
import { Skeleton } from "@/components/ui/skeleton"

const PAGE_SIZE = 20

export default function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <div className="flex min-h-svh flex-col">
      <Suspense fallback={<RecordsSectionFallback />}>
        <RecordsSection searchParams={searchParams} pageSize={PAGE_SIZE} />
      </Suspense>
      <SiteFooter />
      <AddFab />
    </div>
  )
}

function RecordsSectionFallback() {
  return (
    <>
      <div className="flex items-center justify-between border-b px-6 py-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-8 w-40" />
      </div>
      <main className="flex-1 space-y-3 px-6 py-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </main>
    </>
  )
}
