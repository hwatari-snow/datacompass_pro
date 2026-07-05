import { querySnowflake } from "@/lib/snowflake"
import { memberFacetsQuery } from "@/lib/queries"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const rows = await querySnowflake(memberFacetsQuery())
    const r = rows[0] ?? {}
    const parse = (v: unknown): string[] => {
      if (Array.isArray(v)) return v as string[]
      if (typeof v === "string") {
        try { return JSON.parse(v) } catch { return [] }
      }
      return []
    }
    return Response.json({
      genders: parse(r.GENDERS),
      age_groups: parse(r.AGE_GROUPS),
      ranks: parse(r.RANKS),
    })
  } catch (e) {
    console.error(new Date().toISOString(), "[api/masters/members]", e)
    return Response.json({ error: e instanceof Error ? e.message : "会員属性取得に失敗しました" }, { status: 500 })
  }
}
