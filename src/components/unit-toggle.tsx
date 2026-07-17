"use client"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useUnitSystem } from "@/providers/unit-system-provider"
import type { UnitSystem } from "@/lib/unit-system"

export function UnitToggle() {
  const { system, setSystem } = useUnitSystem()
  return (
    <ToggleGroup
      value={[system]}
      onValueChange={(value: string[]) => {
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
