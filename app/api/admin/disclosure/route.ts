import { querySnowflake } from "@/lib/snowflake"
import { disclosureQuery, allCategoriesQuery } from "@/lib/queries"

export const dynamic = "force-dynamic"

// GET /api/admin/disclosure?account=ACCxxx
// 返却: { categories: [{middle_code, middle_name, major_name}], enabled: ["middle_code", ...] }
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const account = url.searchParams.get("account")
    const cats = await querySnowflake(allCategoriesQuery())
    let enabled: string[] = []
    if (account) {
      const dis = await querySnowflake(disclosureQuery(account))
      enabled = dis.map((r) => String(r.MIDDLE_CODE))
    }
    return Response.json({
      categories: cats.map((r) => ({
        middle_code: String(r.MIDDLE_CODE),
        middle_name: String(r.MIDDLE_NAME),
        major_name: String(r.MAJOR_NAME),
      })),
      enabled,
    })
  } catch (e) {
    console.error(new Date().toISOString(), "[api/admin/disclosure]", e)
    return Response.json({ error: e instanceof Error ? e.message : "開示設定取得に失敗しました" }, { status: 500 })
  }
}
