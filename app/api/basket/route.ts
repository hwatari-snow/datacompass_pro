import { NextResponse } from "next/server"
import { querySnowflake } from "@/lib/snowflake"
import { DB } from "@/lib/constants"

export const dynamic = "force-dynamic"

/**
 * GET /api/basket?baseStart=&baseEnd=&storeCodes=&itemCodes=&limit=30
 * Returns co-purchase pairs with support, confidence, and lift.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const baseStart = searchParams.get("baseStart") ?? ""
  const baseEnd = searchParams.get("baseEnd") ?? ""
  const storeCodes = searchParams.get("storeCodes") ?? ""
  const itemCodes = searchParams.get("itemCodes") ?? ""
  const limit = Math.min(Number(searchParams.get("limit") ?? "30"), 100)

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

  try {
    // Summary KPIs
    const summaryRows = await querySnowflake(`
      SELECT
        COUNT(DISTINCT t.TRADE_KEY) AS total_baskets,
        COUNT(DISTINCT t.ITEM_CODE) AS unique_items,
        ROUND(COUNT(*) / NULLIF(COUNT(DISTINCT t.TRADE_KEY), 0), 1) AS avg_items_per_basket
      FROM ${DB}.ANALYTICS.TABLEAU_I_ABC_TRADE t
      ${whereClause}
    `)

    // Co-purchase pairs with lift
    const pairRows = await querySnowflake(`
      WITH basket_items AS (
        SELECT DISTINCT t.TRADE_KEY, t.ITEM_CODE
        FROM ${DB}.ANALYTICS.TABLEAU_I_ABC_TRADE t
        ${whereClause}
      ),
      total AS (
        SELECT COUNT(DISTINCT TRADE_KEY) AS n FROM basket_items
      ),
      item_freq AS (
        SELECT ITEM_CODE, COUNT(DISTINCT TRADE_KEY) AS freq
        FROM basket_items
        GROUP BY ITEM_CODE
        HAVING freq >= 3
      ),
      pairs AS (
        SELECT
          a.ITEM_CODE AS item_a,
          b.ITEM_CODE AS item_b,
          COUNT(DISTINCT a.TRADE_KEY) AS co_count
        FROM basket_items a
        JOIN basket_items b ON a.TRADE_KEY = b.TRADE_KEY AND a.ITEM_CODE < b.ITEM_CODE
        WHERE a.ITEM_CODE IN (SELECT ITEM_CODE FROM item_freq)
          AND b.ITEM_CODE IN (SELECT ITEM_CODE FROM item_freq)
        GROUP BY a.ITEM_CODE, b.ITEM_CODE
        HAVING co_count >= 2
      )
      SELECT
        p.item_a,
        ia.ITEM_NAME AS item_a_name,
        fa.freq AS freq_a,
        p.item_b,
        ib.ITEM_NAME AS item_b_name,
        fb.freq AS freq_b,
        p.co_count,
        ROUND(p.co_count / NULLIF(fa.freq, 0), 4) AS confidence_a_to_b,
        ROUND(p.co_count / NULLIF(fb.freq, 0), 4) AS confidence_b_to_a,
        ROUND((p.co_count * t.n) / NULLIF(fa.freq * fb.freq, 0), 3) AS lift
      FROM pairs p
      JOIN item_freq fa ON fa.ITEM_CODE = p.item_a
      JOIN item_freq fb ON fb.ITEM_CODE = p.item_b
      JOIN ${DB}.MASTER.DATAMART_COMMON_ITEMS ia ON ia.ITEM_CODE = p.item_a
      JOIN ${DB}.MASTER.DATAMART_COMMON_ITEMS ib ON ib.ITEM_CODE = p.item_b
      CROSS JOIN total t
      ORDER BY lift DESC
      LIMIT ${limit}
    `)

    return NextResponse.json({
      summary: summaryRows[0] ?? null,
      pairs: pairRows,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
