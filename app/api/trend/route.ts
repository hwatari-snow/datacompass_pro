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

  const metricExpr = {
    sales: "SUM(t.ITEM_SALES_AMOUNT)",
    quantity: "SUM(t.ITEM_SALES_QUANTITY)",
    receipts: "COUNT(DISTINCT t.TRADE_KEY)",
    unit_price: "AVG(t.ITEM_SALES_AMOUNT / NULLIF(t.ITEM_SALES_QUANTITY, 0))",
  }[metric] ?? "SUM(t.ITEM_SALES_AMOUNT)"

  const metricLabel = { sales: "売上金額", quantity: "売上数量", receipts: "レシート数", unit_price: "平均単価" }[metric] ?? "売上金額"

  let dateTrunc: string
  let dateFormat: string
  switch (granularity) {
    case "weekly":
      dateTrunc = "DATE_TRUNC('WEEK', t.BUSINESS_DATE)"
      dateFormat = "YYYY-WW"
      break
    case "daily":
      dateTrunc = "t.BUSINESS_DATE"
      dateFormat = "YYYY-MM-DD"
      break
    default:
      dateTrunc = "DATE_TRUNC('MONTH', t.BUSINESS_DATE)"
      dateFormat = "YYYY-MM"
  }

  try {
    const whereConditions: string[] = []
    if (baseStart && baseEnd) {
      whereConditions.push(`t.BUSINESS_DATE BETWEEN '${baseStart.replace(/'/g, "''")}' AND '${baseEnd.replace(/'/g, "''")}'`)
    }
    if (storeCodes) {
      const codes = storeCodes.split(",").map((c) => `'${c.replace(/'/g, "''")}'`).join(",")
      whereConditions.push(`t.STORE_CODE IN (${codes})`)
    }
    if (itemCodes) {
      const codes = itemCodes.split(",").map((c) => `'${c.replace(/'/g, "''")}'`).join(",")
      whereConditions.push(`t.ITEM_CODE IN (${codes})`)
    }
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : ""

    const rows = await querySnowflake(`
      SELECT
        TO_VARCHAR(${dateTrunc}, '${dateFormat}') AS period,
        ${metricExpr} AS metric_value,
        COUNT(DISTINCT t.STORE_CODE) AS store_count,
        COUNT(DISTINCT t.MAJICA_NO) AS member_count
      FROM ${DB}.ANALYTICS.TABLEAU_I_ABC_TRADE t
      ${whereClause}
      GROUP BY period
      ORDER BY period
    `)

    return NextResponse.json({
      granularity,
      metric,
      metric_label: metricLabel,
      data: rows,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
