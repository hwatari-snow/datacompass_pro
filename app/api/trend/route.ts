import { NextResponse } from "next/server"
import { querySnowflake } from "@/lib/snowflake"
import { DB } from "@/lib/constants"

export const dynamic = "force-dynamic"

/**
 * GET /api/trend?granularity=monthly|weekly|daily&metric=sales|quantity|receipts|unit_price
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const granularity = searchParams.get("granularity") ?? "monthly"
  const metric = searchParams.get("metric") ?? "sales"
  const baseStart = searchParams.get("baseStart") ?? ""
  const baseEnd = searchParams.get("baseEnd") ?? ""
  const storeCodes = searchParams.get("storeCodes") ?? ""
  const itemCodes = searchParams.get("itemCodes") ?? ""

  // When no itemCodes filter, use pre-aggregated DT for much faster response
  const useDt = !itemCodes

  let dateTrunc: string
  let dateFormat: string
  const dateCol = useDt ? "d.BUSINESS_DATE" : "t.BUSINESS_DATE"
  switch (granularity) {
    case "weekly":
      dateTrunc = `DATE_TRUNC('WEEK', ${dateCol})`
      dateFormat = "YYYY-WW"
      break
    case "daily":
      dateTrunc = dateCol
      dateFormat = "YYYY-MM-DD"
      break
    default:
      dateTrunc = `DATE_TRUNC('MONTH', ${dateCol})`
      dateFormat = "YYYY-MM"
  }

  try {
    if (useDt) {
      // Fast path: DT_DAILY_STORE_SUMMARY (pre-aggregated, ~1.8M rows)
      const metricExpr = {
        sales: "SUM(d.TOTAL_SALES_AMOUNT)",
        quantity: "SUM(d.TOTAL_SALES_QUANTITY)",
        receipts: "SUM(d.RECEIPT_COUNT)",
        unit_price: "SUM(d.TOTAL_SALES_AMOUNT) / NULLIF(SUM(d.TOTAL_SALES_QUANTITY), 0)",
      }[metric] ?? "SUM(d.TOTAL_SALES_AMOUNT)"

      const whereConditions: string[] = []
      if (baseStart && baseEnd) {
        whereConditions.push(`d.BUSINESS_DATE BETWEEN '${baseStart.replace(/'/g, "''")}' AND '${baseEnd.replace(/'/g, "''")}'`)
      } else {
        whereConditions.push(`d.BUSINESS_DATE >= DATEADD('day', -90, CURRENT_DATE())`)
      }
      whereConditions.push(`d.TRADE_CLASS_3 = '売上'`)
      if (storeCodes) {
        const codes = storeCodes.split(",").map((c) => `'${c.replace(/'/g, "''")}'`).join(",")
        whereConditions.push(`d.STORE_CODE IN (${codes})`)
      }
      const whereClause = `WHERE ${whereConditions.join(" AND ")}`

      const rows = await querySnowflake(`
        SELECT
          TO_VARCHAR(${dateTrunc}, '${dateFormat}') AS period,
          ${metricExpr} AS metric_value,
          COUNT(DISTINCT d.STORE_CODE) AS store_count,
          SUM(d.MEMBER_COUNT) AS member_count
        FROM ${DB}.ANALYTICS.DT_DAILY_STORE_SUMMARY d
        ${whereClause}
        GROUP BY period
        ORDER BY period
      `)

      const metricLabel = { sales: "売上金額", quantity: "売上数量", receipts: "レシート数", unit_price: "平均単価" }[metric] ?? "売上金額"
      return NextResponse.json({ granularity, metric, metric_label: metricLabel, data: rows })
    }

    // Slow path: fact table (only when itemCodes specified)
    const metricExpr = {
      sales: "SUM(t.ITEM_SALES_AMOUNT)",
      quantity: "SUM(t.ITEM_SALES_QUANTITY)",
      receipts: "COUNT(DISTINCT t.TRADE_KEY)",
      unit_price: "AVG(t.ITEM_SALES_AMOUNT / NULLIF(t.ITEM_SALES_QUANTITY, 0))",
    }[metric] ?? "SUM(t.ITEM_SALES_AMOUNT)"

    const metricLabel = { sales: "売上金額", quantity: "売上数量", receipts: "レシート数", unit_price: "平均単価" }[metric] ?? "売上金額"

    const whereConditions: string[] = []
    if (baseStart && baseEnd) {
      whereConditions.push(`t.BUSINESS_DATE BETWEEN '${baseStart.replace(/'/g, "''")}' AND '${baseEnd.replace(/'/g, "''")}'`)
    } else {
      whereConditions.push(`t.BUSINESS_DATE >= DATEADD('day', -90, CURRENT_DATE())`)
    }
    if (storeCodes) {
      const codes = storeCodes.split(",").map((c) => `'${c.replace(/'/g, "''")}'`).join(",")
      whereConditions.push(`t.STORE_CODE IN (${codes})`)
    }
    if (itemCodes) {
      const codes = itemCodes.split(",").map((c) => `'${c.replace(/'/g, "''")}'`).join(",")
      whereConditions.push(`t.ITEM_CODE IN (${codes})`)
    }
    const whereClause = `WHERE ${whereConditions.join(" AND ")}`

    const rows = await querySnowflake(`
      SELECT
        TO_VARCHAR(${dateTrunc}, '${dateFormat}') AS period,
        ${metricExpr} AS metric_value,
        COUNT(DISTINCT t.STORE_CODE) AS store_count,
        APPROX_COUNT_DISTINCT(t.MAJICA_NO) AS member_count
      FROM ${DB}.ANALYTICS.TABLEAU_I_ABC_TRADE t
      ${whereClause}
      GROUP BY period
      ORDER BY period
    `)

    return NextResponse.json({ granularity, metric, metric_label: metricLabel, data: rows })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
