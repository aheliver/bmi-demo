import type { UnitSystem } from "./record"

export interface BmiInput {
  weightValue: number
  heightValue: number
  system: UnitSystem
}

/** BMI from the as-entered values, using the CDC formula for the entry's unit system.
 *  A single `system` makes a metric/imperial mix unrepresentable. */
export function computeBmi({ weightValue, heightValue, system }: BmiInput): number {
  const bmi =
    system === "metric"
      ? weightValue / (heightValue / 100) ** 2 // kg / m²
      : (weightValue / heightValue ** 2) * 703 // lb / in² × 703
  return Math.round(bmi * 10) / 10
}
