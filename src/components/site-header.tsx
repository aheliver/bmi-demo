import { UnitToggle } from "@/components/unit-toggle"

export function SiteHeader() {
  return (
    <header className="flex items-center justify-between border-b px-6 py-4">
      <h1 className="text-lg font-semibold">BMI Records</h1>
      <UnitToggle />
    </header>
  )
}
