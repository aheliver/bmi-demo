import { describe, it, expect } from "vitest"
import { computeBmi } from "./bmi"

describe("computeBmi", () => {
  it("metric: kg + cm (CDC formula)", () => {
    // 68 kg, 178 cm -> 68 / 1.78^2 = 21.46...
    expect(computeBmi({ weightValue: 68, heightValue: 178, system: "metric" })).toBe(21.5)
  })
  it("imperial: lb + in (CDC × 703)", () => {
    // 150 lb, 70 in -> 150/70^2*703 = 21.52...
    expect(computeBmi({ weightValue: 150, heightValue: 70, system: "imperial" })).toBe(21.5)
  })
})
