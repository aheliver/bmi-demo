import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { toast } from "sonner"

import { UnitSystemProvider, useUnitSystem } from "@/providers/unit-system-provider"
import type { UnitSystem } from "@/lib/unit-system"
import { AddRecordDialog } from "./add-record-dialog"

function SystemProbe() {
  const { setSystem } = useUnitSystem()
  return (
    <button type="button" onClick={() => setSystem("imperial")}>
      probe-set-imperial
    </button>
  )
}

const mutateMock = vi.fn()

vi.mock("@/features/records/api/hooks", () => ({
  useCreateRecord: () => ({ mutate: mutateMock, isPending: false }),
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

beforeEach(() => {
  mutateMock.mockReset()
  vi.mocked(toast.success).mockReset()
  vi.mocked(toast.error).mockReset()
})

function renderDialog(initialSystem: UnitSystem = "metric") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <UnitSystemProvider initialSystem={initialSystem}>
        <AddRecordDialog />
      </UnitSystemProvider>
    </QueryClientProvider>,
  )
}

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText(/first name/i), "Ada")
  await user.type(screen.getByLabelText(/last name/i), "Lovelace")

  fireEvent.change(screen.getByLabelText(/date of birth/i), {
    target: { value: "1990-01-01" },
  })

  await user.click(screen.getByRole("combobox", { name: /sex/i }))
  await user.click(await screen.findByRole("option", { name: "Female" }))

  await user.type(screen.getByLabelText(/weight/i), "150")
  await user.type(screen.getByLabelText(/height/i), "65")
}

describe("AddRecordDialog", () => {
  it("opens the dialog from the FAB", async () => {
    const user = userEvent.setup()
    renderDialog()
    await user.click(screen.getByRole("button", { name: "Add record" }))
    expect(await screen.findByText("Add record", { selector: "[data-slot=dialog-title]" })).toBeInTheDocument()
  })

  it("shows a live BMI preview from weight and height", async () => {
    const user = userEvent.setup()
    renderDialog()
    await user.click(screen.getByRole("button", { name: "Add record" }))
    await user.type(await screen.findByLabelText(/weight/i), "72")
    await user.type(screen.getByLabelText(/height/i), "178")
    expect(await screen.findByTestId("bmi-preview")).toHaveTextContent("22.7")
  })

  it("guards discard when the form is dirty", async () => {
    const user = userEvent.setup()
    renderDialog()
    await user.click(screen.getByRole("button", { name: "Add record" }))
    await user.type(await screen.findByLabelText(/first name/i), "Ada")
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(await screen.findByText("Discard changes?")).toBeInTheDocument()
  })

  it("submits a payload with the live unit system and no bmi field", async () => {
    const user = userEvent.setup()
    renderDialog("imperial")
    await user.click(screen.getByRole("button", { name: "Add record" }))

    await fillRequiredFields(user)

    await user.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => expect(mutateMock).toHaveBeenCalledTimes(1))
    const [payload] = mutateMock.mock.calls[0] as [Record<string, unknown>]
    expect(payload.system).toBe("imperial")
    expect(payload.weightValue).toBe(150)
    expect(payload.heightValue).toBe(65)
    expect(payload).not.toHaveProperty("bmi")
  })

  it("sends the live unit system (not a stale form value) on the second submit after a reset with no intervening toggle", async () => {
    // Simulate onSuccess actually running reset()/setOpen(false), as the real mutate call does.
    mutateMock.mockImplementation((_data, opts) => opts.onSuccess?.())

    const user = userEvent.setup()
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <UnitSystemProvider initialSystem="metric">
          <SystemProbe />
          <AddRecordDialog />
        </UnitSystemProvider>
      </QueryClientProvider>,
    )

    // Toggle the live system while the dialog is closed (e.g. via a header control),
    // then never touch it again for the rest of the test.
    await user.click(screen.getByRole("button", { name: "probe-set-imperial" }))

    // First use: open, fill, submit -> triggers onSuccess -> reset() + close.
    await user.click(screen.getByRole("button", { name: "Add record" }))
    await fillRequiredFields(user)
    await user.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() => expect(mutateMock).toHaveBeenCalledTimes(1))

    // Second use: reopen WITHOUT toggling the probe again. The live context is
    // still "imperial"; a buggy form would have reset its internal `system`
    // field back to the mount-time "metric" default and never re-synced it.
    await user.click(await screen.findByRole("button", { name: "Add record" }))
    await fillRequiredFields(user)
    await user.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() => expect(mutateMock).toHaveBeenCalledTimes(2))

    const [secondPayload] = mutateMock.mock.calls[1] as [Record<string, unknown>]
    expect(secondPayload.system).toBe("imperial")
    expect(typeof secondPayload.weightValue).toBe("number")
    expect(typeof secondPayload.heightValue).toBe("number")
    expect(secondPayload).not.toHaveProperty("bmi")
  })

  it("keeps the dialog open with entered values when the mutation errors", async () => {
    mutateMock.mockImplementation((_data, opts) => opts.onError(new Error("boom")))

    const user = userEvent.setup()
    renderDialog("imperial")
    await user.click(screen.getByRole("button", { name: "Add record" }))

    await fillRequiredFields(user)

    await user.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
      "Something went wrong, please try again later",
    ))

    expect(
      await screen.findByText("Add record", { selector: "[data-slot=dialog-title]" }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/first name/i)).toHaveValue("Ada")
    expect(screen.getByLabelText(/weight/i)).toHaveValue(150)
  })
})
