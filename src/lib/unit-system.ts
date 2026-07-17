import { UNIT_SYSTEMS, type UnitSystem } from "@/domain/record"

export const UNIT_SYSTEM_COOKIE = "unit-system"

export function parseUnitSystem(value: string | undefined): UnitSystem {
  return UNIT_SYSTEMS.includes(value as UnitSystem) ? (value as UnitSystem) : "metric"
}
