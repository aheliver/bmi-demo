import type { UnitSystem } from "./unit-system"

export interface BmiInput {
  weightValue: number
  heightValue: number
  system: UnitSystem
}

export function computeBmi({ weightValue, heightValue, system }: BmiInput): number {
  const bmi =
    system === "metric"
      ? weightValue / (heightValue / 100) ** 2
      : (weightValue / heightValue ** 2) * 703
  return Math.round(bmi * 10) / 10
}
