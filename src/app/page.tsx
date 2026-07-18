import { Suspense } from "react"

import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { AddFab } from "@/components/add-fab"
import { Skeleton } from "@/components/ui/skeleton"
import { UnitSystemProvider } from "@/providers/unit-system-provider"
import { RecordsTable } from "@/features/records/components/records-table"

const PAGE_SIZE = 20

export default function Page() {
  return (
    <UnitSystemProvider>
      <div className="flex min-h-svh flex-col">
        <SiteHeader />
        <main className="flex-1 px-6 py-6">
          <Suspense fallback={<RecordsFallback />}>
            <RecordsTable pageSize={PAGE_SIZE} />
          </Suspense>
        </main>
        <SiteFooter />
        <AddFab />
      </div>
    </UnitSystemProvider>
  )
}

function RecordsFallback() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  )
}
