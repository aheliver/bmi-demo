import { Suspense } from "react"

import { SiteFooter } from "@/components/site-footer"
import { AddFab } from "@/components/add-fab"
import { RecordsSection } from "@/components/records-section"
import { Skeleton } from "@/components/ui/skeleton"

const PAGE_SIZE = 20

// Note: `searchParams` is NOT awaited here — awaiting it at the page level would make
// the whole route dynamic. It is passed (as a Promise) into the island, which awaits it
// under <Suspense>. So footer + FAB + frame prerender as the static shell.
export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
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
