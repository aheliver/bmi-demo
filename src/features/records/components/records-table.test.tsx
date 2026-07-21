import { describe, it, expect, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"

import { UnitSystemProvider } from "@/providers/unit-system-provider"
import type { Record, RecordsQuery } from "@/features/records/schema"
import { RecordsTable } from "./records-table"

function makeRecord(id: number, firstName: string, lastName: string): Record {
  return {
    id,
    firstName,
    lastName,
    dob: "1990-01-01",
    weightKg: 70,
    weightLb: 154,
    heightCm: 175,
    heightIn: 68,
    bmi: 22.9,
    createdAt: "2026-01-01T00:00:00.000Z",
  }
}

// Two full, fully-distinct pages: page 1 is Ada..#20, page 2 is Grace..#40.
// total=40, pageSize=20 -> exactly 2 pages. Every full name is unique so a stale
// row (keyed by array index) would keep showing a page-1 name after navigating.
const PAGE_1 = Array.from({ length: 20 }, (_, i) =>
  makeRecord(i + 1, `Ada${i + 1}`, "Lovelace"),
)
const PAGE_2 = Array.from({ length: 20 }, (_, i) =>
  makeRecord(i + 21, `Grace${i + 21}`, "Hopper"),
)

vi.mock("@/features/records/api/hooks", () => ({
  useRecords: (query: RecordsQuery) => ({
    data: { data: query.page === 1 ? PAGE_1 : PAGE_2, total: 40 },
    isPending: false,
    isError: false,
  }),
}))

function renderTable() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      {/* hasMemory: persist query-state updates so "Next" actually navigates. */}
      <NuqsTestingAdapter hasMemory>
        <UnitSystemProvider initialSystem="metric">
          <RecordsTable pageSize={20} />
        </UnitSystemProvider>
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  )
}

describe("RecordsTable pagination", () => {
  it("shows the next page's full names after clicking Next", async () => {
    const user = userEvent.setup()
    renderTable()

    // Page 1.
    expect(screen.getByText("Ada1 Lovelace")).toBeInTheDocument()
    expect(screen.getByText("Ada20 Lovelace")).toBeInTheDocument()
    expect(screen.getByText(/Page 1 of 2/)).toBeInTheDocument()

    // Same mounted table instance — advance to page 2.
    await user.click(screen.getByRole("button", { name: "Next" }))

    // Guard: navigation actually happened (not a stuck page reading as a stale row).
    await waitFor(() =>
      expect(screen.getByText(/Page 2 of 2/)).toBeInTheDocument(),
    )

    // The Full name column reflects page 2, and no page-1 name lingers.
    expect(screen.getByText("Grace21 Hopper")).toBeInTheDocument()
    expect(screen.getByText("Grace40 Hopper")).toBeInTheDocument()
    expect(screen.queryByText("Ada1 Lovelace")).not.toBeInTheDocument()
    expect(screen.queryByText("Ada20 Lovelace")).not.toBeInTheDocument()
  })
})
