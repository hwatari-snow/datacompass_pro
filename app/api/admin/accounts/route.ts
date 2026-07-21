import { querySnowflake } from "@/lib/snowflake"
import { accountsQuery } from "@/lib/queries"
import { isAdmin, forbidden } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    if (!(await isAdmin())) return forbidden()
    const rows = await querySnowflake(accountsQuery())
    return Response.json(rows)
  } catch (e) {
    console.error(new Date().toISOString(), "[api/admin/accounts]", e)
    return Response.json({ error: e instanceof Error ? e.message : "アカウント取得に失敗しました" }, { status: 500 })
  }
}
