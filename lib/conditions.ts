"use client"
import type { AnalysisConditions } from "@/lib/types"

const CURRENT_KEY = "dc_current_conditions"
const SAVED_KEY = "dc_saved_conditions"
const SCHEMA_VERSION = "2026-07-13"
const VERSION_KEY = "dc_schema_version"

function clearStaleData(): void {
  if (typeof window === "undefined") return
  const stored = localStorage.getItem(VERSION_KEY)
  if (stored !== SCHEMA_VERSION) {
    localStorage.removeItem(CURRENT_KEY)
    localStorage.removeItem(SAVED_KEY)
    localStorage.setItem(VERSION_KEY, SCHEMA_VERSION)
  }
}

export function defaultConditions(): AnalysisConditions {
  return {
    baseStart: "2025-11-01",
    baseEnd: "2026-01-31",
    compareEnabled: false,
    compareStart: null,
    compareEnd: null,
    storeCodes: [],
    itemCodes: [],
    categoryClass: "",
    mdCodes: [],
    majorCodes: [],
    middleCodes: [],
    minorCodes: [],
    subCodes: [],
    member: {
      enabled: false,
      genders: [],
      ageGroups: [],
      ranks: [],
      minPurchaseCount: null,
      minPurchaseAmount: null,
    },
  }
}

export function getCurrentConditions(): AnalysisConditions {
  if (typeof window === "undefined") return defaultConditions()
  clearStaleData()
  try {
    const raw = localStorage.getItem(CURRENT_KEY)
    if (raw) return { ...defaultConditions(), ...JSON.parse(raw) }
  } catch {}
  return defaultConditions()
}

export function setCurrentConditions(c: AnalysisConditions): void {
  if (typeof window === "undefined") return
  localStorage.setItem(CURRENT_KEY, JSON.stringify(c))
}

export interface SavedCondition {
  id: string
  name: string
  conditions: AnalysisConditions
  savedAt: string
}

export function getSavedConditions(): SavedCondition[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) ?? "[]")
  } catch {
    return []
  }
}

export function saveCondition(name: string, conditions: AnalysisConditions): SavedCondition[] {
  const list = getSavedConditions()
  const item: SavedCondition = {
    id: "c_" + Date.now(),
    name,
    conditions,
    savedAt: new Date().toISOString(),
  }
  const next = [item, ...list]
  localStorage.setItem(SAVED_KEY, JSON.stringify(next))
  return next
}

export function deleteSavedCondition(id: string): SavedCondition[] {
  const next = getSavedConditions().filter((c) => c.id !== id)
  localStorage.setItem(SAVED_KEY, JSON.stringify(next))
  return next
}
