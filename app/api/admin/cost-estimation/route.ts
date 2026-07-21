import { querySnowflake } from "@/lib/snowflake"
import { isAdmin, forbidden } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    if (!(await isAdmin())) return forbidden()
    // 5-min interval pattern averaged by time of day (for chart)
    const hourly = await querySnowflake(`
      SELECT
        EXTRACT(HOUR FROM MEASURED_AT) AS HOUR,
        LPAD(EXTRACT(MINUTE FROM MEASURED_AT)::STRING, 2, '0') AS MINUTE,
        ROUND(AVG(QUERIES_RUNNING), 1) AS AVG_QUERIES,
        MAX(QUERIES_RUNNING) AS MAX_QUERIES
      FROM PPIH_FULL_DB.ACCESS_CONTROL.REDSHIFT_QUERIES_RUNNING
      GROUP BY HOUR, MINUTE
      ORDER BY HOUR, MINUTE
    `)

    // Daily totals
    const daily = await querySnowflake(`
      SELECT
        TO_VARCHAR(MEASURED_AT, 'YYYY-MM-DD') AS DAY,
        SUM(QUERIES_RUNNING) AS TOTAL_QUERIES,
        MAX(QUERIES_RUNNING) AS PEAK_QUERIES,
        COUNT(CASE WHEN QUERIES_RUNNING > 0 THEN 1 END) AS ACTIVE_INTERVALS
      FROM PPIH_FULL_DB.ACCESS_CONTROL.REDSHIFT_QUERIES_RUNNING
      GROUP BY DAY
      ORDER BY DAY
    `)

    // Overall summary
    const summary = await querySnowflake(`
      SELECT
        COUNT(*) AS TOTAL_INTERVALS,
        COUNT(CASE WHEN QUERIES_RUNNING > 0 THEN 1 END) AS ACTIVE_INTERVALS,
        ROUND(AVG(QUERIES_RUNNING), 1) AS AVG_QUERIES,
        MAX(QUERIES_RUNNING) AS PEAK_QUERIES,
        MIN(MEASURED_AT) AS MIN_TS,
        MAX(MEASURED_AT) AS MAX_TS
      FROM PPIH_FULL_DB.ACCESS_CONTROL.REDSHIFT_QUERIES_RUNNING
    `)

    // WH simulation: compute actual run hours for various auto-suspend values
    const whSim = await querySnowflake(`
      WITH ordered AS (
        SELECT MEASURED_AT, QUERIES_RUNNING,
          LAG(QUERIES_RUNNING) OVER (ORDER BY MEASURED_AT) AS prev_q,
          LAG(QUERIES_RUNNING, 2) OVER (ORDER BY MEASURED_AT) AS prev_q2,
          LAG(QUERIES_RUNNING, 3) OVER (ORDER BY MEASURED_AT) AS prev_q3,
          LAG(QUERIES_RUNNING, 4) OVER (ORDER BY MEASURED_AT) AS prev_q4
        FROM PPIH_FULL_DB.ACCESS_CONTROL.REDSHIFT_QUERIES_RUNNING
      )
      SELECT
        ROUND(SUM(CASE WHEN QUERIES_RUNNING > 0 THEN 300 ELSE 0 END) / 3600.0, 1) AS HOURS_SUSPEND_0,
        ROUND(SUM(CASE WHEN QUERIES_RUNNING > 0 OR prev_q > 0 THEN 300 ELSE 0 END) / 3600.0, 1) AS HOURS_SUSPEND_60,
        ROUND(SUM(CASE WHEN QUERIES_RUNNING > 0 OR prev_q > 0 OR prev_q2 > 0 THEN 300 ELSE 0 END) / 3600.0, 1) AS HOURS_SUSPEND_120,
        ROUND(SUM(CASE WHEN QUERIES_RUNNING > 0 OR prev_q > 0 OR prev_q2 > 0 OR prev_q3 > 0 THEN 300 ELSE 0 END) / 3600.0, 1) AS HOURS_SUSPEND_180,
        ROUND(SUM(CASE WHEN QUERIES_RUNNING > 0 OR prev_q > 0 OR prev_q2 > 0 OR prev_q3 > 0 OR prev_q4 > 0 THEN 300 ELSE 0 END) / 3600.0, 1) AS HOURS_SUSPEND_300
      FROM ordered
    `)

    const numDays = daily.length || 31

    return Response.json({ hourly, daily, summary: summary[0], whSim: whSim[0], numDays })
  } catch (e) {
    console.error("[api/admin/cost-estimation]", e)
    return Response.json({ error: e instanceof Error ? e.message : "データ取得に失敗" }, { status: 500 })
  }
}
