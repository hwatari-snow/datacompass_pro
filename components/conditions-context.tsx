"use client"

import { createContext, useContext, useState, useEffect, useCallback } from "react"
import type { AnalysisConditions } from "@/lib/types"
import { defaultConditions, getCurrentConditions, setCurrentConditions } from "@/lib/conditions"

interface ConditionsContextValue {
  conditions: AnalysisConditions
  setConditions: (c: AnalysisConditions) => void
  updateConditions: (patch: Partial<AnalysisConditions>) => void
}

const ConditionsContext = createContext<ConditionsContextValue>({
  conditions: defaultConditions(),
  setConditions: () => {},
  updateConditions: () => {},
})

export function useConditions() {
  return useContext(ConditionsContext)
}

export function ConditionsProvider({ children }: { children: React.ReactNode }) {
  const [conditions, setConditionsState] = useState<AnalysisConditions>(defaultConditions())

  useEffect(() => {
    setConditionsState(getCurrentConditions())
  }, [])

  const setConditions = useCallback((c: AnalysisConditions) => {
    setConditionsState(c)
    setCurrentConditions(c)
  }, [])

  const updateConditions = useCallback((patch: Partial<AnalysisConditions>) => {
    setConditionsState((prev) => {
      const next = { ...prev, ...patch }
      setCurrentConditions(next)
      return next
    })
  }, [])

  return (
    <ConditionsContext.Provider value={{ conditions, setConditions, updateConditions }}>
      {children}
    </ConditionsContext.Provider>
  )
}
