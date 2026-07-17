import "server-only"
import { cookies } from "next/headers"

import type { UnitSystem } from "@/domain/record"

import { UNIT_SYSTEM_COOKIE, parseUnitSystem } from "./unit-system"

/** Server-only: read the preference for a no-flash first paint. */
export async function getUnitSystem(): Promise<UnitSystem> {
  const store = await cookies()
  return parseUnitSystem(store.get(UNIT_SYSTEM_COOKIE)?.value)
}
