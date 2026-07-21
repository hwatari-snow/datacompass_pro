import type { AnalysisConditions } from "@/lib/types"

function summarizeNamedItems(names: string[] | undefined, fallbackCount: number, suffix: string): string {
  if (names && names.length > 0) {
    if (names.length <= 3) return names.join("、")
    return `${names.slice(0, 3).join("、")} ほか${names.length - 3}${suffix}`
  }
  return `${fallbackCount}${suffix}`
}

export function buildConditionContext(conditions: AnalysisConditions): string {
  const parts = [`期間は${conditions.baseStart}から${conditions.baseEnd}`]

  parts.push(
    conditions.storeCodes.length > 0
      ? `対象店舗は${summarizeNamedItems(conditions.storeNames, conditions.storeCodes.length, "店舗")}`
      : "対象店舗は全店舗"
  )

  if (conditions.middleCodes.length > 0) {
    parts.push(`対象商品カテゴリは${summarizeNamedItems(conditions.middleNames, conditions.middleCodes.length, "カテゴリ")}`)
  } else if (conditions.majorCodes.length > 0) {
    parts.push(`対象商品カテゴリは${summarizeNamedItems(conditions.majorNames, conditions.majorCodes.length, "分類")}`)
  } else if (conditions.mdCodes.length > 0) {
    parts.push(`対象商品カテゴリは${summarizeNamedItems(conditions.mdNames, conditions.mdCodes.length, "カテゴリ")}`)
  } else {
    parts.push("対象商品カテゴリは全カテゴリ")
  }

  return `【分析条件】${parts.join("、")}です。この条件を優先して解釈してください。`
}
