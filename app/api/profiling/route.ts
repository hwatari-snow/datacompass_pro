import { NextResponse } from "next/server"
import { querySnowflake } from "@/lib/snowflake"
import { DB } from "@/lib/constants"

export const dynamic = "force-dynamic"

/**
 * GET /api/profiling
 * Returns purchase interval distribution and retention data for brand profiling.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const baseStart = searchParams.get("baseStart") ?? ""
  const baseEnd = searchParams.get("baseEnd") ?? ""

  // Default to last 365 days if no date range specified (avoids full 9B-row scan)
  const dateFilter = baseStart && baseEnd
    ? `t.BUSINESS_DATE BETWEEN '${baseStart.replace(/'/g, "''")}' AND '${baseEnd.replace(/'/g, "''")}'`
    : `t.BUSINESS_DATE >= DATEADD('day', -365, CURRENT_DATE())`

  try {
    // Purchase interval distribution
    const intervals = await querySnowflake(`
      WITH member_purchases AS (
        SELECT
          MAJICA_NO,
          BUSINESS_DATE,
          LAG(BUSINESS_DATE) OVER (PARTITION BY MAJICA_NO ORDER BY BUSINESS_DATE) AS prev_date
        FROM (
          SELECT DISTINCT MAJICA_NO, BUSINESS_DATE
          FROM ${DB}.ANALYTICS.IS_POS_TRANSACTION t
          WHERE MAJICA_NO IS NOT NULL AND ${dateFilter}
        )
      ),
      intervals AS (
        SELECT
          MAJICA_NO,
          DATEDIFF('day', prev_date, BUSINESS_DATE) AS interval_days
        FROM member_purchases
        WHERE prev_date IS NOT NULL
      )
      SELECT
        FLOOR(interval_days / 7) * 7 AS interval_bucket,
        COUNT(*) AS count
      FROM intervals
      WHERE interval_days <= 180
      GROUP BY interval_bucket
      ORDER BY interval_bucket
    `)

    // N-th purchase retention
    const retention = await querySnowflake(`
      WITH member_visits AS (
        SELECT
          MAJICA_NO,
          ROW_NUMBER() OVER (PARTITION BY MAJICA_NO ORDER BY BUSINESS_DATE) AS nth_purchase
        FROM (
          SELECT DISTINCT MAJICA_NO, BUSINESS_DATE
          FROM ${DB}.ANALYTICS.IS_POS_TRANSACTION t
          WHERE MAJICA_NO IS NOT NULL AND ${dateFilter}
        )
      ),
      total_members AS (
        SELECT COUNT(DISTINCT MAJICA_NO) AS total FROM member_visits
      )
      SELECT
        v.nth_purchase AS n,
        COUNT(DISTINCT v.MAJICA_NO) AS remaining,
        ROUND(COUNT(DISTINCT v.MAJICA_NO) * 100.0 / t.total, 1) AS retention_rate
      FROM member_visits v
      CROSS JOIN total_members t
      WHERE v.nth_purchase <= 15
      GROUP BY v.nth_purchase, t.total
      ORDER BY v.nth_purchase
    `)

    return NextResponse.json({
      intervals,
      retention,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
