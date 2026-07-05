import { NextResponse } from "next/server"
import { querySnowflake } from "@/lib/snowflake"
import { DB } from "@/lib/constants"

export const dynamic = "force-dynamic"

/**
 * GET /api/analysis/filters
 * Returns available filter options (categories, areas) for the analysis UI.
 */
export async function GET() {
  try {
    const [categories, areas] = await Promise.all([
      querySnowflake(`SELECT DISTINCT MD_NAME FROM ${DB}.MASTER.DATAMART_COMMON_ITEMS WHERE MD_NAME IS NOT NULL ORDER BY MD_NAME`),
      querySnowflake(`SELECT DISTINCT AREA_NAME FROM ${DB}.MASTER.DATAMART_COMMON_STORES WHERE AREA_NAME IS NOT NULL ORDER BY AREA_NAME`),
    ])

    return NextResponse.json({
      categories: categories.map((r) => r.MD_NAME as string),
      areas: areas.map((r) => r.AREA_NAME as string),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message, categories: [], areas: [] }, { status: 500 })
  }
}
