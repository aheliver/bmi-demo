import type { UnitSystem } from "./record"

const round1 = (n: number): number => Math.round(n * 10) / 10

// Both values come pre-computed from the DB; pick the one for `system` and format it.
export function formatWeight(weightKg: number, weightLb: number, system: UnitSystem): string {
  return system === "metric"
    ? `${round1(weightKg).toFixed(1)} kg`
    : `${round1(weightLb).toFixed(1)} lb`
}

export function formatHeight(heightCm: number, heightIn: number, system: UnitSystem): string {
  return system === "metric"
    ? `${Math.round(heightCm)} cm`
    : `${Math.round(heightIn)} in`
}
