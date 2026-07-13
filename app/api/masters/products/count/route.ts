import { querySnowflake } from "@/lib/snowflake"
import { NextRequest } from "next/server"
import { DB } from "@/lib/constants"

export const dynamic = "force-dynamic"

const T_ITEMS = `${DB}.MASTER.DATAMART_COMMON_ITEMS`

// Composite codes are "CLASS_CODE" format (e.g. "DS_1", "UNY_07")
function buildCompositeCondition(codes: string[], columnName: string): string {
  const byClass: Record<string, string[]> = {}
  for (const c of codes) {
    const idx = c.indexOf("_")
    if (idx === -1) continue
    const cls = c.substring(0, idx)
    const raw = c.substring(idx + 1)
    if (!byClass[cls]) byClass[cls] = []
    byClass[cls].push(raw)
  }
  const parts = Object.entries(byClass).map(([cls, rawCodes]) =>
    `(ITEM_CATEGORY_CLASS = '${cls}' AND ${columnName} IN (${rawCodes.map((r) => `'${r}'`).join(",")}))`
  )
  return parts.length === 1 ? parts[0] : `(${parts.join(" OR ")})`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { majorCodes, middleCodes, minorCodes, makerCodes, itemCodes, mdCodes } = body as {
      mdCodes?: string[]
      majorCodes?: string[]
      middleCodes?: string[]
      minorCodes?: string[]
      makerCodes?: string[]
      itemCodes?: string[]
    }

    const conditions: string[] = []

    if (itemCodes && itemCodes.length > 0) {
      conditions.push(`ITEM_CODE IN (${itemCodes.map((c) => `'${c}'`).join(",")})`)
    } else {
      if (minorCodes && minorCodes.length > 0) {
        conditions.push(buildCompositeCondition(minorCodes, "MINOR_CODE"))
      } else if (middleCodes && middleCodes.length > 0) {
        conditions.push(buildCompositeCondition(middleCodes, "MIDDLE_CODE"))
      } else if (majorCodes && majorCodes.length > 0) {
        conditions.push(buildCompositeCondition(majorCodes, "MAJOR_CODE"))
      } else if (mdCodes && mdCodes.length > 0) {
        conditions.push(buildCompositeCondition(mdCodes, "MD_CODE"))
      }
      if (makerCodes && makerCodes.length > 0) {
        conditions.push(buildCompositeCondition(makerCodes, "MAKER_CODE"))
      }
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""
    const sql = `SELECT COUNT(*) AS cnt FROM ${T_ITEMS} ${where}`
    const rows = await querySnowflake(sql)
    const count = Number(rows[0]?.CNT ?? 0)

    return Response.json({ count })
  } catch (e) {
    console.error("[api/masters/products/count]", e)
    return Response.json({ error: e instanceof Error ? e.message : "商品数カウントに失敗" }, { status: 500 })
  }
}
