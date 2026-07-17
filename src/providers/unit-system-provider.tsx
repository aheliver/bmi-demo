"use client"

import { createContext, useCallback, useState } from "react"

import type { UnitSystem } from "@/domain/record"
import { UNIT_SYSTEM_COOKIE } from "@/lib/unit-system"

type UnitSystemContextValue = { system: UnitSystem; setSystem: (next: UnitSystem) => void }

export const UnitSystemContext = createContext<UnitSystemContextValue | null>(null)

export function UnitSystemProvider({
  initialSystem,
  children,
}: {
  initialSystem: UnitSystem
  children: React.ReactNode
}) {
  const [system, setSystemState] = useState<UnitSystem>(initialSystem)

  const setSystem = useCallback((next: UnitSystem) => {
    setSystemState(next)
    document.cookie = `${UNIT_SYSTEM_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
  }, [])

  return (
    <UnitSystemContext.Provider value={{ system, setSystem }}>
      {children}
    </UnitSystemContext.Provider>
  )
}
