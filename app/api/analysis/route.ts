import { NextResponse } from "next/server"
import { querySnowflake } from "@/lib/snowflake"
import { DB } from "@/lib/constants"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get("type") ?? "age_gender"
  const category = searchParams.get("category") ?? ""
  const area = searchParams.get("area") ?? ""
  const baseStart = searchParams.get("baseStart") ?? ""
  const baseEnd = searchParams.get("baseEnd") ?? ""
  const storeCodes = searchParams.get("storeCodes") ?? ""
  const itemCodes = searchParams.get("itemCodes") ?? ""

  const joins: string[] = []
  const filters: string[] = []

  // Global conditions
  if (baseStart && baseEnd) {
    filters.push(`t.BUSINESS_DATE BETWEEN '${baseStart.replace(/'/g, "''")}' AND '${baseEnd.replace(/'/g, "''")}'`)
  }
  if (storeCodes) {
    const codes = storeCodes.split(",").map((c) => `'${c.replace(/'/g, "''")}'`).join(",")
    filters.push(`t.STORE_CODE IN (${codes})`)
  }
  if (itemCodes) {
    const codes = itemCodes.split(",").map((c) => `'${c.replace(/'/g, "''")}'`).join(",")
    filters.push(`t.ITEM_CODE IN (${codes})`)
  }

  if (category) {
    joins.push(`JOIN ${DB}.MASTER.DATAMART_COMMON_ITEMS p ON t.ITEM_CODE = p.ITEM_CODE`)
    filters.push(`p.MD_NAME = '${category.replace(/'/g, "''")}'`)
  }
  if (area) {
    if (!type.includes("area")) {
      joins.push(`JOIN ${DB}.MASTER.DATAMART_COMMON_STORES s ON t.STORE_CODE = s.STORE_CODE`)
    }
    filters.push(`s.AREA_NAME = '${area.replace(/'/g, "''")}'`)
  }

  const filterClause = filters.length > 0 ? `AND ${filters.join(" AND ")}` : ""

  try {
    let rows: Record<string, unknown>[]

    switch (type) {
      case "age_gender":
        rows = await querySnowflake(`
          WITH member_stats AS (
            SELECT
              m.AGE_GROUP,
              m.GENDER,
              m.MAJICA_NO,
              COUNT(DISTINCT t.BUSINESS_DATE) AS purchase_days,
              SUM(t.ITEM_SALES_AMOUNT) AS total_spend,
              COUNT(DISTINCT t.TRADE_KEY) AS txn_count
            FROM ${DB}.ANALYTICS.IS_POS_TRANSACTION t
            JOIN ${DB}.MASTER.DATAMART_COMMON_MEMBERS m ON t.MAJICA_NO = m.MAJICA_NO
            ${joins.join("\n")}
            WHERE t.MAJICA_NO IS NOT NULL ${filterClause}
            GROUP BY m.AGE_GROUP, m.GENDER, m.MAJICA_NO
          )
          SELECT
            AGE_GROUP,
            GENDER,
            COUNT(*) AS buyers,
            SUM(total_spend) AS total_sales,
            ROUND(AVG(total_spend), 0) AS avg_spend,
            ROUND(AVG(purchase_days), 1) AS avg_frequency,
            SUM(CASE WHEN purchase_days >= 2 THEN 1 ELSE 0 END) AS repeaters
          FROM member_stats
          GROUP BY AGE_GROUP, GENDER
          ORDER BY AGE_GROUP, GENDER
        `)
        break

      case "area": {
        // Apply date filter to avoid full table scan; default to last 90 days
        const areaDateFilter = baseStart && baseEnd
          ? `t.BUSINESS_DATE BETWEEN '${baseStart.replace(/'/g, "''")}' AND '${baseEnd.replace(/'/g, "''")}'`
          : `t.BUSINESS_DATE >= DATEADD('day', -90, CURRENT_DATE())`
        rows = await querySnowflake(`
          SELECT
            s.AREA_NAME,
            s.PREFECTURE_NAME,
            COUNT(DISTINCT t.MAJICA_NO) AS buyers,
            SUM(t.ITEM_SALES_AMOUNT) AS total_sales,
            COUNT(DISTINCT t.TRADE_KEY) AS transactions,
            COUNT(DISTINCT t.STORE_CODE) AS store_count,
            ROUND(AVG(t.ITEM_SALES_AMOUNT), 0) AS avg_spend
          FROM ${DB}.ANALYTICS.IS_POS_TRANSACTION t
          JOIN ${DB}.MASTER.DATAMART_COMMON_STORES s ON t.STORE_CODE = s.STORE_CODE
          ${category ? `JOIN ${DB}.MASTER.DATAMART_COMMON_ITEMS p ON t.ITEM_CODE = p.ITEM_CODE` : ""}
          WHERE ${areaDateFilter} ${category ? `AND p.MD_NAME = '${category.replace(/'/g, "''")}'` : ""}
          GROUP BY s.AREA_NAME, s.PREFECTURE_NAME
          ORDER BY total_sales DESC
        `)
        break
      }
        break

      case "behavior":
        rows = await querySnowflake(`
          SELECT
            DAYOFWEEK(t.BUSINESS_DATE) AS day_of_week,
            COUNT(DISTINCT t.TRADE_KEY) AS transactions,
            SUM(t.ITEM_SALES_AMOUNT) AS total_sales,
            COUNT(DISTINCT t.MAJICA_NO) AS buyers
          FROM ${DB}.ANALYTICS.IS_POS_TRANSACTION t
          ${joins.join("\n")}
          WHERE 1=1 ${filterClause}
          GROUP BY day_of_week
          ORDER BY day_of_week
        `)
        break

      case "trial_repeat":
        rows = await querySnowflake(`
          WITH filtered_trades AS (
            SELECT t.MAJICA_NO, t.BUSINESS_DATE
            FROM ${DB}.ANALYTICS.IS_POS_TRANSACTION t
            ${joins.join("\n")}
            WHERE t.MAJICA_NO IS NOT NULL ${filterClause}
          ),
          member_freq AS (
            SELECT MAJICA_NO, COUNT(DISTINCT BUSINESS_DATE) AS purchase_days
            FROM filtered_trades GROUP BY MAJICA_NO
          )
          SELECT
            CASE
              WHEN purchase_days = 1 THEN 'トライアル (1回)'
              WHEN purchase_days BETWEEN 2 AND 3 THEN 'ライト (2-3回)'
              WHEN purchase_days BETWEEN 4 AND 7 THEN 'ミドル (4-7回)'
              ELSE 'ヘビー (8回以上)'
            END AS segment,
            COUNT(*) AS member_count,
            ROUND(AVG(purchase_days), 1) AS avg_frequency
          FROM member_freq
          GROUP BY segment
          ORDER BY avg_frequency
        `)
        break

      case "summary":
        rows = await querySnowflake(`
          SELECT
            APPROX_COUNT_DISTINCT(t.MAJICA_NO) AS active_members,
            SUM(t.ITEM_SALES_AMOUNT) AS total_sales,
            COUNT(DISTINCT t.TRADE_KEY) AS total_transactions,
            ROUND(SUM(t.ITEM_SALES_AMOUNT) / NULLIF(COUNT(DISTINCT t.TRADE_KEY), 0), 0) AS avg_basket,
            ROUND(SUM(t.ITEM_SALES_QUANTITY) / NULLIF(COUNT(DISTINCT t.TRADE_KEY), 0), 1) AS avg_items,
            (SELECT COUNT(DISTINCT MAJICA_NO) FROM ${DB}.MASTER.DATAMART_COMMON_MEMBERS) AS total_members
          FROM ${DB}.ANALYTICS.IS_POS_TRANSACTION t
          ${joins.join("\n")}
          WHERE t.MAJICA_NO IS NOT NULL ${filterClause}
        `)
        break

      default:
        return NextResponse.json({ error: "Invalid type parameter" }, { status: 400 })
    }

    return NextResponse.json({ type, data: rows })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
