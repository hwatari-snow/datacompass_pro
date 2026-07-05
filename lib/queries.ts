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
/** 日付バリデーション (YYYY-MM-DD) */
function dateLit(v: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error(`invalid date: ${v}`)
  return `'${v}'`
}

const T_TRADE = `${DB}.ANALYTICS.TABLEAU_I_ABC_TRADE`
const T_ITEMS = `${DB}.MASTER.DATAMART_COMMON_ITEMS`
const T_STORES = `${DB}.MASTER.DATAMART_COMMON_STORES`
const T_MEMBERS = `${DB}.MASTER.DATAMART_COMMON_MEMBERS`

// 集計単位 → (コード列, 名称列)
const PRODUCT_UNIT_COLS: Record<ProductUnit, [string, string]> = {
  item: ["t.ITEM_CODE", "MAX(i.ITEM_NAME)"],
  md: ["i.MD_CODE", "MAX(i.MD_NAME)"],
  major: ["i.MAJOR_CODE", "MAX(i.MAJOR_NAME)"],
  middle: ["i.MIDDLE_CODE", "MAX(i.MIDDLE_NAME)"],
  minor: ["i.MINOR_CODE", "MAX(i.MINOR_NAME)"],
  brand: ["i.BRAND_CODE", "MAX(i.BRAND_NAME)"],
  maker: ["i.MAKER_CODE", "MAX(i.MAKER_NAME)"],
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
  if (c.mdCodes && c.mdCodes.length > 0) parts.push(`i.MD_CODE IN (${inList(c.mdCodes)})`)
  if (c.majorCodes && c.majorCodes.length > 0) parts.push(`i.MAJOR_CODE IN (${inList(c.majorCodes)})`)
  if (c.middleCodes && c.middleCodes.length > 0) parts.push(`i.MIDDLE_CODE IN (${inList(c.middleCodes)})`)
  if (c.minorCodes && c.minorCodes.length > 0) parts.push(`i.MINOR_CODE IN (${inList(c.minorCodes)})`)
  if (c.makerCodes && c.makerCodes.length > 0) parts.push(`i.MAKER_CODE IN (${inList(c.makerCodes)})`)

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
  const [codeCol] =
    tab === "product" ? PRODUCT_UNIT_COLS[unit as ProductUnit] : STORE_UNIT_COLS[unit as StoreUnit]
  const where = buildFilters(conditions, start, end)
  return `
SELECT
  SUM(t.ITEM_SALES_AMOUNT) AS total_sales,
  SUM(t.ITEM_SALES_QUANTITY) AS total_quantity,
  COUNT(DISTINCT t.TRADE_KEY) AS total_receipts,
  COUNT(DISTINCT ${codeCol}) AS total_units
FROM ${T_TRADE} t
JOIN ${T_ITEMS} i ON i.ITEM_CODE = t.ITEM_CODE
JOIN ${T_STORES} s ON s.STORE_CODE = t.STORE_CODE
WHERE ${where}
`.trim()
}

/** ABC集計SQLを生成 */
export function buildAbcSql(args: AbcQueryArgs): string {
  const { conditions, tab, unit, criteria, period } = args
  const start = period === "base" ? conditions.baseStart : conditions.compareStart!
  const end = period === "base" ? conditions.baseEnd : conditions.compareEnd!

  const [codeCol, nameCol] =
    tab === "product"
      ? PRODUCT_UNIT_COLS[unit as ProductUnit]
      : STORE_UNIT_COLS[unit as StoreUnit]
  const metricCol = AGG_METRIC_COL[criteria]
  const where = buildFilters(conditions, start, end)

  // 商品タブの item 単位ではカテゴリ列も返す
  const extraSelect =
    tab === "product" && unit === "item"
      ? `, MAX(i.MAJOR_NAME) AS major_name, MAX(i.MIDDLE_NAME) AS middle_name, MAX(i.MINOR_NAME) AS minor_name, MAX(i.BRAND_NAME) AS brand_name`
      : tab === "store" && unit === "store"
        ? `, MAX(s.AREA_NAME) AS area_name, MAX(s.BUSINESS_TYPE_NAME) AS business_type_name, MAX(s.CORPORATION_NAME) AS corporation_name, MAX(s.PREFECTURE_NAME) AS prefecture_name`
        : ``

  return `
WITH base_trades AS (
  SELECT t.TRADE_KEY, t.ITEM_CODE, t.STORE_CODE, t.MAJICA_NO,
         t.ITEM_SALES_AMOUNT, t.ITEM_SALES_QUANTITY,
         i.MAJOR_CODE, i.MAJOR_NAME, i.MIDDLE_CODE, i.MIDDLE_NAME, i.MINOR_CODE, i.MINOR_NAME, i.BRAND_CODE, i.BRAND_NAME, i.ITEM_NAME,
         s.STORE_NAME, s.AREA_CODE, s.AREA_NAME, s.BUSINESS_TYPE_CODE, s.BUSINESS_TYPE_NAME,
         s.CORPORATION_CODE, s.CORPORATION_NAME, s.PREFECTURE_CODE, s.PREFECTURE_NAME
  FROM ${T_TRADE} t
  JOIN ${T_ITEMS} i ON i.ITEM_CODE = t.ITEM_CODE
  JOIN ${T_STORES} s ON s.STORE_CODE = t.STORE_CODE
  WHERE ${where}
),
agg AS (
  SELECT ${codeCol} AS code, ${nameCol} AS name${extraSelect},
         SUM(t.ITEM_SALES_AMOUNT) AS sales,
         SUM(t.ITEM_SALES_QUANTITY) AS quantity,
         COUNT(DISTINCT t.TRADE_KEY) AS receipt_count
  FROM base_trades t
  JOIN ${T_ITEMS} i ON i.ITEM_CODE = t.ITEM_CODE
  JOIN ${T_STORES} s ON s.STORE_CODE = t.STORE_CODE
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
  return `SELECT ACCOUNT_ID AS account_id, ACCOUNT_NAME AS account_name, COMPANY_NAME AS company_name,
    INDUSTRY AS industry, PREFECTURE AS prefecture, STATUS AS status, USER_COUNT AS user_count,
    CATEGORY_COUNT AS category_count, STORE_COUNT AS store_count, CREDITS_USED AS credits_used,
    CREDIT_LIMIT AS credit_limit, TO_VARCHAR(LAST_LOGIN,'YYYY-MM-DD HH24:MI') AS last_login,
    TO_VARCHAR(CREATED_AT,'YYYY-MM-DD') AS created_at, AUTH_METHOD AS auth_method, APP_VERSION AS app_version
    FROM ${DB}.APP_CONFIG.ACCOUNTS ORDER BY CREDITS_USED DESC`
}
export function usersQuery(): string {
  return `SELECT u.USER_ID AS user_id, u.ACCOUNT_ID AS account_id, u.USER_NAME AS user_name, u.EMAIL AS email,
    u.AUTH_METHOD AS auth_method, u.IDP AS idp, TO_VARCHAR(u.LAST_LOGIN,'YYYY-MM-DD HH24:MI') AS last_login,
    u.STATUS AS status, a.COMPANY_NAME AS company_name
    FROM ${DB}.APP_CONFIG.APP_USERS u JOIN ${DB}.APP_CONFIG.ACCOUNTS a ON a.ACCOUNT_ID=u.ACCOUNT_ID
    ORDER BY u.ACCOUNT_ID, u.USER_ID`
}
export function creditTrendQuery(): string {
  return `SELECT TO_VARCHAR(USAGE_MONTH,'YYYY-MM') AS usage_month,
    SUM(COMPUTE_CREDITS) AS compute_credits, SUM(STORAGE_CREDITS) AS storage_credits,
    SUM(SERVERLESS_CREDITS) AS serverless_credits
    FROM ${DB}.APP_CONFIG.CREDIT_USAGE GROUP BY USAGE_MONTH ORDER BY USAGE_MONTH`
}
/** アカウント別の開示カテゴリ（中分類） */
export function disclosureQuery(accountId: string): string {
  return `SELECT MIDDLE_CODE AS middle_code, MINOR_CODE AS minor_code
    FROM ${DB}.ACCESS_CONTROL.USER_CATEGORY_RELATION WHERE USER_ID = ${lit(accountId)}`
}
/** 全中分類マスタ（開示制御のカテゴリ一覧用） */
export function allCategoriesQuery(): string {
  return `SELECT DISTINCT MIDDLE_CODE AS middle_code, MIDDLE_NAME AS middle_name, MAJOR_NAME AS major_name
    FROM ${T_ITEMS} ORDER BY MIDDLE_CODE`
}
