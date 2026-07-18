import { NextResponse } from "next/server"
import { querySnowflake } from "@/lib/snowflake"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const rows = await querySnowflake(
      `SELECT
        CURRENT_USER() AS user_name,
        CURRENT_ROLE() AS current_role,
        CURRENT_ACCOUNT() AS account,
        CURRENT_WAREHOUSE() AS warehouse,
        CURRENT_DATABASE() AS database_name,
        CURRENT_TIMESTAMP() AS server_time,
        IS_ROLE_IN_SESSION('DATACOMPASS_ADMIN') AS is_admin`,
      { callersRights: true },
    )
    const r = (rows[0] ?? {}) as Record<string, unknown>
    // Snowflake returns UPPERCASE column keys — normalize to a stable lowercase contract.
    const pick = (k: string) => r[k] ?? r[k.toUpperCase()] ?? r[k.toLowerCase()]
    return NextResponse.json({
      user_name: pick("user_name") ?? "User",
      current_role: pick("current_role") ?? "PUBLIC",
      account: pick("account") ?? "",
      warehouse: pick("warehouse") ?? null,
      database_name: pick("database_name") ?? null,
      server_time: pick("server_time") ?? new Date().toISOString(),
      is_admin: pick("is_admin") ?? false,
    })
  } catch {
    // Fallback for local dev (no SPCS token)
    return NextResponse.json({
      user_name: "Local Dev User",
      current_role: "PUBLIC",
      account: "LOCAL",
      warehouse: null,
      database_name: null,
      server_time: new Date().toISOString(),
    })
  }
}
