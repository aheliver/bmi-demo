"use client"

import { createContext, useCallback, useContext, useState, useSyncExternalStore } from "react"

import { unitSystemSchema, type UnitSystem } from "@/lib/unit-system"
import { UNIT_COOKIE } from "@/config/constants"

type UnitSystemContextValue = { system: UnitSystem; setSystem: (next: UnitSystem) => void }

const UnitSystemContext = createContext<UnitSystemContextValue | null>(null)

const subscribe = () => () => {}

function readCookie(): UnitSystem {
  const raw = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${UNIT_COOKIE}=`))
    ?.split("=")[1]
  return unitSystemSchema.catch("metric").parse(raw)
}

export function UnitSystemProvider({ children }: { children: React.ReactNode }) {
  const stored = useSyncExternalStore(subscribe, readCookie, () => "metric" as UnitSystem)
  const [override, setOverride] = useState<UnitSystem | null>(null)
  const system = override ?? stored

  const setSystem = useCallback((next: UnitSystem) => {
    setOverride(next)
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
