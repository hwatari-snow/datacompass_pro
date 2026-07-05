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
        CURRENT_TIMESTAMP() AS server_time`,
      { callersRights: true },
    )
    return NextResponse.json(rows[0] ?? {})
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
