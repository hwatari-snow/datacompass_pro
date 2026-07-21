import { NextResponse } from "next/server"
import { querySnowflake } from "@/lib/snowflake"
import { DB } from "@/lib/constants"

export const dynamic = "force-dynamic"

/**
 * GET /api/trend?granularity=monthly|weekly|daily&metric=sales|quantity|receipts|unit_price&groupBy=total|md|major|middle|minor|item
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const granularity = searchParams.get("granularity") ?? "monthly"
  const metric = searchParams.get("metric") ?? "sales"
  const groupBy = searchParams.get("groupBy") ?? "total"
  const baseStart = searchParams.get("baseStart") ?? ""
  const baseEnd = searchParams.get("baseEnd") ?? ""
  const storeCodes = searchParams.get("storeCodes") ?? ""
  const itemCodes = searchParams.get("itemCodes") ?? ""
  const mdCodesRaw = (searchParams.get("mdCodes") ?? "").split(",").filter(Boolean)
  const majorCodesRaw = (searchParams.get("majorCodes") ?? "").split(",").filter(Boolean)
  const middleCodesRaw = (searchParams.get("middleCodes") ?? "").split(",").filter(Boolean)
  const minorCodesRaw = (searchParams.get("minorCodes") ?? "").split(",").filter(Boolean)
  const subCodesRaw = (searchParams.get("subCodes") ?? "").split(",").filter(Boolean)

  const stripPrefix = (codes: string[]) => codes.map((c) => { const i = c.indexOf("_"); return i >= 0 ? c.substring(i + 1) : c })
  const mdCodes = stripPrefix(mdCodesRaw)
  const majorCodes = stripPrefix(majorCodesRaw)
  const middleCodes = stripPrefix(middleCodesRaw)
  const minorCodes = stripPrefix(minorCodesRaw)
  const subCodes = stripPrefix(subCodesRaw)

  // minor/sub group-by and sub filter have no DT — force the fact-table slow path
  const useDt = !itemCodes && groupBy !== "item" && groupBy !== "minor" && groupBy !== "sub" && subCodes.length === 0

  const dateCol = useDt ? "d.BUSINESS_DATE" : "t.BUSINESS_DATE"
  // Period label expression. Note: Snowflake TO_VARCHAR has no 'WW' token — use
  // ISO week functions to build a proper "YYYY-Www" label (else all weeks collapse by year).
  let periodExpr: string
  switch (granularity) {
    case "weekly":
      periodExpr = `YEAROFWEEKISO(${dateCol}) || '-W' || LPAD(WEEKISO(${dateCol})::VARCHAR, 2, '0')`; break
    case "daily":
      periodExpr = `TO_VARCHAR(${dateCol}, 'YYYY-MM-DD')`; break
    default:
      periodExpr = `TO_VARCHAR(DATE_TRUNC('MONTH', ${dateCol}), 'YYYY-MM')`
  }

  const metricLabel = { sales: "売上金額", quantity: "売上数量", receipts: "レシート数", unit_price: "平均単価" }[metric] ?? "売上金額"

  try {
    if (useDt) {
      const trendTable = `${DB}.ANALYTICS.DT_DAILY_MIDDLE_STORE`

      const metricExpr = {
        sales: "SUM(d.TOTAL_SALES_AMOUNT)",
        quantity: "SUM(d.TOTAL_SALES_QUANTITY)",
        receipts: "SUM(d.RECEIPT_COUNT)",
        unit_price: "SUM(d.TOTAL_SALES_AMOUNT) / NULLIF(SUM(d.TOTAL_SALES_QUANTITY), 0)",
      }[metric] ?? "SUM(d.TOTAL_SALES_AMOUNT)"

      // Group-by dimension
      let groupCol = ""
      let groupSelect = ""
      let joinClause = ""
      if (groupBy === "md") {
        joinClause = `JOIN (SELECT DISTINCT MIDDLE_CODE, MD_NAME FROM ${DB}.MASTER.DATAMART_COMMON_ITEMS) m ON m.MIDDLE_CODE = d.MIDDLE_CODE`
        groupCol = "m.MD_NAME"
        groupSelect = `${groupCol} AS series_name,`
      } else if (groupBy === "major") {
        joinClause = `JOIN (SELECT DISTINCT MIDDLE_CODE, MAJOR_NAME FROM ${DB}.MASTER.DATAMART_COMMON_ITEMS) m ON m.MIDDLE_CODE = d.MIDDLE_CODE`
        groupCol = "m.MAJOR_NAME"
        groupSelect = `${groupCol} AS series_name,`
      } else if (groupBy === "middle") {
        groupCol = "d.MIDDLE_NAME"
        groupSelect = `${groupCol} AS series_name,`
      }

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
      if (mdCodes.length > 0) whereConditions.push(`d.MD_CODE IN (${mdCodes.map(c => `'${c.replace(/'/g, "''")}'`).join(",")})`)
      if (majorCodes.length > 0) whereConditions.push(`d.MAJOR_CODE IN (${majorCodes.map(c => `'${c.replace(/'/g, "''")}'`).join(",")})`)
      if (middleCodes.length > 0) whereConditions.push(`d.MIDDLE_CODE IN (${middleCodes.map(c => `'${c.replace(/'/g, "''")}'`).join(",")})`)
      const whereClause = `WHERE ${whereConditions.join(" AND ")}`

      const groupByClause = groupCol ? `period, series_name` : `period`
      const orderByClause = groupCol ? `ORDER BY series_name, period` : `ORDER BY period`

      const rows = await querySnowflake(`
        SELECT
          ${periodExpr} AS period,
          ${groupSelect}
          ${metricExpr} AS metric_value,
          COUNT(DISTINCT d.STORE_CODE) AS store_count,
          SUM(d.MEMBER_COUNT) AS member_count
        FROM ${trendTable} d
        ${joinClause}
        ${whereClause}
        GROUP BY ${groupByClause}
        ${orderByClause}
      `, { callersRights: true })

      return NextResponse.json({ granularity, metric, metric_label: metricLabel, groupBy, data: rows })
    }

    // Slow path: fact table (itemCodes or minor/item groupBy)
    const metricExpr = {
      sales: "SUM(t.ITEM_SALES_AMOUNT)",
      quantity: "SUM(t.ITEM_SALES_QUANTITY)",
      receipts: "COUNT(DISTINCT t.TRADE_KEY)",
      unit_price: "SUM(t.ITEM_SALES_AMOUNT) / NULLIF(SUM(t.ITEM_SALES_QUANTITY), 0)",
    }[metric] ?? "SUM(t.ITEM_SALES_AMOUNT)"

    let groupCol = ""
    let groupSelect = ""
    const groupColMap: Record<string, string> = {
      md: "m.MD_NAME", major: "m.MAJOR_NAME", middle: "m.MIDDLE_NAME", minor: "m.MINOR_NAME", sub: "m.SUB_NAME", item: "m.ITEM_NAME",
    }
    if (groupColMap[groupBy]) {
      groupCol = groupColMap[groupBy]
      groupSelect = `${groupCol} AS series_name,`
    }
    // Single comprehensive items join (avoids missing-column errors when a group-by
    // join and a code filter both need different columns from the items master).
    const needsJoin = !!groupCol || mdCodes.length > 0 || majorCodes.length > 0 || middleCodes.length > 0 || minorCodes.length > 0 || subCodes.length > 0
    const joinClause = needsJoin
      ? `JOIN (SELECT DISTINCT ITEM_CODE, MD_CODE, MAJOR_CODE, MIDDLE_CODE, MINOR_CODE, SUB_CODE, MD_NAME, MAJOR_NAME, MIDDLE_NAME, MINOR_NAME, SUB_NAME, ITEM_NAME FROM ${DB}.MASTER.DATAMART_COMMON_ITEMS) m ON m.ITEM_CODE = t.ITEM_CODE`
      : ""

    const whereConditions: string[] = []
    if (baseStart && baseEnd) {
      whereConditions.push(`t.BUSINESS_DATE BETWEEN '${baseStart.replace(/'/g, "''")}' AND '${baseEnd.replace(/'/g, "''")}'`)
    } else {
      whereConditions.push(`t.BUSINESS_DATE >= DATEADD('day', -90, CURRENT_DATE())`)
    }
    whereConditions.push(`t.TRADE_CLASS_3 = '売上'`)
    if (storeCodes) {
      const codes = storeCodes.split(",").map((c) => `'${c.replace(/'/g, "''")}'`).join(",")
      whereConditions.push(`t.STORE_CODE IN (${codes})`)
    }
    if (itemCodes) {
      const codes = itemCodes.split(",").map((c) => `'${c.replace(/'/g, "''")}'`).join(",")
      whereConditions.push(`t.ITEM_CODE IN (${codes})`)
    }
    if (mdCodes.length > 0) {
      whereConditions.push(`m.MD_CODE IN (${mdCodes.map(c => `'${c.replace(/'/g, "''")}'`).join(",")})`)
    }
    if (majorCodes.length > 0) {
      whereConditions.push(`m.MAJOR_CODE IN (${majorCodes.map(c => `'${c.replace(/'/g, "''")}'`).join(",")})`)
    }
    if (middleCodes.length > 0) {
      whereConditions.push(`m.MIDDLE_CODE IN (${middleCodes.map(c => `'${c.replace(/'/g, "''")}'`).join(",")})`)
    }
    if (minorCodes.length > 0) {
      whereConditions.push(`m.MINOR_CODE IN (${minorCodes.map(c => `'${c.replace(/'/g, "''")}'`).join(",")})`)
    }
    if (subCodes.length > 0) {
      whereConditions.push(`m.SUB_CODE IN (${subCodes.map(c => `'${c.replace(/'/g, "''")}'`).join(",")})`)
    }
    const whereClause = whereConditions.length ? `WHERE ${whereConditions.join(" AND ")}` : ""
    const groupByClause = groupCol ? `period, series_name` : `period`
    const orderByClause = groupCol ? `ORDER BY series_name, period` : `ORDER BY period`

    const rows = await querySnowflake(`
      SELECT
        ${periodExpr} AS period,
        ${groupSelect}
        ${metricExpr} AS metric_value,
        COUNT(DISTINCT t.STORE_CODE) AS store_count,
        APPROX_COUNT_DISTINCT(t.MAJICA_NO) AS member_count
      FROM ${DB}.ANALYTICS.IS_POS_TRANSACTION t
      ${joinClause}
      ${whereClause}
      GROUP BY ${groupByClause}
      ${orderByClause}
    `, { callersRights: true })

    return NextResponse.json({ granularity, metric, metric_label: metricLabel, groupBy, data: rows })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
