"use client"

import { useContext } from "react"

import { UnitSystemContext } from "@/providers/unit-system-provider"

export function useUnitSystem() {
  const ctx = useContext(UnitSystemContext)
  if (!ctx) throw new Error("useUnitSystem must be used within UnitSystemProvider")
  return ctx
}
