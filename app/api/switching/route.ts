import { NextResponse } from "next/server"
import { querySnowflake } from "@/lib/snowflake"
import { DB } from "@/lib/constants"

export const dynamic = "force-dynamic"

/**
 * GET /api/switching
 * Returns brand switching matrix data (simplified: brand share per period).
 */
export async function GET() {
  try {
    // Brand share in two periods (first half vs second half of data range)
    const brandShare = await querySnowflake(`
      WITH date_range AS (
        SELECT MIN(BUSINESS_DATE) AS min_dt, MAX(BUSINESS_DATE) AS max_dt
        FROM ${DB}.ANALYTICS.TABLEAU_I_ABC_TRADE
        WHERE TRADE_CLASS_3 = '売上'
      ),
      brand_period AS (
        SELECT
          p.BRAND_NAME,
          CASE
            WHEN t.BUSINESS_DATE < DATEADD('day', DATEDIFF('day', dr.min_dt, dr.max_dt)/2, dr.min_dt) THEN 'period_1'
            ELSE 'period_2'
          END AS period,
          COUNT(DISTINCT t.MAJICA_NO) AS buyers,
          SUM(t.ITEM_SALES_AMOUNT) AS sales
        FROM ${DB}.ANALYTICS.TABLEAU_I_ABC_TRADE t
        JOIN ${DB}.MASTER.DATAMART_COMMON_ITEMS p ON t.ITEM_CODE = p.ITEM_CODE
        CROSS JOIN date_range dr
        WHERE t.MAJICA_NO IS NOT NULL
          AND p.BRAND_NAME IS NOT NULL
        GROUP BY p.BRAND_NAME, period
      )
      SELECT
        BRAND_NAME,
        MAX(CASE WHEN period = 'period_1' THEN buyers END) AS period1_buyers,
        MAX(CASE WHEN period = 'period_2' THEN buyers END) AS period2_buyers,
        MAX(CASE WHEN period = 'period_1' THEN sales END) AS period1_sales,
        MAX(CASE WHEN period = 'period_2' THEN sales END) AS period2_sales
      FROM brand_period
      GROUP BY BRAND_NAME
      HAVING period1_buyers > 0 OR period2_buyers > 0
      ORDER BY COALESCE(period2_sales, 0) DESC
      LIMIT 20
    `)

    // Member switching summary
    const switchingSummary = await querySnowflake(`
      WITH date_range AS (
        SELECT MIN(BUSINESS_DATE) AS min_dt, MAX(BUSINESS_DATE) AS max_dt
        FROM ${DB}.ANALYTICS.TABLEAU_I_ABC_TRADE
        WHERE TRADE_CLASS_3 = '売上'
      ),
      mid_point AS (
        SELECT DATEADD('day', DATEDIFF('day', min_dt, max_dt)/2, min_dt) AS mid_dt FROM date_range
      ),
      p1_members AS (
        SELECT DISTINCT MAJICA_NO FROM ${DB}.ANALYTICS.TABLEAU_I_ABC_TRADE t, mid_point mp
        WHERE t.BUSINESS_DATE < mp.mid_dt AND t.MAJICA_NO IS NOT NULL
      ),
      p2_members AS (
        SELECT DISTINCT MAJICA_NO FROM ${DB}.ANALYTICS.TABLEAU_I_ABC_TRADE t, mid_point mp
        WHERE t.BUSINESS_DATE >= mp.mid_dt AND t.MAJICA_NO IS NOT NULL
      )
      SELECT
        (SELECT COUNT(*) FROM p1_members) AS period1_total,
        (SELECT COUNT(*) FROM p2_members) AS period2_total,
        (SELECT COUNT(*) FROM p1_members INTERSECT SELECT COUNT(*) FROM p2_members) AS continuers
    `)

    return NextResponse.json({
      brandShare,
      summary: switchingSummary[0] ?? {},
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
