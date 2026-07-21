import { querySnowflake } from "@/lib/snowflake"

/**
 * Server-side admin check. Runs under the caller's rights so it reflects the
 * end user's session roles (not the app service role). Use to gate /api/admin/* routes.
 */
export async function isAdmin(): Promise<boolean> {
  try {
    const rows = await querySnowflake(
      `SELECT IS_ROLE_IN_SESSION('DATACOMPASS_ADMIN') AS is_admin`,
      { callersRights: true },
    )
    const r = (rows[0] ?? {}) as Record<string, unknown>
    const v = r.IS_ADMIN ?? r.is_admin
    return v === true || String(v).toLowerCase() === "true"
  } catch {
    return false
  }
}

/** Standard 403 response for non-admin callers. */
export function forbidden(): Response {
  return Response.json({ error: "この操作には管理者ロール (DATACOMPASS_ADMIN) が必要です" }, { status: 403 })
}
