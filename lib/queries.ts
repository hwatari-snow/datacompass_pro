import { DB } from "@/lib/constants"
import type {
  AnalysisConditions,
  AbcCriteria,
  ProductUnit,
  StoreUnit,
} from "@/lib/types"

// ---- サニタイズ ----
/** 文字列リテラルのエスケープ（シングルクォート二重化） */
function lit(v: string): string {
  return "'" + String(v).replace(/'/g, "''") + "'"
}
/** IN句用のリテラルリスト */
function inList(values: string[]): string {
  return values.map(lit).join(", ")
}
/** Strip composite prefix (e.g. "DS_01" -> "01") for category codes */
function rawCodes(values: string[]): string[] {
  return values.map((v) => { const idx = v.indexOf("_"); return idx >= 0 ? v.substring(idx + 1) : v })
}
/** IN clause with prefix-stripped codes */
function inListRaw(values: string[]): string {
  return rawCodes(values).map(lit).join(", ")
}
/** 日付バリデーション (YYYY-MM-DD) */
function dateLit(v: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error(`invalid date: ${v}`)
  return `'${v}'`
}

const T_TRADE = `${DB}.ANALYTICS.IS_POS_TRANSACTION`
const T_ITEMS = `${DB}.MASTER.DATAMART_COMMON_ITEMS`
const T_STORES = `${DB}.MASTER.DATAMART_COMMON_STORES`
const T_MEMBERS = `${DB}.MASTER.DATAMART_COMMON_MEMBERS`
const T_DT_MIDDLE = `${DB}.ANALYTICS.DT_DAILY_MIDDLE_STORE`
const T_DT_STORE = `${DB}.ANALYTICS.DT_DAILY_STORE_SUMMARY`
const T_TRADE_AGG = `${DB}.ANALYTICS.IS_POS_TRANSACTION_AGG`
const T_DT_AGG_MINOR = `${DB}.ANALYTICS.DT_AGG_DAILY_MINOR_STORE`

// 集計単位 → (コード列, 名称列)
const PRODUCT_UNIT_COLS: Record<ProductUnit, [string, string]> = {
  item: ["t.ITEM_CODE", "MAX(i.ITEM_NAME)"],
  md: ["i.MD_CODE", "MAX(i.MD_NAME)"],
  major: ["i.MAJOR_CODE", "MAX(i.MAJOR_NAME)"],
  middle: ["i.MIDDLE_CODE", "MAX(i.MIDDLE_NAME)"],
  minor: ["i.MINOR_CODE", "MAX(i.MINOR_NAME)"],
  sub: ["i.SUB_CODE", "MAX(i.SUB_NAME)"],
}
const STORE_UNIT_COLS: Record<StoreUnit, [string, string]> = {
  store: ["t.STORE_CODE", "MAX(s.STORE_NAME)"],
  area: ["s.AREA_CODE", "MAX(s.AREA_NAME)"],
  business_type: ["s.BUSINESS_TYPE_CODE", "MAX(s.BUSINESS_TYPE_NAME)"],
  corporation: ["s.CORPORATION_CODE", "MAX(s.CORPORATION_NAME)"],
  prefecture: ["s.PREFECTURE_CODE", "MAX(s.PREFECTURE_NAME)"],
}

// ranked段階で metric_val に使う agg列名
const AGG_METRIC_COL: Record<AbcCriteria, string> = {
  amount: "sales",
  quantity: "quantity",
  receipt: "receipt_count",
}

// ============================================================
// ABC分析 — 常に直接クエリ（条件からSQLを生成）
// ============================================================

function buildFilters(
  c: AnalysisConditions,
  start: string,
  end: string,
): string {
  const parts: string[] = [`t.BUSINESS_DATE BETWEEN ${dateLit(start)} AND ${dateLit(end)}`]
  if (c.storeCodes.length > 0) parts.push(`t.STORE_CODE IN (${inList(c.storeCodes)})`)
  if (c.itemCodes.length > 0) parts.push(`t.ITEM_CODE IN (${inList(c.itemCodes)})`)
  if (c.mdCodes && c.mdCodes.length > 0) parts.push(`i.MD_CODE IN (${inListRaw(c.mdCodes)})`)
  if (c.majorCodes && c.majorCodes.length > 0) parts.push(`i.MAJOR_CODE IN (${inListRaw(c.majorCodes)})`)
  if (c.middleCodes && c.middleCodes.length > 0) parts.push(`i.MIDDLE_CODE IN (${inListRaw(c.middleCodes)})`)
  if (c.minorCodes && c.minorCodes.length > 0) parts.push(`i.MINOR_CODE IN (${inListRaw(c.minorCodes)})`)
  if (c.subCodes && c.subCodes.length > 0) parts.push(`i.SUB_CODE IN (${inListRaw(c.subCodes)})`)

  if (c.member?.enabled) {
    // 属性で会員を絞る
    const mParts: string[] = []
    if (c.member.genders.length > 0) mParts.push(`m.GENDER IN (${inList(c.member.genders)})`)
    if (c.member.ageGroups.length > 0) mParts.push(`m.AGE_GROUP IN (${inList(c.member.ageGroups)})`)
    if (c.member.ranks.length > 0) mParts.push(`m.MEMBER_RANK IN (${inList(c.member.ranks)})`)
    const memberWhere = mParts.length > 0 ? `WHERE ${mParts.join(" AND ")}` : ""

    // 購入回数/金額しきい値（期間・店舗・商品フィルタ内で集計）
    const thParts: string[] = []
    if (c.member.minPurchaseCount && c.member.minPurchaseCount > 0)
      thParts.push(`COUNT(DISTINCT t2.TRADE_KEY) >= ${Number(c.member.minPurchaseCount)}`)
    if (c.member.minPurchaseAmount && c.member.minPurchaseAmount > 0)
      thParts.push(`SUM(t2.ITEM_SALES_AMOUNT) >= ${Number(c.member.minPurchaseAmount)}`)

    let eligibleSql = `SELECT m.MAJICA_NO FROM ${T_MEMBERS} m ${memberWhere}`
    if (thParts.length > 0) {
      const t2Filters: string[] = [`t2.BUSINESS_DATE BETWEEN ${dateLit(start)} AND ${dateLit(end)}`, `t2.MAJICA_NO IS NOT NULL`]
      if (c.storeCodes.length > 0) t2Filters.push(`t2.STORE_CODE IN (${inList(c.storeCodes)})`)
      if (c.itemCodes.length > 0) t2Filters.push(`t2.ITEM_CODE IN (${inList(c.itemCodes)})`)
      const havingMembers = `SELECT t2.MAJICA_NO FROM ${T_TRADE} t2 WHERE ${t2Filters.join(" AND ")} GROUP BY t2.MAJICA_NO HAVING ${thParts.join(" AND ")}`
      eligibleSql = `${eligibleSql}${memberWhere ? " AND" : " WHERE"} m.MAJICA_NO IN (${havingMembers})`
    }
    parts.push(`t.MAJICA_NO IN (${eligibleSql})`)
  }
  return parts.join("\n    AND ")
}

export interface AbcQueryArgs {
  conditions: AnalysisConditions
  tab: "product" | "store"
  unit: ProductUnit | StoreUnit
  criteria: AbcCriteria
  period: "base" | "compare"
}

/** サマリ集計SQL（合計売上/数量/レシート数/対象ユニット数） */
export function buildAbcSummarySql(args: Omit<AbcQueryArgs, "criteria">): string {
  const { conditions, tab, unit, period } = args
  const start = period === "base" ? conditions.baseStart : conditions.compareStart!
  const end = period === "base" ? conditions.baseEnd : conditions.compareEnd!

  // Use DT when possible (same condition as buildAbcSql)
  const memberEnabled = !!(conditions.member?.enabled)
  const hasMinorFilter = !!(conditions.minorCodes?.length)
  const hasSubFilter = !!(conditions.subCodes?.length)
  const canUseExistingDt = (unit === "md" || unit === "major" || unit === "middle" || (tab === "store"))
    && !hasMinorFilter
    && !hasSubFilter
    && !memberEnabled
    && conditions.itemCodes.length === 0

  // AGG DT for minor
  const canUseAggDt = (unit === "minor")
    && !memberEnabled
    && !hasSubFilter
    && conditions.itemCodes.length === 0

  // AGG fact for item-level and sub-level (no dedicated sub DT)
  const canUseAggFact = !memberEnabled && (unit === "item" || unit === "sub") && conditions.itemCodes.length === 0

  if (canUseExistingDt) {
    const isStoreTab = tab === "store"
    const hasMiddleFilter = !!(conditions.middleCodes?.length)
    const dtTable = T_DT_MIDDLE  // Always use RAP-protected middle-store DT
    const DT_PRODUCT_UNIT_COLS: Record<string, string> = {
      md: "d.MD_CODE", major: "d.MAJOR_CODE", middle: "d.MIDDLE_CODE",
    }
    const DT_STORE_UNIT_COLS: Record<string, string> = {
      store: "d.STORE_CODE", area: "s.AREA_CODE", business_type: "s.BUSINESS_TYPE_CODE",
      corporation: "s.CORPORATION_CODE", prefecture: "s.PREFECTURE_CODE",
    }
    const codeCol = isStoreTab
      ? (DT_STORE_UNIT_COLS[unit] ?? "d.STORE_CODE")
      : (DT_PRODUCT_UNIT_COLS[unit] ?? "d.MD_CODE")
    const filters: string[] = [`d.BUSINESS_DATE BETWEEN '${start}' AND '${end}'`, `d.TRADE_CLASS_3 = '売上'`]
    if (conditions.storeCodes.length > 0) filters.push(`d.STORE_CODE IN (${inList(conditions.storeCodes)})`)
    if (!isStoreTab) {
      if (conditions.mdCodes?.length) filters.push(`d.MD_CODE IN (${inListRaw(conditions.mdCodes)})`)
      if (conditions.majorCodes?.length) filters.push(`d.MAJOR_CODE IN (${inListRaw(conditions.majorCodes)})`)
      if (conditions.middleCodes?.length) filters.push(`d.MIDDLE_CODE IN (${inListRaw(conditions.middleCodes)})`)
    }
    const storeJoin = isStoreTab ? `JOIN ${T_STORES} s ON s.STORE_CODE = d.STORE_CODE` : ""
    return `
SELECT
  SUM(d.TOTAL_SALES_AMOUNT) AS total_sales,
  SUM(d.TOTAL_SALES_QUANTITY) AS total_quantity,
  SUM(d.RECEIPT_COUNT) AS total_receipts,
  COUNT(DISTINCT ${codeCol}) AS total_units
FROM ${dtTable} d
${storeJoin}
WHERE ${filters.join("\n  AND ")}
`.trim()
  }

  if (canUseAggDt) {
    const dtTable = T_DT_AGG_MINOR
    const aggCodeCol = "d.MINOR_CODE"
    const aggFilters: string[] = [`d.BUSINESS_DATE BETWEEN '${start}' AND '${end}'`, `d.TRADE_CLASS_3 = '売上'`]
    if (conditions.storeCodes.length > 0) aggFilters.push(`d.STORE_CODE IN (${inList(conditions.storeCodes)})`)
    if (conditions.mdCodes?.length) aggFilters.push(`d.MD_CODE IN (${inListRaw(conditions.mdCodes)})`)
    if (conditions.majorCodes?.length) aggFilters.push(`d.MAJOR_CODE IN (${inListRaw(conditions.majorCodes)})`)
    if (unit === "minor" && conditions.middleCodes?.length) aggFilters.push(`d.MIDDLE_CODE IN (${inListRaw(conditions.middleCodes)})`)
    return `
SELECT
  SUM(d.TOTAL_SALES_AMOUNT) AS total_sales,
  SUM(d.TOTAL_SALES_QUANTITY) AS total_quantity,
  SUM(d.RECEIPT_COUNT) AS total_receipts,
  COUNT(DISTINCT ${aggCodeCol}) AS total_units
FROM ${dtTable} d
WHERE ${aggFilters.join("\n  AND ")}
`.trim()
  }

  if (canUseAggFact) {
    const aggFilters: string[] = [`t.BUSINESS_DATE BETWEEN '${start}' AND '${end}'`, `t.TRADE_CLASS_3 = '売上'`]
    if (conditions.storeCodes.length > 0) aggFilters.push(`t.STORE_CODE IN (${inList(conditions.storeCodes)})`)
    if (conditions.mdCodes?.length) aggFilters.push(`i.MD_CODE IN (${inListRaw(conditions.mdCodes)})`)
    if (conditions.majorCodes?.length) aggFilters.push(`i.MAJOR_CODE IN (${inListRaw(conditions.majorCodes)})`)
    if (conditions.middleCodes?.length) aggFilters.push(`i.MIDDLE_CODE IN (${inListRaw(conditions.middleCodes)})`)
    if (conditions.minorCodes?.length) aggFilters.push(`i.MINOR_CODE IN (${inListRaw(conditions.minorCodes)})`)
    if (conditions.subCodes?.length) aggFilters.push(`i.SUB_CODE IN (${inListRaw(conditions.subCodes)})`)
    const distinctCol = unit === "sub" ? "i.SUB_CODE" : "t.ITEM_CODE"
    return `
SELECT
  SUM(t.ITEM_SALES_AMOUNT) AS total_sales,
  SUM(t.ITEM_SALES_QUANTITY) AS total_quantity,
  SUM(t.RECEIPT_COUNT) AS total_receipts,
  COUNT(DISTINCT ${distinctCol}) AS total_units
FROM ${T_TRADE_AGG} t
JOIN ${T_ITEMS} i ON i.ITEM_CODE = t.ITEM_CODE
WHERE ${aggFilters.join("\n  AND ")}
`.trim()
  }

  // Fallback to fact table — minimal JOINs
  const [codeCol] =
    tab === "product" ? PRODUCT_UNIT_COLS[unit as ProductUnit] : STORE_UNIT_COLS[unit as StoreUnit]

  const needsItems = tab === "product"
    || !!(conditions.mdCodes?.length) || !!(conditions.majorCodes?.length)
    || !!(conditions.middleCodes?.length) || !!(conditions.minorCodes?.length)
    || !!(conditions.subCodes?.length)
    || !!(conditions.categoryClass)
  const needsStores = tab === "store" && unit !== "store"

  const filters: string[] = [`t.BUSINESS_DATE BETWEEN '${start}' AND '${end}'`, `t.TRADE_CLASS_3 = '売上'`]
  if (conditions.storeCodes.length > 0) filters.push(`t.STORE_CODE IN (${inList(conditions.storeCodes)})`)
  if (conditions.itemCodes.length > 0) filters.push(`t.ITEM_CODE IN (${inList(conditions.itemCodes)})`)
  if (needsItems) {
    if (conditions.categoryClass) filters.push(`i.ITEM_CATEGORY_CLASS = ${lit(conditions.categoryClass)}`)
    if (conditions.mdCodes?.length) filters.push(`i.MD_CODE IN (${inListRaw(conditions.mdCodes)})`)
    if (conditions.majorCodes?.length) filters.push(`i.MAJOR_CODE IN (${inListRaw(conditions.majorCodes)})`)
    if (conditions.middleCodes?.length) filters.push(`i.MIDDLE_CODE IN (${inListRaw(conditions.middleCodes)})`)
    if (conditions.minorCodes?.length) filters.push(`i.MINOR_CODE IN (${inListRaw(conditions.minorCodes)})`)
    if (conditions.subCodes?.length) filters.push(`i.SUB_CODE IN (${inListRaw(conditions.subCodes)})`)
  }
  if (conditions.member?.enabled) {
    const mParts: string[] = []
    if (conditions.member.genders.length > 0) mParts.push(`m.GENDER IN (${inList(conditions.member.genders)})`)
    if (conditions.member.ageGroups.length > 0) mParts.push(`m.AGE_GROUP IN (${inList(conditions.member.ageGroups)})`)
    if (conditions.member.ranks.length > 0) mParts.push(`m.MEMBER_RANK IN (${inList(conditions.member.ranks)})`)
    if (mParts.length > 0) {
      filters.push(`t.MAJICA_NO IN (SELECT m.MAJICA_NO FROM ${T_MEMBERS} m WHERE ${mParts.join(" AND ")})`)

    }
  }

  const joins: string[] = []
  if (needsItems) joins.push(`JOIN ${T_ITEMS} i ON i.ITEM_CODE = t.ITEM_CODE`)
  if (needsStores) joins.push(`JOIN ${T_STORES} s ON s.STORE_CODE = t.STORE_CODE`)

  return `
SELECT
  SUM(t.ITEM_SALES_AMOUNT) AS total_sales,
  SUM(t.ITEM_SALES_QUANTITY) AS total_quantity,
  COUNT(DISTINCT t.TRADE_KEY) AS total_receipts,
  COUNT(DISTINCT ${codeCol}) AS total_units
FROM ${T_TRADE} t
${joins.join("\n")}
WHERE ${filters.join("\n  AND ")}
`.trim()
}

/** ABC集計SQLを生成 */
export function buildAbcSql(args: AbcQueryArgs): string {
  const { conditions, tab, unit, criteria, period } = args

  // DT can be used when: no member filter, no individual JAN codes
  const memberEnabled = !!(conditions.member?.enabled)
  const hasMinorFilter = !!(conditions.minorCodes?.length)
  const hasSubFilter = !!(conditions.subCodes?.length)

  // Existing DTs: md/major/middle (on original fact, with store granularity)
  const canUseExistingDt = (unit === "md" || unit === "major" || unit === "middle")
    && !hasMinorFilter
    && !hasSubFilter
    && !memberEnabled
    && conditions.itemCodes.length === 0

  if (canUseExistingDt) {
    return buildAbcSqlFromDt(args)
  }

  // Aggregated DT: minor (no member info, on AGG table)
  const canUseAggDt = (unit === "minor")
    && !memberEnabled
    && !hasSubFilter
    && conditions.itemCodes.length === 0

  if (canUseAggDt) {
    return buildAbcSqlFromAggDt(args)
  }

  // Item-level or sub-level without member filter: use AGG fact table (no dedicated sub DT)
  if (!memberEnabled && (unit === "item" || unit === "sub") && conditions.itemCodes.length === 0) {
    return buildAbcSqlFromAggFact(args)
  }

  return buildAbcSqlFromFact(args)
}

/** DT-based ABC SQL (category/store aggregation units — much faster) */
function buildAbcSqlFromDt(args: AbcQueryArgs): string {
  const { conditions, tab, unit, criteria, period } = args
  const start = period === "base" ? conditions.baseStart : conditions.compareStart!
  const end = period === "base" ? conditions.baseEnd : conditions.compareEnd!
  const metricCol = AGG_METRIC_COL[criteria]

  // DT column mappings (DT has flat columns, no alias prefix needed)
  const DT_PRODUCT_UNIT_COLS: Record<string, [string, string]> = {
    md: ["d.MD_CODE", "MAX(d.MD_NAME)"],
    major: ["d.MAJOR_CODE", "MAX(d.MAJOR_NAME)"],
    middle: ["d.MIDDLE_CODE", "MAX(d.MIDDLE_NAME)"],
  }
  const DT_STORE_UNIT_COLS: Record<string, [string, string]> = {
    store: ["d.STORE_CODE", `MAX(s.STORE_NAME)`],
    area: ["s.AREA_CODE", "MAX(s.AREA_NAME)"],
    business_type: ["s.BUSINESS_TYPE_CODE", "MAX(s.BUSINESS_TYPE_NAME)"],
    corporation: ["s.CORPORATION_CODE", "MAX(s.CORPORATION_NAME)"],
    prefecture: ["s.PREFECTURE_CODE", "MAX(s.PREFECTURE_NAME)"],
  }

  const isStoreTab = tab === "store"
  const [codeCol, nameCol] = isStoreTab
    ? DT_STORE_UNIT_COLS[unit] ?? DT_STORE_UNIT_COLS["store"]
    : DT_PRODUCT_UNIT_COLS[unit] ?? DT_PRODUCT_UNIT_COLS["md"]

  // Select DT based on tab, unit, AND active filters:
  // If middleCodes filter is active, we MUST use the middle DT (even for md/major unit)
  // because only it has MIDDLE_CODE to filter on.
  const hasMiddleFilter = !!(conditions.middleCodes?.length)
  const dtTable = T_DT_MIDDLE  // Always use RAP-protected middle-store DT

  // Build WHERE filters for DT
  const filters: string[] = [`d.BUSINESS_DATE BETWEEN '${start}' AND '${end}'`, `d.TRADE_CLASS_3 = '売上'`]
  if (conditions.storeCodes.length > 0) filters.push(`d.STORE_CODE IN (${inList(conditions.storeCodes)})`)
  if (!isStoreTab) {
    if (conditions.mdCodes?.length) filters.push(`d.MD_CODE IN (${inListRaw(conditions.mdCodes)})`)
    if (conditions.majorCodes?.length) filters.push(`d.MAJOR_CODE IN (${inListRaw(conditions.majorCodes)})`)
    if (conditions.middleCodes?.length) filters.push(`d.MIDDLE_CODE IN (${inListRaw(conditions.middleCodes)})`)
  }
  const where = filters.join("\n    AND ")

  // Store tab needs JOIN to stores master for name columns
  const storeJoin = isStoreTab ? `JOIN ${T_STORES} s ON s.STORE_CODE = d.STORE_CODE` : ""

  const extraSelect = isStoreTab && unit === "store"
    ? `, MAX(s.AREA_NAME) AS area_name, MAX(s.BUSINESS_TYPE_NAME) AS business_type_name, MAX(s.CORPORATION_NAME) AS corporation_name, MAX(s.PREFECTURE_NAME) AS prefecture_name`
    : ``

  return `
WITH agg AS (
  SELECT ${codeCol} AS code, ${nameCol} AS name${extraSelect},
         SUM(d.TOTAL_SALES_AMOUNT) AS sales,
         SUM(d.TOTAL_SALES_QUANTITY) AS quantity,
         SUM(d.RECEIPT_COUNT) AS receipt_count
  FROM ${dtTable} d
  ${storeJoin}
  WHERE ${where}
  GROUP BY ${codeCol}
),
ranked AS (
  SELECT agg.*, ${metricCol} AS metric_val
  FROM agg
),
final AS (
  SELECT r.*,
    SUM(metric_val) OVER () AS total_metric,
    SUM(metric_val) OVER (ORDER BY metric_val DESC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cum_metric,
    ROW_NUMBER() OVER (ORDER BY metric_val DESC) AS rank
  FROM ranked r
)
SELECT code, name${extraSelect.replace(/MAX\([^)]*\) AS /g, "")},
  sales, quantity, receipt_count, rank,
  ROUND(100 * metric_val / NULLIF(total_metric,0), 2) AS sales_ratio,
  ROUND(100 * cum_metric / NULLIF(total_metric,0), 2) AS cumulative_ratio,
  CASE WHEN cum_metric / NULLIF(total_metric,0) <= 0.7 THEN 'A'
       WHEN cum_metric / NULLIF(total_metric,0) <= 0.9 THEN 'B' ELSE 'C' END AS abc_class
FROM final
ORDER BY rank
LIMIT 5000
`.trim()
}

/** AGG DT-based ABC SQL for minor (no member info needed) */
function buildAbcSqlFromAggDt(args: AbcQueryArgs): string {
  const { conditions, tab, unit, criteria, period } = args
  const start = period === "base" ? conditions.baseStart : conditions.compareStart!
  const end = period === "base" ? conditions.baseEnd : conditions.compareEnd!
  const metricCol = AGG_METRIC_COL[criteria === "receipt" ? "receipt" : criteria]

  const dtTable = T_DT_AGG_MINOR
  const [codeCol, nameCol] = ["d.MINOR_CODE", "MAX(d.MINOR_NAME)"]

  const filters: string[] = [`d.BUSINESS_DATE BETWEEN '${start}' AND '${end}'`, `d.TRADE_CLASS_3 = '売上'`]
  if (conditions.storeCodes.length > 0) filters.push(`d.STORE_CODE IN (${inList(conditions.storeCodes)})`)
  if (conditions.mdCodes?.length) filters.push(`d.MD_CODE IN (${inListRaw(conditions.mdCodes)})`)
  if (conditions.majorCodes?.length) filters.push(`d.MAJOR_CODE IN (${inListRaw(conditions.majorCodes)})`)
  if (unit === "minor") {
    if (conditions.middleCodes?.length) filters.push(`d.MIDDLE_CODE IN (${inListRaw(conditions.middleCodes)})`)
    if (conditions.minorCodes?.length) filters.push(`d.MINOR_CODE IN (${inListRaw(conditions.minorCodes)})`)
  }

  const extraSelect = unit === "minor"
    ? `, MAX(d.MAJOR_NAME) AS major_name, MAX(d.MIDDLE_NAME) AS middle_name`
    : ``

  return `
WITH agg AS (
  SELECT ${codeCol} AS code, ${nameCol} AS name${extraSelect},
         SUM(d.TOTAL_SALES_AMOUNT) AS sales,
         SUM(d.TOTAL_SALES_QUANTITY) AS quantity,
         SUM(d.RECEIPT_COUNT) AS receipt_count
  FROM ${dtTable} d
  WHERE ${filters.join("\n    AND ")}
  GROUP BY ${codeCol}
),
ranked AS (
  SELECT agg.*, ${metricCol} AS metric_val
  FROM agg
),
final AS (
  SELECT r.*,
    SUM(metric_val) OVER () AS total_metric,
    SUM(metric_val) OVER (ORDER BY metric_val DESC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cum_metric,
    ROW_NUMBER() OVER (ORDER BY metric_val DESC) AS rank
  FROM ranked r
)
SELECT code, name${extraSelect.replace(/MAX\([^)]*\) AS /g, "")},
  sales, quantity, receipt_count, rank,
  ROUND(100 * metric_val / NULLIF(total_metric,0), 2) AS sales_ratio,
  ROUND(100 * cum_metric / NULLIF(total_metric,0), 2) AS cumulative_ratio,
  CASE WHEN cum_metric / NULLIF(total_metric,0) <= 0.7 THEN 'A'
       WHEN cum_metric / NULLIF(total_metric,0) <= 0.9 THEN 'B' ELSE 'C' END AS abc_class
FROM final
ORDER BY rank
LIMIT 5000
`.trim()
}

/** AGG fact table ABC SQL for item-level or sub-level without member filter */
function buildAbcSqlFromAggFact(args: AbcQueryArgs): string {
  const { conditions, unit, criteria, period } = args
  const start = period === "base" ? conditions.baseStart : conditions.compareStart!
  const end = period === "base" ? conditions.baseEnd : conditions.compareEnd!
  const metricCol = AGG_METRIC_COL[criteria === "receipt" ? "receipt" : criteria]

  const filters: string[] = [`t.BUSINESS_DATE BETWEEN ${dateLit(start)} AND ${dateLit(end)}`, `t.TRADE_CLASS_3 = '売上'`]
  if (conditions.storeCodes.length > 0) filters.push(`t.STORE_CODE IN (${inList(conditions.storeCodes)})`)
  if (conditions.categoryClass) filters.push(`i.ITEM_CATEGORY_CLASS = ${lit(conditions.categoryClass)}`)
  if (conditions.mdCodes?.length) filters.push(`i.MD_CODE IN (${inListRaw(conditions.mdCodes)})`)
  if (conditions.majorCodes?.length) filters.push(`i.MAJOR_CODE IN (${inListRaw(conditions.majorCodes)})`)
  if (conditions.middleCodes?.length) filters.push(`i.MIDDLE_CODE IN (${inListRaw(conditions.middleCodes)})`)
  if (conditions.minorCodes?.length) filters.push(`i.MINOR_CODE IN (${inListRaw(conditions.minorCodes)})`)
  if (conditions.subCodes?.length) filters.push(`i.SUB_CODE IN (${inListRaw(conditions.subCodes)})`)

  // Grouping unit: item (default) or sub
  const isSub = unit === "sub"
  const groupCol = isSub ? "i.SUB_CODE" : "t.ITEM_CODE"
  const nameCol = isSub ? "MAX(i.SUB_NAME)" : "MAX(i.ITEM_NAME)"
  const extraSelect = isSub
    ? `MAX(i.MAJOR_NAME) AS major_name, MAX(i.MIDDLE_NAME) AS middle_name, MAX(i.MINOR_NAME) AS minor_name`
    : `MAX(i.MAJOR_NAME) AS major_name, MAX(i.MIDDLE_NAME) AS middle_name, MAX(i.MINOR_NAME) AS minor_name, MAX(i.BRAND_NAME) AS brand_name`
  const finalExtra = isSub
    ? `major_name, middle_name, minor_name`
    : `major_name, middle_name, minor_name, brand_name`

  return `
WITH agg AS (
  SELECT ${groupCol} AS code, ${nameCol} AS name,
         ${extraSelect},
         SUM(t.ITEM_SALES_AMOUNT) AS sales,
         SUM(t.ITEM_SALES_QUANTITY) AS quantity,
         SUM(t.RECEIPT_COUNT) AS receipt_count
  FROM ${T_TRADE_AGG} t
  JOIN ${T_ITEMS} i ON i.ITEM_CODE = t.ITEM_CODE
  WHERE ${filters.join("\n    AND ")}
  GROUP BY ${groupCol}
),
ranked AS (
  SELECT agg.*, ${metricCol} AS metric_val
  FROM agg
),
final AS (
  SELECT r.*,
    SUM(metric_val) OVER () AS total_metric,
    SUM(metric_val) OVER (ORDER BY metric_val DESC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cum_metric,
    ROW_NUMBER() OVER (ORDER BY metric_val DESC) AS rank
  FROM ranked r
)
SELECT code, name, ${finalExtra},
  sales, quantity, receipt_count, rank,
  ROUND(100 * metric_val / NULLIF(total_metric,0), 2) AS sales_ratio,
  ROUND(100 * cum_metric / NULLIF(total_metric,0), 2) AS cumulative_ratio,
  CASE WHEN cum_metric / NULLIF(total_metric,0) <= 0.7 THEN 'A'
       WHEN cum_metric / NULLIF(total_metric,0) <= 0.9 THEN 'B' ELSE 'C' END AS abc_class
FROM final
ORDER BY rank
LIMIT 5000
`.trim()
}

/** Fact-table-based ABC SQL (item-level or with member/JAN filters) */
function buildAbcSqlFromFact(args: AbcQueryArgs): string {
  const { conditions, tab, unit, criteria, period } = args
  const start = period === "base" ? conditions.baseStart : conditions.compareStart!
  const end = period === "base" ? conditions.baseEnd : conditions.compareEnd!

  const metricCol = AGG_METRIC_COL[criteria]

  // Determine which JOINs are actually needed
  const needsItems = tab === "product" // product tab always needs items for code/name
    || !!(conditions.mdCodes?.length) || !!(conditions.majorCodes?.length)
    || !!(conditions.middleCodes?.length) || !!(conditions.minorCodes?.length)
    || !!(conditions.subCodes?.length)
    || !!(conditions.categoryClass)
  const needsStores = tab === "store" && unit !== "store" // store unit uses t.STORE_CODE directly
  const needsStoresForName = tab === "store" && unit === "store" // need store name

  // Build WHERE directly on fact table
  const filters: string[] = [`t.BUSINESS_DATE BETWEEN ${dateLit(start)} AND ${dateLit(end)}`, `t.TRADE_CLASS_3 = '売上'`]
  if (conditions.storeCodes.length > 0) filters.push(`t.STORE_CODE IN (${inList(conditions.storeCodes)})`)
  if (conditions.itemCodes.length > 0) filters.push(`t.ITEM_CODE IN (${inList(conditions.itemCodes)})`)
  if (needsItems) {
    if (conditions.categoryClass) filters.push(`i.ITEM_CATEGORY_CLASS = ${lit(conditions.categoryClass)}`)
    if (conditions.mdCodes && conditions.mdCodes.length > 0) filters.push(`i.MD_CODE IN (${inListRaw(conditions.mdCodes)})`)
    if (conditions.majorCodes && conditions.majorCodes.length > 0) filters.push(`i.MAJOR_CODE IN (${inListRaw(conditions.majorCodes)})`)
    if (conditions.middleCodes && conditions.middleCodes.length > 0) filters.push(`i.MIDDLE_CODE IN (${inListRaw(conditions.middleCodes)})`)
    if (conditions.minorCodes && conditions.minorCodes.length > 0) filters.push(`i.MINOR_CODE IN (${inListRaw(conditions.minorCodes)})`)
    if (conditions.subCodes && conditions.subCodes.length > 0) filters.push(`i.SUB_CODE IN (${inListRaw(conditions.subCodes)})`)
  }

  // Member filter subquery
  if (conditions.member?.enabled) {
    const mParts: string[] = []
    if (conditions.member.genders.length > 0) mParts.push(`m.GENDER IN (${inList(conditions.member.genders)})`)
    if (conditions.member.ageGroups.length > 0) mParts.push(`m.AGE_GROUP IN (${inList(conditions.member.ageGroups)})`)
    if (conditions.member.ranks.length > 0) mParts.push(`m.MEMBER_RANK IN (${inList(conditions.member.ranks)})`)
    if (mParts.length > 0) {
      filters.push(`t.MAJICA_NO IN (SELECT m.MAJICA_NO FROM ${T_MEMBERS} m WHERE ${mParts.join(" AND ")})`)
    }
  }

  // Code/name columns
  const [codeCol, nameCol] =
    tab === "product"
      ? PRODUCT_UNIT_COLS[unit as ProductUnit]
      : STORE_UNIT_COLS[unit as StoreUnit]

  // Extra columns for detail display
  const extraSelect =
    tab === "product" && unit === "item"
      ? `, MAX(i.MAJOR_NAME) AS major_name, MAX(i.MIDDLE_NAME) AS middle_name, MAX(i.MINOR_NAME) AS minor_name, MAX(i.BRAND_NAME) AS brand_name`
      : tab === "product" && unit === "sub"
        ? `, MAX(i.MAJOR_NAME) AS major_name, MAX(i.MIDDLE_NAME) AS middle_name, MAX(i.MINOR_NAME) AS minor_name`
        : tab === "store" && unit === "store"
          ? `, MAX(s.AREA_NAME) AS area_name, MAX(s.BUSINESS_TYPE_NAME) AS business_type_name, MAX(s.CORPORATION_NAME) AS corporation_name, MAX(s.PREFECTURE_NAME) AS prefecture_name`
          : ``

  // Build JOIN clause — only what's needed
  const joins: string[] = []
  if (needsItems) joins.push(`JOIN ${T_ITEMS} i ON i.ITEM_CODE = t.ITEM_CODE`)
  if (needsStores || needsStoresForName) joins.push(`JOIN ${T_STORES} s ON s.STORE_CODE = t.STORE_CODE`)

  return `
WITH agg AS (
  SELECT ${codeCol} AS code, ${nameCol} AS name${extraSelect},
         SUM(t.ITEM_SALES_AMOUNT) AS sales,
         SUM(t.ITEM_SALES_QUANTITY) AS quantity,
         COUNT(DISTINCT t.TRADE_KEY) AS receipt_count
  FROM ${T_TRADE} t
  ${joins.join("\n  ")}
  WHERE ${filters.join("\n    AND ")}
  GROUP BY ${codeCol}
),
ranked AS (
  SELECT agg.*, ${metricCol} AS metric_val
  FROM agg
),
final AS (
  SELECT r.*,
    SUM(metric_val) OVER () AS total_metric,
    SUM(metric_val) OVER (ORDER BY metric_val DESC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cum_metric,
    ROW_NUMBER() OVER (ORDER BY metric_val DESC) AS rank
  FROM ranked r
)
SELECT code, name${extraSelect.replace(/MAX\([^)]*\) AS /g, "")},
  sales, quantity, receipt_count, rank,
  ROUND(100 * metric_val / NULLIF(total_metric,0), 2) AS sales_ratio,
  ROUND(100 * cum_metric / NULLIF(total_metric,0), 2) AS cumulative_ratio,
  CASE WHEN cum_metric / NULLIF(total_metric,0) <= 0.7 THEN 'A'
       WHEN cum_metric / NULLIF(total_metric,0) <= 0.9 THEN 'B' ELSE 'C' END AS abc_class
FROM final
ORDER BY rank
LIMIT 5000
`.trim()
}

// ---- マスタ系クエリ ----
export function storesQuery(): string {
  return `SELECT STORE_CODE AS store_code, STORE_NAME AS store_name,
    CORPORATION_CODE AS corporation_code, CORPORATION_NAME AS corporation_name,
    BUSINESS_TYPE_NAME AS business_type_name, AREA_NAME AS area_name, PREFECTURE_NAME AS prefecture_name
    FROM ${T_STORES} ORDER BY STORE_CODE`
}
export function itemsQuery(): string {
  return `SELECT ITEM_CODE AS item_code, ITEM_NAME AS item_name,
    MAJOR_NAME AS major_name, MIDDLE_NAME AS middle_name, MINOR_NAME AS minor_name,
    BRAND_NAME AS brand_name, MAKER_NAME AS maker_name
    FROM ${T_ITEMS} ORDER BY MAJOR_CODE, MIDDLE_CODE, MINOR_CODE, BRAND_CODE, ITEM_CODE`
}
export function memberFacetsQuery(): string {
  return `SELECT
    ARRAY_AGG(DISTINCT GENDER) WITHIN GROUP (ORDER BY GENDER) AS genders,
    ARRAY_AGG(DISTINCT AGE_GROUP) WITHIN GROUP (ORDER BY AGE_GROUP) AS age_groups,
    ARRAY_AGG(DISTINCT MEMBER_RANK) WITHIN GROUP (ORDER BY MEMBER_RANK) AS ranks
    FROM ${T_MEMBERS}`
}

// ---- 設定画面クエリ ----
export function accountsQuery(): string {
  return `SELECT a.ACCOUNT_ID, a.ACCOUNT_NAME, a.ACCOUNT_NAME AS COMPANY_NAME,
    'メーカー' AS INDUSTRY, '' AS PREFECTURE, 
    CASE a.CONTRACT_STATUS WHEN 'ACTIVE' THEN '稼働中' WHEN 'SUSPENDED' THEN '停止中' ELSE '承認待ち' END AS STATUS,
    (SELECT COUNT(*) FROM ${DB}.APP_CONFIG.APP_USERS u WHERE u.ACCOUNT_ID = a.ACCOUNT_ID) AS USER_COUNT,
    0 AS CATEGORY_COUNT, 0 AS STORE_COUNT,
    COALESCE((SELECT SUM(c.CREDITS_USED) FROM ${DB}.APP_CONFIG.CREDIT_USAGE c WHERE c.ACCOUNT_ID = a.ACCOUNT_ID), 0) AS CREDITS_USED,
    a.MONTHLY_CREDIT_LIMIT AS CREDIT_LIMIT,
    '' AS LAST_LOGIN, TO_VARCHAR(a.CREATED_AT,'YYYY-MM-DD') AS CREATED_AT,
    'SSO' AS AUTH_METHOD, '1.0' AS APP_VERSION
    FROM ${DB}.APP_CONFIG.ACCOUNTS a ORDER BY CREDITS_USED DESC`
}
export function usersQuery(): string {
  return `SELECT u.USER_ID, u.ACCOUNT_ID, u.USER_NAME, u.USER_EMAIL AS EMAIL,
    u.ROLE AS AUTH_METHOD, '' AS IDP, COALESCE(TO_VARCHAR(u.LAST_LOGIN_AT,'YYYY-MM-DD HH24:MI'),'') AS LAST_LOGIN,
    CASE WHEN u.IS_ACTIVE THEN '有効' ELSE '無効' END AS STATUS, a.ACCOUNT_NAME AS COMPANY_NAME
    FROM ${DB}.APP_CONFIG.APP_USERS u JOIN ${DB}.APP_CONFIG.ACCOUNTS a ON a.ACCOUNT_ID=u.ACCOUNT_ID
    ORDER BY u.ACCOUNT_ID, u.USER_ID`
}
export function creditTrendQuery(): string {
  return `SELECT USAGE_MONTH,
    SUM(CREDITS_USED) AS COMPUTE_CREDITS, 0 AS STORAGE_CREDITS, 0 AS SERVERLESS_CREDITS
    FROM ${DB}.APP_CONFIG.CREDIT_USAGE GROUP BY USAGE_MONTH ORDER BY USAGE_MONTH`
}
/** アカウント別の開示カテゴリ（中分類） */
export function disclosureQuery(accountId: string): string {
  return `SELECT DISTINCT MIDDLE_CODE, MIDDLE_NAME
    FROM ${DB}.ACCESS_CONTROL.USER_CATEGORY_RELATION WHERE ACCOUNT_ID = ${lit(accountId)} AND IS_PERMITTED = TRUE`
}
/** 全中分類マスタ（開示制御のカテゴリ一覧用） */
export function allCategoriesQuery(): string {
  return `SELECT DISTINCT MIDDLE_CODE, MIDDLE_NAME, ITEM_CATEGORY_CLASS AS MAJOR_NAME
    FROM ${DB}.ACCESS_CONTROL.USER_CATEGORY_RELATION ORDER BY MIDDLE_CODE`
}
