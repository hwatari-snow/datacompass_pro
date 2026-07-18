import { NextResponse } from "next/server"
import { querySnowflake } from "@/lib/snowflake"
import { DB } from "@/lib/constants"

export const dynamic = "force-dynamic"

const STORE_DT = `${DB}.ANALYTICS.DT_DAILY_STORE_SUMMARY`
const MAJOR_DT = `${DB}.ANALYTICS.DT_DAILY_MAJOR_STORE`

/** GET /api/overview — executive summary KPIs, 12-month trend, category share, data freshness. */
export async function GET() {
  try {
    const [kpiRows, trendRows, catRows, freshRows] = await Promise.all([
      querySnowflake(
        `WITH bounds AS (
           SELECT DATE_TRUNC('MONTH', MAX(BUSINESS_DATE)) AS cur_start, MAX(BUSINESS_DATE) AS max_d
           FROM ${STORE_DT}
         ),
         p AS (
           SELECT cur_start, LAST_DAY(cur_start) AS cur_end,
                  DATEADD('MONTH',-1,cur_start) AS prev_start,
                  LAST_DAY(DATEADD('MONTH',-1,cur_start)) AS prev_end, max_d
           FROM bounds
         )
         SELECT
           SUM(IFF(s.BUSINESS_DATE BETWEEN p.cur_start AND p.cur_end, s.TOTAL_SALES_AMOUNT,0)) AS cur_sales,
           SUM(IFF(s.BUSINESS_DATE BETWEEN p.prev_start AND p.prev_end, s.TOTAL_SALES_AMOUNT,0)) AS prev_sales,
           SUM(IFF(s.BUSINESS_DATE BETWEEN p.cur_start AND p.cur_end, s.RECEIPT_COUNT,0)) AS cur_receipts,
           SUM(IFF(s.BUSINESS_DATE BETWEEN p.prev_start AND p.prev_end, s.RECEIPT_COUNT,0)) AS prev_receipts,
           SUM(IFF(s.BUSINESS_DATE BETWEEN p.cur_start AND p.cur_end, s.TOTAL_SALES_QUANTITY,0)) AS cur_qty,
           SUM(IFF(s.BUSINESS_DATE BETWEEN p.prev_start AND p.prev_end, s.TOTAL_SALES_QUANTITY,0)) AS prev_qty,
           ANY_VALUE(p.cur_start) AS cur_start, ANY_VALUE(p.cur_end) AS cur_end, ANY_VALUE(p.max_d) AS max_d
         FROM ${STORE_DT} s CROSS JOIN p
         WHERE s.BUSINESS_DATE BETWEEN p.prev_start AND p.cur_end
           AND s.TRADE_CLASS_3 = '売上'`,
        { callersRights: true },
      ),
      querySnowflake(
        `SELECT TO_CHAR(DATE_TRUNC('MONTH', BUSINESS_DATE),'YYYY-MM') AS ym,
                SUM(TOTAL_SALES_AMOUNT) AS sales
         FROM ${STORE_DT}
         WHERE BUSINESS_DATE >= DATEADD('MONTH',-11, DATE_TRUNC('MONTH',(SELECT MAX(BUSINESS_DATE) FROM ${STORE_DT})))
           AND TRADE_CLASS_3 = '売上'
         GROUP BY 1 ORDER BY 1`,
        { callersRights: true },
      ),
      querySnowflake(
        `WITH mx AS (SELECT MAX(BUSINESS_DATE) md FROM ${MAJOR_DT}),
         agg AS (
           SELECT MD_NAME AS name, SUM(TOTAL_SALES_AMOUNT) AS sales
           FROM ${MAJOR_DT}, mx
           WHERE BUSINESS_DATE BETWEEN DATE_TRUNC('MONTH', mx.md) AND mx.md
             AND TRADE_CLASS_3 = '売上'
           GROUP BY 1
         )
         SELECT name, sales, SUM(sales) OVER () AS grand FROM agg ORDER BY sales DESC LIMIT 8`,
        { callersRights: true },
      ),
      querySnowflake(
        `SELECT MAX(REFRESH_END_TIME) AS last_refresh
         FROM TABLE(${DB}.INFORMATION_SCHEMA.DYNAMIC_TABLE_REFRESH_HISTORY(NAME => '${STORE_DT}'))
         WHERE STATE = 'SUCCEEDED'`,
        { callersRights: true },
      ).catch(() => [] as Record<string, unknown>[]),
    ])

    const k = (kpiRows[0] ?? {}) as Record<string, number | string>
    const num = (v: unknown) => Number(v ?? 0)

    const kpis = {
      sales: { cur: num(k.CUR_SALES), prev: num(k.PREV_SALES) },
      receipts: { cur: num(k.CUR_RECEIPTS), prev: num(k.PREV_RECEIPTS) },
      quantity: { cur: num(k.CUR_QTY), prev: num(k.PREV_QTY) },
      avgSpend: {
        cur: num(k.CUR_RECEIPTS) ? num(k.CUR_SALES) / num(k.CUR_RECEIPTS) : 0,
        prev: num(k.PREV_RECEIPTS) ? num(k.PREV_SALES) / num(k.PREV_RECEIPTS) : 0,
      },
      periodStart: k.CUR_START,
      periodEnd: k.CUR_END,
    }

    const trend = (trendRows as Record<string, unknown>[]).map((r) => ({
      ym: String(r.YM),
      sales: num(r.SALES),
    }))

    const catList = (catRows as Record<string, unknown>[]).map((r) => ({
      name: String(r.NAME),
      sales: num(r.SALES),
    }))
    const grand = catRows.length ? num((catRows[0] as Record<string, unknown>).GRAND) : 0
    const shown = catList.reduce((a, c) => a + c.sales, 0)
    const categories = [...catList]
    if (grand > shown) categories.push({ name: "その他", sales: grand - shown })

    const fr = (freshRows[0] ?? {}) as Record<string, unknown>
    const freshness = {
      lastRefresh: fr.LAST_REFRESH ?? null,
      dataThrough: k.MAX_D ?? null,
    }

    return NextResponse.json({ kpis, trend, categories, freshness })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
