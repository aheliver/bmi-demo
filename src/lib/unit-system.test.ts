import { describe, it, expect } from "vitest"
import { parseUnitSystem } from "./unit-system"

describe("parseUnitSystem", () => {
  it("returns the value when valid", () => {
    expect(parseUnitSystem("imperial")).toBe("imperial")
    expect(parseUnitSystem("metric")).toBe("metric")
  })
  it("defaults to metric for missing/invalid", () => {
    expect(parseUnitSystem(undefined)).toBe("metric")
    expect(parseUnitSystem("furlongs")).toBe("metric")
  })
})
