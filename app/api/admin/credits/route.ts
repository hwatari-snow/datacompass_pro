import { querySnowflake } from "@/lib/snowflake"
import { creditTrendQuery } from "@/lib/queries"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const rows = await querySnowflake(creditTrendQuery())
    return Response.json(rows)
  } catch (e) {
    console.error(new Date().toISOString(), "[api/admin/credits]", e)
    return Response.json({ error: e instanceof Error ? e.message : "クレジット取得に失敗しました" }, { status: 500 })
  }
}
