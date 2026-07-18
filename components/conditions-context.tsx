"use client"

import { createContext, useContext, useState, useEffect, useCallback } from "react"
import type { AnalysisConditions } from "@/lib/types"
import { defaultConditions, getCurrentConditions, setCurrentConditions } from "@/lib/conditions"

interface ConditionsContextValue {
  conditions: AnalysisConditions
  version: number
  setConditions: (c: AnalysisConditions) => void
  updateConditions: (patch: Partial<AnalysisConditions>) => void
}

const ConditionsContext = createContext<ConditionsContextValue>({
  conditions: defaultConditions(),
  version: 0,
  setConditions: () => {},
  updateConditions: () => {},
})

export function useConditions() {
  return useContext(ConditionsContext)
}

export function ConditionsProvider({ children }: { children: React.ReactNode }) {
  const [conditions, setConditionsState] = useState<AnalysisConditions>(defaultConditions())
  const [version, setVersion] = useState(0)

  useEffect(() => {
    setConditionsState(getCurrentConditions())
    setVersion(1)
  }, [])

  const setConditions = useCallback((c: AnalysisConditions) => {
    setConditionsState(c)
    setCurrentConditions(c)
    setVersion((v) => v + 1)
  }, [])

  const updateConditions = useCallback((patch: Partial<AnalysisConditions>) => {
    setConditionsState((prev) => {
      const next = { ...prev, ...patch }
      setCurrentConditions(next)
      return next
    })
  }, [])

  return (
    <ConditionsContext.Provider value={{ conditions, version, setConditions, updateConditions }}>
      {children}
    </ConditionsContext.Provider>
  )
}
