import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { RecordsTable } from "./records-table"

vi.mock("nuqs", () => ({
  useQueryState: () => [1, vi.fn()],
  parseAsInteger: { withDefault: () => ({}) },
}))

const record = {
  id: 1,
  firstName: "Ada",
  lastName: "Lovelace",
  dob: "1815-12-10",
  weightKg: 68.0389,
  weightLb: 150,
  heightCm: 177.8,
  heightIn: 70,
  bmi: 21.5,
  createdAt: "2026-07-16T00:00:00.000Z",
}

vi.mock("@/hooks/use-records", () => ({
  useRecords: () => ({ data: { data: [record], total: 1 }, isPending: false, isError: false }),
}))

const mockSystem = vi.fn()
vi.mock("@/hooks/use-unit-system", () => ({ useUnitSystem: () => mockSystem() }))

describe("RecordsTable", () => {
  beforeEach(() => mockSystem.mockReturnValue({ system: "metric", setSystem: vi.fn() }))

  it("renders a row with metric-formatted height/weight", () => {
    render(<RecordsTable pageSize={20} />)
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument()
    expect(screen.getByText("178 cm")).toBeInTheDocument()
    expect(screen.getByText("68.0 kg")).toBeInTheDocument()
  })

  it("re-renders imperial units when the system is imperial (no refetch path)", () => {
    mockSystem.mockReturnValue({ system: "imperial", setSystem: vi.fn() })
    render(<RecordsTable pageSize={20} />)
    expect(screen.getByText("70 in")).toBeInTheDocument()
    expect(screen.getByText("150.0 lb")).toBeInTheDocument()
  })
})
