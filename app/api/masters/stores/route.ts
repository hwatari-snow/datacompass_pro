import { querySnowflake } from "@/lib/snowflake"
import { storesQuery } from "@/lib/queries"
import { lowercaseKeys } from "@/lib/utils"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const rows = await querySnowflake(storesQuery())
    return Response.json(lowercaseKeys(rows))
  } catch (e) {
    console.error(new Date().toISOString(), "[api/masters/stores]", e)
    return Response.json({ error: e instanceof Error ? e.message : "店舗取得に失敗しました" }, { status: 500 })
  }
}
