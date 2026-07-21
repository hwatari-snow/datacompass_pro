import { querySnowflake } from "@/lib/snowflake"
import {
  buildAbcSql,
  buildAbcSummarySql,
  type AbcQueryArgs,
} from "@/lib/queries"
import type { AnalysisConditions, AbcCriteria, ProductUnit, StoreUnit, AbcRow, AbcResult } from "@/lib/types"

export const dynamic = "force-dynamic"
export const maxDuration = 300

interface AbcRequest {
  conditions: AnalysisConditions
  tab: "product" | "store"
  unit: ProductUnit | StoreUnit
  criteria: AbcCriteria
}

function n(v: unknown): number {
  const x = typeof v === "string" ? parseFloat(v) : (v as number)
  return Number.isFinite(x) ? x : 0
}

function mapRow(r: Record<string, unknown>): AbcRow {
  return {
    code: String(r.CODE ?? ""),
    name: String(r.NAME ?? ""),
    major_name: r.MAJOR_NAME != null ? String(r.MAJOR_NAME) : undefined,
    middle_name: r.MIDDLE_NAME != null ? String(r.MIDDLE_NAME) : undefined,
    minor_name: r.MINOR_NAME != null ? String(r.MINOR_NAME) : undefined,
    sub_name: r.SUB_NAME != null ? String(r.SUB_NAME) : undefined,
    brand_name: r.BRAND_NAME != null ? String(r.BRAND_NAME) : undefined,
    area_name: r.AREA_NAME != null ? String(r.AREA_NAME) : undefined,
    business_type_name: r.BUSINESS_TYPE_NAME != null ? String(r.BUSINESS_TYPE_NAME) : undefined,
    corporation_name: r.CORPORATION_NAME != null ? String(r.CORPORATION_NAME) : undefined,
    prefecture_name: r.PREFECTURE_NAME != null ? String(r.PREFECTURE_NAME) : undefined,
    sales: n(r.SALES),
    quantity: n(r.QUANTITY),
    receipt_count: n(r.RECEIPT_COUNT),
    rank: n(r.RANK),
    sales_ratio: n(r.SALES_RATIO),
    cumulative_ratio: n(r.CUMULATIVE_RATIO),
    abc_class: (r.ABC_CLASS as "A" | "B" | "C") ?? "C",
  }
}

async function runPeriod(args: AbcQueryArgs): Promise<AbcResult> {
  const [rowsRaw, sumRaw] = await Promise.all([
    querySnowflake(buildAbcSql(args), { callersRights: true }),
    querySnowflake(buildAbcSummarySql({ conditions: args.conditions, tab: args.tab, unit: args.unit, period: args.period }), { callersRights: true }),
  ])
  const rows = rowsRaw.map(mapRow)
  const s = sumRaw[0] ?? {}
  return {
    rows,
    summary: {
      total_sales: n(s.TOTAL_SALES),
      total_quantity: n(s.TOTAL_QUANTITY),
      total_receipts: n(s.TOTAL_RECEIPTS),
      total_units: n(s.TOTAL_UNITS),
      a_count: rows.filter((r) => r.abc_class === "A").length,
      b_count: rows.filter((r) => r.abc_class === "B").length,
      c_count: rows.filter((r) => r.abc_class === "C").length,
    },
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as AbcRequest
    const { conditions, tab, unit, criteria } = body
    if (!conditions?.baseStart || !conditions?.baseEnd) {
      return Response.json({ error: "基準期間が指定されていません" }, { status: 400 })
    }

    const base = await runPeriod({ conditions, tab, unit, criteria, period: "base" })

    let compare: AbcResult | null = null
    if (conditions.compareEnabled && conditions.compareStart && conditions.compareEnd) {
      compare = await runPeriod({ conditions, tab, unit, criteria, period: "compare" })
    }
    return Response.json({ base, compare })
  } catch (e) {
    console.error(new Date().toISOString(), "[api/abc]", e)
    return Response.json({ error: e instanceof Error ? e.message : "ABC集計に失敗しました" }, { status: 500 })
  }
}
