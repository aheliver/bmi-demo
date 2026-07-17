import type { UnitSystem } from "./unit-system"

export function formatWeight(weightKg: number, weightLb: number, system: UnitSystem): string {
  return system === "metric" ? `${weightKg.toFixed(1)} kg` : `${weightLb.toFixed(1)} lb`
}

export function formatHeight(heightCm: number, heightIn: number, system: UnitSystem): string {
  return system === "metric" ? `${Math.round(heightCm)} cm` : `${Math.round(heightIn)} in`
}
