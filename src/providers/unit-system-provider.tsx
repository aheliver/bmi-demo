"use client"

import { createContext, useCallback, useContext, useState } from "react"

import type { UnitSystem } from "@/lib/unit-system"
import { UNIT_COOKIE } from "@/config/constants"

type UnitSystemContextValue = { system: UnitSystem; setSystem: (next: UnitSystem) => void }

const UnitSystemContext = createContext<UnitSystemContextValue | null>(null)

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
    document.cookie = `${UNIT_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
  }, [])

  return (
    <UnitSystemContext.Provider value={{ system, setSystem }}>
      {children}
    </UnitSystemContext.Provider>
  )
}

export function useUnitSystem() {
  const ctx = useContext(UnitSystemContext)
  if (!ctx) throw new Error("useUnitSystem must be used within UnitSystemProvider")
  return ctx
}
