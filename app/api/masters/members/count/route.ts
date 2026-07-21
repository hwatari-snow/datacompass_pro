import { querySnowflake } from "@/lib/snowflake"
import { NextRequest } from "next/server"

export const dynamic = "force-dynamic"

const T_MEMBERS = "PPIH_FULL_DB.MASTER.DATAMART_COMMON_MEMBERS"
const lit = (v: string) => `'${String(v).replace(/'/g, "''")}'`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { genders, ageGroups, ranks } = body as {
      genders?: string[]
      ageGroups?: string[]
      ranks?: string[]
    }

    const conditions: string[] = []
    if (genders && genders.length > 0) {
      conditions.push(`GENDER IN (${genders.map(lit).join(",")})`)
    }
    if (ageGroups && ageGroups.length > 0) {
      conditions.push(`AGE_GROUP IN (${ageGroups.map(lit).join(",")})`)
    }
    if (ranks && ranks.length > 0) {
      conditions.push(`MEMBER_RANK IN (${ranks.map(lit).join(",")})`)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""
    const sql = `SELECT COUNT(*) AS cnt FROM ${T_MEMBERS} ${where}`

    const rows = await querySnowflake(sql)
    const count = Number(rows[0]?.CNT ?? 0)

    return Response.json({ count })
  } catch (e) {
    console.error(new Date().toISOString(), "[api/masters/members/count]", e)
    return Response.json({ error: e instanceof Error ? e.message : "会員数カウントに失敗" }, { status: 500 })
  }
}
