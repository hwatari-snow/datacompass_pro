import { NextResponse } from "next/server"
import { querySnowflake } from "@/lib/snowflake"
import { DB } from "@/lib/constants"

export const dynamic = "force-dynamic"
export const maxDuration = 300

const T_DT_STORE = `${DB}.ANALYTICS.DT_DAILY_MIDDLE_STORE`
const T_DT_MEMBER = `${DB}.ANALYTICS.DT_MEMBER_CATEGORY_DAILY`
const T_DT_MEMBER_ITEM = `${DB}.ANALYTICS.DT_MEMBER_ITEM_DAILY`
const T_DT_MEMBER_CAT = `${DB}.ANALYTICS.DT_MEMBER_CATEGORY_DAILY`
const T_MEMBERS = `${DB}.MASTER.DATAMART_COMMON_MEMBERS`
const T_STORES = `${DB}.MASTER.DATAMART_COMMON_STORES`
const T_ITEMS = `${DB}.MASTER.DATAMART_COMMON_ITEMS`

function sanitize(s: string): string {
  return s.replace(/'/g, "''")
}
function inList(codes: string[]): string {
  return codes.map((c) => `'${sanitize(c)}'`).join(",")
}
/** Strip composite prefix (e.g. "DS_01" -> "01") for category codes */
function stripPrefix(codes: string[]): string[] {
  return codes.map((c) => { const idx = c.indexOf("_"); return idx >= 0 ? c.substring(idx + 1) : c })
}
function inListRaw(codes: string[]): string {
  return stripPrefix(codes).map((c) => `'${sanitize(c)}'`).join(",")
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get("type") ?? "age_gender"
  const baseStart = searchParams.get("baseStart") ?? ""
  const baseEnd = searchParams.get("baseEnd") ?? ""
  const storeCodes = (searchParams.get("storeCodes") ?? "").split(",").filter(Boolean)
  const mdCodes = (searchParams.get("mdCodes") ?? "").split(",").filter(Boolean)
  const majorCodes = (searchParams.get("majorCodes") ?? "").split(",").filter(Boolean)
  const middleCodes = (searchParams.get("middleCodes") ?? "").split(",").filter(Boolean)

  const hasProductFilter = mdCodes.length > 0 || majorCodes.length > 0 || middleCodes.length > 0

  const dateFilter = baseStart && baseEnd
    ? `d.BUSINESS_DATE BETWEEN '${sanitize(baseStart)}' AND '${sanitize(baseEnd)}'`
    : `d.BUSINESS_DATE >= DATEADD('month', -3, CURRENT_DATE())`

  const storeFilter = storeCodes.length > 0
    ? `AND d.STORE_CODE IN (${inList(storeCodes)})`
    : ""

  // Product filter (uses DT_MEMBER_CATEGORY_DAILY directly — no items JOIN needed)
  const buildCatFilter = () => {
    const parts: string[] = []
    if (mdCodes.length > 0) parts.push(`d.MD_CODE IN (${inListRaw(mdCodes)})`)
    if (majorCodes.length > 0) parts.push(`d.MAJOR_CODE IN (${inListRaw(majorCodes)})`)
    if (middleCodes.length > 0) parts.push(`d.MIDDLE_CODE IN (${inListRaw(middleCodes)})`)
    return parts.length > 0 ? `AND ${parts.join(" AND ")}` : ""
  }

  try {
    let rows: Record<string, unknown>[]

    switch (type) {
      case "summary":
        if (hasProductFilter) {
          rows = await querySnowflake(`
            SELECT
              COUNT(DISTINCT d.MAJICA_NO) AS active_members,
              SUM(d.TOTAL_SALES) AS total_sales,
              SUM(d.RECEIPT_COUNT) AS total_transactions,
              ROUND(SUM(d.TOTAL_SALES) / NULLIF(SUM(d.RECEIPT_COUNT), 0), 0) AS avg_basket,
              ROUND(SUM(d.TOTAL_QUANTITY) / NULLIF(SUM(d.RECEIPT_COUNT), 0), 1) AS avg_items,
              (SELECT COUNT(*) FROM ${T_MEMBERS}) AS total_members
            FROM ${T_DT_MEMBER_CAT} d
            WHERE ${dateFilter} ${storeFilter} ${buildCatFilter()}
          `, { callersRights: true })
        } else {
          rows = await querySnowflake(`
            SELECT
              SUM(d.MEMBER_COUNT) AS active_members,
              SUM(d.TOTAL_SALES_AMOUNT) AS total_sales,
              SUM(d.RECEIPT_COUNT) AS total_transactions,
              ROUND(SUM(d.TOTAL_SALES_AMOUNT) / NULLIF(SUM(d.RECEIPT_COUNT), 0), 0) AS avg_basket,
              ROUND(SUM(d.TOTAL_SALES_QUANTITY) / NULLIF(SUM(d.RECEIPT_COUNT), 0), 1) AS avg_items,
              (SELECT COUNT(*) FROM ${T_MEMBERS}) AS total_members
            FROM ${T_DT_STORE} d
            WHERE ${dateFilter} ${storeFilter}
              AND d.TRADE_CLASS_3 = '売上'
          `, { callersRights: true })
        }
        break

      case "age_gender":
        if (hasProductFilter) {
          rows = await querySnowflake(`
            WITH member_stats AS (
              SELECT
                m.AGE_GROUP,
                m.GENDER,
                d.MAJICA_NO,
                COUNT(DISTINCT d.BUSINESS_DATE) AS purchase_days,
                SUM(d.TOTAL_SALES) AS total_spend,
                SUM(d.RECEIPT_COUNT) AS txn_count
              FROM ${T_DT_MEMBER_CAT} d
              JOIN ${T_MEMBERS} m ON m.MAJICA_NO = d.MAJICA_NO
              WHERE ${dateFilter} ${storeFilter} ${buildCatFilter()}
              GROUP BY m.AGE_GROUP, m.GENDER, d.MAJICA_NO
            )
            SELECT
              AGE_GROUP, GENDER,
              COUNT(*) AS buyers,
              SUM(total_spend) AS total_sales,
              ROUND(AVG(total_spend), 0) AS avg_spend,
              ROUND(AVG(purchase_days), 1) AS avg_frequency,
              SUM(CASE WHEN purchase_days >= 2 THEN 1 ELSE 0 END) AS repeaters
            FROM member_stats
            GROUP BY AGE_GROUP, GENDER
            ORDER BY AGE_GROUP, GENDER
          `, { callersRights: true })
        } else {
          rows = await querySnowflake(`
            WITH member_stats AS (
              SELECT
                m.AGE_GROUP,
                m.GENDER,
                d.MAJICA_NO,
                COUNT(DISTINCT d.BUSINESS_DATE) AS purchase_days,
                SUM(d.TOTAL_SALES) AS total_spend,
                SUM(d.RECEIPT_COUNT) AS txn_count
              FROM ${T_DT_MEMBER} d
              JOIN ${T_MEMBERS} m ON m.MAJICA_NO = d.MAJICA_NO
              WHERE ${dateFilter} ${storeFilter}
              GROUP BY m.AGE_GROUP, m.GENDER, d.MAJICA_NO
            )
            SELECT
              AGE_GROUP, GENDER,
              COUNT(*) AS buyers,
              SUM(total_spend) AS total_sales,
              ROUND(AVG(total_spend), 0) AS avg_spend,
              ROUND(AVG(purchase_days), 1) AS avg_frequency,
              SUM(CASE WHEN purchase_days >= 2 THEN 1 ELSE 0 END) AS repeaters
            FROM member_stats
            GROUP BY AGE_GROUP, GENDER
            ORDER BY AGE_GROUP, GENDER
          `, { callersRights: true })
        }
        break

      case "area":
        rows = await querySnowflake(`
          SELECT
            s.AREA_NAME,
            COUNT(DISTINCT d.STORE_CODE) AS store_count,
            SUM(d.TOTAL_SALES_AMOUNT) AS total_sales,
            SUM(d.RECEIPT_COUNT) AS transactions,
            SUM(d.MEMBER_COUNT) AS buyers,
            ROUND(SUM(d.TOTAL_SALES_AMOUNT) / NULLIF(SUM(d.RECEIPT_COUNT), 0), 0) AS avg_basket
          FROM ${T_DT_STORE} d
          JOIN ${T_STORES} s ON s.STORE_CODE = d.STORE_CODE
          WHERE ${dateFilter} ${storeFilter}
            AND d.TRADE_CLASS_3 = '売上'
          GROUP BY s.AREA_NAME
          ORDER BY total_sales DESC
        `, { callersRights: true })
        break

      case "behavior":
        rows = await querySnowflake(`
          SELECT
            DAYOFWEEK(d.BUSINESS_DATE) AS day_of_week,
            SUM(d.TOTAL_SALES_AMOUNT) AS total_sales,
            SUM(d.RECEIPT_COUNT) AS transactions,
            SUM(d.MEMBER_COUNT) AS buyers
          FROM ${T_DT_STORE} d
          WHERE ${dateFilter} ${storeFilter}
            AND d.TRADE_CLASS_3 = '売上'
          GROUP BY day_of_week
          ORDER BY day_of_week
        `, { callersRights: true })
        break

      case "trial_repeat":
        if (hasProductFilter) {
          rows = await querySnowflake(`
            WITH member_freq AS (
              SELECT
                d.MAJICA_NO,
                COUNT(DISTINCT d.BUSINESS_DATE) AS purchase_days,
                SUM(d.TOTAL_SALES) AS total_sales
              FROM ${T_DT_MEMBER_CAT} d
              WHERE ${dateFilter} ${storeFilter} ${buildCatFilter()}
              GROUP BY d.MAJICA_NO
            )
            SELECT
              purchase_days AS count,
              COUNT(*) AS buyers,
              SUM(total_sales) AS sales,
              ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) AS share,
              ROUND(SUM(total_sales) * 100.0 / SUM(SUM(total_sales)) OVER (), 1) AS sales_share
            FROM member_freq
            WHERE purchase_days <= 10
            GROUP BY purchase_days
            UNION ALL
            SELECT
              11 AS count,
              COUNT(*) AS buyers,
              SUM(total_sales) AS sales,
              ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM member_freq), 1) AS share,
              ROUND(SUM(total_sales) * 100.0 / (SELECT SUM(total_sales) FROM member_freq), 1) AS sales_share
            FROM member_freq
            WHERE purchase_days > 10
            ORDER BY count
          `, { callersRights: true })
        } else {
          rows = await querySnowflake(`
            WITH member_freq AS (
              SELECT
                d.MAJICA_NO,
                COUNT(DISTINCT d.BUSINESS_DATE) AS purchase_days,
                SUM(d.TOTAL_SALES) AS total_sales
              FROM ${T_DT_MEMBER} d
              WHERE ${dateFilter} ${storeFilter}
              GROUP BY d.MAJICA_NO
            )
            SELECT
              purchase_days AS count,
              COUNT(*) AS buyers,
              SUM(total_sales) AS sales,
              ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) AS share,
              ROUND(SUM(total_sales) * 100.0 / SUM(SUM(total_sales)) OVER (), 1) AS sales_share
            FROM member_freq
            WHERE purchase_days <= 10
            GROUP BY purchase_days
            UNION ALL
            SELECT
              11 AS count,
              COUNT(*) AS buyers,
              SUM(total_sales) AS sales,
              ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM member_freq), 1) AS share,
              ROUND(SUM(total_sales) * 100.0 / (SELECT SUM(total_sales) FROM member_freq), 1) AS sales_share
            FROM member_freq
            WHERE purchase_days > 10
            ORDER BY count
          `, { callersRights: true })
        }
        break

      default:
        return NextResponse.json({ error: "Invalid type parameter" }, { status: 400 })
    }

    return NextResponse.json({ type, data: rows })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error(new Date().toISOString(), "[api/analysis]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
