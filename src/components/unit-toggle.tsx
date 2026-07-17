"use client"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useUnitSystem } from "@/hooks/use-unit-system"
import type { UnitSystem } from "@/domain/record"

export function UnitToggle() {
  const { system, setSystem } = useUnitSystem()
  return (
    <ToggleGroup
      // Base UI ToggleGroup is controlled by an array of pressed values.
      value={[system]}
      onValueChange={(value: string[]) => {
        // Ignore the empty array (deselect of the active item) so one system stays selected.
        const next = value[0]
        if (next) setSystem(next as UnitSystem)
      }}
      variant="outline"
      size="sm"
    >
      <ToggleGroupItem value="metric" aria-label="Metric (kg, cm)">
        Metric
      </ToggleGroupItem>
      <ToggleGroupItem value="imperial" aria-label="Imperial (lb, in)">
        Imperial
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
