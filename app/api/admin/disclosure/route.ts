import { querySnowflake } from "@/lib/snowflake"
import { DB } from "@/lib/constants"

export const dynamic = "force-dynamic"

function roleName(accountId: string): string {
  return `DC_ACCT_${String(accountId).padStart(3, "0")}`
}

// GET /api/admin/disclosure?accountId=6
// Returns: { categories: [{middle_code, middle_name}], enabled: ["0101", ...] }
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const accountId = url.searchParams.get("accountId") ?? url.searchParams.get("account") ?? ""

    // All middle categories with MD + major hierarchy
    const cats = await querySnowflake(`
      SELECT DISTINCT
        m.MD_CODE, m.MD_NAME, m.MAJOR_CODE, m.MAJOR_NAME, m.MIDDLE_CODE, m.MIDDLE_NAME
      FROM ${DB}.MASTER.DATAMART_COMMON_ITEMS m
      ORDER BY m.MD_CODE, m.MAJOR_CODE, m.MIDDLE_CODE
    `)

    // Enabled categories for this account's role
    let enabled: string[] = []
    if (accountId) {
      const role = roleName(accountId)
      const dis = await querySnowflake(`
        SELECT MIDDLE_CODE
        FROM ${DB}.APP_CONFIG.ROLE_CATEGORY_MAPPING
        WHERE ROLE_NAME = '${role.replace(/'/g, "''")}' AND IS_PERMITTED = TRUE
      `)
      enabled = dis.map((r) => String(r.MIDDLE_CODE))
    }

    return Response.json({
      categories: cats.map((r) => ({
        md_code: String(r.MD_CODE),
        md_name: String(r.MD_NAME),
        major_code: String(r.MAJOR_CODE),
        major_name: String(r.MAJOR_NAME),
        middle_code: String(r.MIDDLE_CODE),
        middle_name: String(r.MIDDLE_NAME),
      })),
      enabled,
    })
  } catch (e) {
    console.error(new Date().toISOString(), "[api/admin/disclosure GET]", e)
    return Response.json({ error: e instanceof Error ? e.message : "開示設定取得に失敗しました" }, { status: 500 })
  }
}

// POST /api/admin/disclosure
// Body: { accountId: "6", enabled: ["0101", "0102", ...] }
// Requires DATACOMPASS_ADMIN role
export async function POST(req: Request) {
  try {
    // Admin role check via caller's rights
    const [check] = await querySnowflake(
      "SELECT IS_ROLE_IN_SESSION('DATACOMPASS_ADMIN') AS IS_ADMIN",
      { callersRights: true },
    )
    if (!check?.IS_ADMIN) {
      return Response.json({ error: "権限がありません。DATACOMPASS_ADMINロールが必要です。" }, { status: 403 })
    }

    const body = await req.json()
    const { accountId, enabled } = body as { accountId: string; enabled: string[] }
    if (!accountId || !Array.isArray(enabled)) {
      return Response.json({ error: "accountId and enabled[] are required" }, { status: 400 })
    }

    const role = roleName(accountId)

    // Delete existing mappings for this role
    await querySnowflake(`
      DELETE FROM ${DB}.APP_CONFIG.ROLE_CATEGORY_MAPPING
      WHERE ROLE_NAME = '${role.replace(/'/g, "''")}'
    `)

    // Insert new enabled categories
    if (enabled.length > 0) {
      const values = enabled
        .map((code) => `('${role.replace(/'/g, "''")}', '${code.replace(/'/g, "''")}', TRUE)`)
        .join(",\n")
      await querySnowflake(`
        INSERT INTO ${DB}.APP_CONFIG.ROLE_CATEGORY_MAPPING (ROLE_NAME, MIDDLE_CODE, IS_PERMITTED)
        VALUES ${values}
      `)
    }

    return Response.json({ success: true, role, count: enabled.length })
  } catch (e) {
    console.error(new Date().toISOString(), "[api/admin/disclosure POST]", e)
    return Response.json({ error: e instanceof Error ? e.message : "保存に失敗しました" }, { status: 500 })
  }
}
