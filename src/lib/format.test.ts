import { describe, it, expect } from "vitest"
import { formatWeight, formatHeight } from "./format"

describe("formatWeight", () => {
  it("selects + formats the kg value in metric", () => {
    expect(formatWeight(68.0389, 150, "metric")).toBe("68.0 kg")
  })
  it("selects + formats the lb value in imperial", () => {
    expect(formatWeight(68.0389, 150, "imperial")).toBe("150.0 lb")
  })
})

describe("formatHeight", () => {
  it("selects + formats the cm value in metric", () => {
    expect(formatHeight(177.8, 70, "metric")).toBe("178 cm")
  })
  it("selects + formats the in value in imperial", () => {
    expect(formatHeight(177.8, 70, "imperial")).toBe("70 in")
  })
})
