import { querySnowflake } from "@/lib/snowflake"
import { usersQuery } from "@/lib/queries"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const rows = await querySnowflake(usersQuery())
    return Response.json(rows)
  } catch (e) {
    console.error(new Date().toISOString(), "[api/admin/users]", e)
    return Response.json({ error: e instanceof Error ? e.message : "ユーザー取得に失敗しました" }, { status: 500 })
  }
}
