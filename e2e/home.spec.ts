import { test, expect } from "@playwright/test"

test("home lists records and toggles units without refetch", async ({ page }) => {
  const recordRequests: string[] = []
  page.on("request", (r) => {
    if (r.url().includes("/api/records")) recordRequests.push(r.url())
  })

  await page.goto("/")
  await expect(page.getByRole("heading", { name: "BMI Records" })).toBeVisible()
  await expect(page.getByText(/records/)).toBeVisible()

  // Metric first paint: at least one kg weight is shown.
  await expect(page.getByText(/kg/).first()).toBeVisible()

  const before = recordRequests.length
  await page.getByRole("button", { name: /imperial/i }).click()
  await expect(page.getByText(/lb/).first()).toBeVisible()
  // Unit toggle is pure client formatting — no /api/records call fires.
  expect(recordRequests.length).toBe(before)

  // Exact match: avoid colliding with the Next.js dev-tools button ("Open Next.js Dev Tools").
  await page.getByRole("button", { name: "Next", exact: true }).click()
  await expect(page).toHaveURL(/page=2/)
})
