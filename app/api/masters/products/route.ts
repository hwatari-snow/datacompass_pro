import { querySnowflake } from "@/lib/snowflake"
import { DB } from "@/lib/constants"

export const dynamic = "force-dynamic"

/**
 * GET /api/masters/products
 * Returns product category hierarchy with item counts per category.
 * Uses composite keys (CLASS_CODE) to distinguish DS/UNY categories.
 * Response: { md, major, middle, minor, makers, totalItems }
 */
export async function GET() {
  const T_ITEMS = `${DB}.MASTER.DATAMART_COMMON_ITEMS`
  try {
    const [md, major, middle, minor, makers, totalRow] = await Promise.all([
      querySnowflake(`SELECT DISTINCT ITEM_CATEGORY_CLASS || '_' || MD_CODE AS code, MD_NAME || '\uff08' || ITEM_CATEGORY_CLASS || '\uff09' AS name FROM ${T_ITEMS} WHERE MD_CODE IS NOT NULL ORDER BY code`),
      querySnowflake(`SELECT ITEM_CATEGORY_CLASS || '_' || MAJOR_CODE AS code, MAJOR_NAME AS name, ITEM_CATEGORY_CLASS || '_' || MD_CODE AS md_code, COUNT(*) AS item_count FROM ${T_ITEMS} WHERE MAJOR_CODE IS NOT NULL GROUP BY ITEM_CATEGORY_CLASS, MAJOR_CODE, MAJOR_NAME, MD_CODE ORDER BY code`),
      querySnowflake(`SELECT ITEM_CATEGORY_CLASS || '_' || MIDDLE_CODE AS code, MIDDLE_NAME AS name, ITEM_CATEGORY_CLASS || '_' || MAJOR_CODE AS major_code, COUNT(*) AS item_count FROM ${T_ITEMS} WHERE MIDDLE_CODE IS NOT NULL GROUP BY ITEM_CATEGORY_CLASS, MIDDLE_CODE, MIDDLE_NAME, MAJOR_CODE ORDER BY code`),
      querySnowflake(`SELECT ITEM_CATEGORY_CLASS || '_' || MINOR_CODE AS code, MINOR_NAME AS name, ITEM_CATEGORY_CLASS || '_' || MIDDLE_CODE AS middle_code, COUNT(*) AS item_count FROM ${T_ITEMS} WHERE MINOR_CODE IS NOT NULL GROUP BY ITEM_CATEGORY_CLASS, MINOR_CODE, MINOR_NAME, MIDDLE_CODE ORDER BY code`),
      querySnowflake(`SELECT ITEM_CATEGORY_CLASS || '_' || MAKER_CODE AS code, MAKER_NAME AS name, COUNT(*) AS item_count FROM ${T_ITEMS} WHERE MAKER_CODE IS NOT NULL AND MAKER_NAME IS NOT NULL GROUP BY ITEM_CATEGORY_CLASS, MAKER_CODE, MAKER_NAME ORDER BY MAKER_NAME LIMIT 4000`),
      querySnowflake(`SELECT COUNT(*) AS cnt FROM ${T_ITEMS}`),
    ])

    const totalItems = Number(totalRow[0]?.CNT ?? 0)

    return Response.json({
      totalItems,
      md: md.map(r => ({ code: String(r.CODE ?? r.code), name: String(r.NAME ?? r.name) })),
      major: major.map(r => ({ code: String(r.CODE ?? r.code), name: String(r.NAME ?? r.name), md_code: String(r.MD_CODE ?? r.md_code), item_count: Number(r.ITEM_COUNT ?? r.item_count ?? 0) })),
      middle: middle.map(r => ({ code: String(r.CODE ?? r.code), name: String(r.NAME ?? r.name), major_code: String(r.MAJOR_CODE ?? r.major_code), item_count: Number(r.ITEM_COUNT ?? r.item_count ?? 0) })),
      minor: minor.map(r => ({ code: String(r.CODE ?? r.code), name: String(r.NAME ?? r.name), middle_code: String(r.MIDDLE_CODE ?? r.middle_code), item_count: Number(r.ITEM_COUNT ?? r.item_count ?? 0) })),
      makers: makers.map(r => ({ code: String(r.CODE ?? r.code), name: String(r.NAME ?? r.name), item_count: Number(r.ITEM_COUNT ?? r.item_count ?? 0) })),
    })
  } catch (e) {
    console.error("[api/masters/products]", e)
    return Response.json({ error: e instanceof Error ? e.message : "商品カテゴリ取得に失敗", md: [], major: [], middle: [], minor: [], makers: [], totalItems: 0 }, { status: 500 })
  }
}
