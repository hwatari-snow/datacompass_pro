import { querySnowflake } from "@/lib/snowflake"
import { DB } from "@/lib/constants"

export const dynamic = "force-dynamic"

/**
 * GET /api/masters/products
 * Returns product category hierarchy (NOT all 7M items).
 * Response: { md, major, middle, minor, makers }
 */
export async function GET() {
  const T_ITEMS = `${DB}.MASTER.DATAMART_COMMON_ITEMS`
  try {
    const [md, major, middle, minor, makers] = await Promise.all([
      querySnowflake(`SELECT DISTINCT MD_CODE AS code, MD_NAME AS name FROM ${T_ITEMS} WHERE MD_CODE IS NOT NULL AND ITEM_CATEGORY_CLASS = 'DS' ORDER BY MD_CODE`),
      querySnowflake(`SELECT DISTINCT MAJOR_CODE AS code, MAJOR_NAME AS name, MD_CODE AS md_code FROM ${T_ITEMS} WHERE MAJOR_CODE IS NOT NULL AND ITEM_CATEGORY_CLASS = 'DS' ORDER BY MAJOR_CODE`),
      querySnowflake(`SELECT DISTINCT MIDDLE_CODE AS code, MIDDLE_NAME AS name, MAJOR_CODE AS major_code FROM ${T_ITEMS} WHERE MIDDLE_CODE IS NOT NULL AND ITEM_CATEGORY_CLASS = 'DS' ORDER BY MIDDLE_CODE`),
      querySnowflake(`SELECT DISTINCT MINOR_CODE AS code, MINOR_NAME AS name, MIDDLE_CODE AS middle_code FROM ${T_ITEMS} WHERE MINOR_CODE IS NOT NULL AND ITEM_CATEGORY_CLASS = 'DS' ORDER BY MINOR_CODE`),
      querySnowflake(`SELECT DISTINCT MAKER_CODE AS code, MAKER_NAME AS name FROM ${T_ITEMS} WHERE MAKER_CODE IS NOT NULL AND MAKER_NAME IS NOT NULL AND ITEM_CATEGORY_CLASS = 'DS' ORDER BY MAKER_NAME LIMIT 2000`),
    ])

    return Response.json({
      md: md.map(r => ({ code: String(r.CODE ?? r.code), name: String(r.NAME ?? r.name) })),
      major: major.map(r => ({ code: String(r.CODE ?? r.code), name: String(r.NAME ?? r.name), md_code: String(r.MD_CODE ?? r.md_code) })),
      middle: middle.map(r => ({ code: String(r.CODE ?? r.code), name: String(r.NAME ?? r.name), major_code: String(r.MAJOR_CODE ?? r.major_code) })),
      minor: minor.map(r => ({ code: String(r.CODE ?? r.code), name: String(r.NAME ?? r.name), middle_code: String(r.MIDDLE_CODE ?? r.middle_code) })),
      makers: makers.map(r => ({ code: String(r.CODE ?? r.code), name: String(r.NAME ?? r.name) })),
    })
  } catch (e) {
    console.error("[api/masters/products]", e)
    return Response.json({ error: e instanceof Error ? e.message : "商品カテゴリ取得に失敗", md: [], major: [], middle: [], minor: [], makers: [] }, { status: 500 })
  }
}
