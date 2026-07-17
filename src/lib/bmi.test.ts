import { describe, it, expect } from "vitest"
import { computeBmi } from "./bmi"

describe("computeBmi", () => {
  it("metric: kg + cm (CDC formula)", () => {
    expect(computeBmi({ weightValue: 68, heightValue: 178, system: "metric" })).toBe(21.5)
  })
  it("imperial: lb + in (CDC × 703)", () => {
    expect(computeBmi({ weightValue: 150, heightValue: 70, system: "imperial" })).toBe(21.5)
  })
})
