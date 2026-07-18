"use client"
// Separate chart components
function TrendChart({ chartData, groupBy, seriesNames, metricConfig }: { chartData: Record<string, number | string>[]; groupBy: GroupBy; seriesNames: string[]; metricConfig: typeof METRIC_OPTIONS[number] }) {
  // Compute Y domain
  const values: number[] = []
  for (const row of chartData) {
    if (groupBy === "total") {
      const v = Number(row.v) || 0
      if (v > 0) values.push(v)
    } else {
      for (let i = 0; i < seriesNames.length; i++) {
        const v = Number(row[`s${i}`]) || 0
        if (v > 0) values.push(v)
      }
    }
  }

  let yMin = values.length > 0 ? Math.min(...values) : 0
  let yMax = values.length > 0 ? Math.max(...values) : 100
  const range = yMax - yMin
  const pad = range > 0 ? range * 0.1 : yMax * 0.02
  const domain: [number, number] = [Math.max(0, Math.floor(yMin - pad)), Math.ceil(yMax + pad)]

  return (
    <ResponsiveContainer width="100%" height={360}>
      <LineChart data={chartData} margin={{ top: 10, right: 20, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="PERIOD" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
        <YAxis domain={domain} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickFormatter={fmtAxis} width={65} />
        <Tooltip
          contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }}
          labelStyle={{ color: "var(--foreground)" }}
          formatter={(value: number, name: string) => {
            const label = groupBy === "total" ? metricConfig.label : name
            return [metricConfig.format(value), label]
          }}
        />
        {groupBy === "total" ? (
          <Line type="monotone" dataKey="v" name={metricConfig.label} stroke={PALETTE.primary} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
        ) : (
          <>
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {seriesNames.map((name, i) => (
              <Line key={i} type="monotone" dataKey={`s${i}`} name={name} stroke={SERIES_COLORS[i % SERIES_COLORS.length]} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
            ))}
          </>
        )}
      </LineChart>
    </ResponsiveContainer>
  )
}

function ComparisonChart({ data, metricConfig }: { data: { period: string; base: number; compare: number; diff: number }[]; metricConfig: typeof METRIC_OPTIONS[number] }) {
  return (
    <ResponsiveContainer width="100%" height={360}>
      <LineChart data={data} margin={{ top: 10, right: 20, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="period" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
        <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickFormatter={fmtAxis} />
        <Tooltip
          contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }}
          labelStyle={{ color: "var(--foreground)" }}
          formatter={(value: number, name: string) => [metricConfig.format(value), name]}
        />
        <Legend />
        <Line type="monotone" dataKey="base" name="基準期間" stroke={PALETTE.primary} strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="compare" name="比較期間" stroke={SEMANTIC.emphasis} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
import { useState, useEffect, useMemo } from "react"
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts"
import { Download } from "lucide-react"
import { useConditions } from "@/components/conditions-context"
import { CHART_COLORS, PALETTE, SEMANTIC } from "@/lib/palette"

type TabType = "trend" | "comparison"
type Granularity = "monthly" | "weekly" | "daily"
type Metric = "sales" | "quantity" | "receipts" | "unit_price"
type GroupBy = "total" | "md" | "major" | "middle" | "minor" | "item"

const GRANULARITY_OPTIONS: { id: Granularity; label: string }[] = [
  { id: "monthly", label: "月次" },
  { id: "weekly", label: "週次" },
  { id: "daily", label: "日次" },
]

const METRIC_OPTIONS: { id: Metric; label: string; format: (v: number) => string }[] = [
  { id: "sales", label: "売上金額", format: (v) => `¥${v.toLocaleString()}` },
  { id: "quantity", label: "売上数量", format: (v) => v.toLocaleString() },
  { id: "receipts", label: "レシート数", format: (v) => v.toLocaleString() },
  { id: "unit_price", label: "平均単価", format: (v) => `¥${Math.round(v).toLocaleString()}` },
]

const GROUPBY_OPTIONS: { id: GroupBy; label: string }[] = [
  { id: "total", label: "全体" },
  { id: "md", label: "MD別" },
  { id: "major", label: "大分類別" },
  { id: "middle", label: "中分類別" },
  { id: "minor", label: "小分類別" },
  { id: "item", label: "商品別" },
]

const SERIES_COLORS = CHART_COLORS

interface TrendRow {
  PERIOD: string
  SERIES_NAME?: string
  METRIC_VALUE: number
  STORE_COUNT: number
  MEMBER_COUNT: number
}

function fmtAxis(v: number): string {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`
  return String(v)
}

export default function TrendPage() {
  const { conditions } = useConditions()
  const [activeTab, setActiveTab] = useState<TabType>("trend")
  const [granularity, setGranularity] = useState<Granularity>("monthly")
  const [metric, setMetric] = useState<Metric>("sales")
  const [groupBy, setGroupBy] = useState<GroupBy>("total")
  const [data, setData] = useState<TrendRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const metricConfig = METRIC_OPTIONS.find((m) => m.id === metric)!

  useEffect(() => {
    setLoading(true)
    setError("")
    const params = new URLSearchParams({ granularity, metric, groupBy })
    if (conditions.baseStart) params.set("baseStart", conditions.baseStart)
    if (conditions.baseEnd) params.set("baseEnd", conditions.baseEnd)
    if (conditions.storeCodes.length) params.set("storeCodes", conditions.storeCodes.join(","))
    if (conditions.itemCodes.length) params.set("itemCodes", conditions.itemCodes.join(","))
    if (conditions.mdCodes.length) params.set("mdCodes", conditions.mdCodes.join(","))
    if (conditions.majorCodes.length) params.set("majorCodes", conditions.majorCodes.join(","))
    if (conditions.middleCodes.length) params.set("middleCodes", conditions.middleCodes.join(","))
    fetch(`/api/trend?${params}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.error) setError(res.error)
        else setData((res.data ?? []).map((r: Record<string, unknown>) => ({ PERIOD: String(r.PERIOD ?? ''), SERIES_NAME: r.SERIES_NAME ? String(r.SERIES_NAME) : undefined, METRIC_VALUE: Number(r.METRIC_VALUE) || 0, STORE_COUNT: Number(r.STORE_COUNT) || 0, MEMBER_COUNT: Number(r.MEMBER_COUNT) || 0 })))
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [granularity, metric, groupBy, conditions.baseStart, conditions.baseEnd, conditions.storeCodes, conditions.itemCodes, conditions.mdCodes, conditions.majorCodes, conditions.middleCodes])

  // Series names for multi-line mode
  const seriesNames = useMemo(() => {
    if (groupBy === "total") return []
    const names: string[] = []
    for (const d of data) {
      if (d.SERIES_NAME && !names.includes(d.SERIES_NAME)) names.push(d.SERIES_NAME)
    }
    return names.slice(0, 15)
  }, [data, groupBy])

  // Pivot data for multi-series chart using safe keys (s0, s1, s2...)
  const chartData = useMemo(() => {
    if (groupBy === "total") return data.map((d) => ({ PERIOD: d.PERIOD, v: d.METRIC_VALUE }))
    const periods = [...new Set(data.map((d) => d.PERIOD))].sort()
    return periods.map((period) => {
      const row: Record<string, number | string> = { PERIOD: period }
      seriesNames.forEach((name, i) => {
        const match = data.find((d) => d.PERIOD === period && d.SERIES_NAME === name)
        row[`s${i}`] = match?.METRIC_VALUE ?? 0
      })
      return row
    })
  }, [data, groupBy, seriesNames])

  // KPIs (always based on totals)
  const kpis = useMemo(() => {
    if (data.length === 0) return null
    // Aggregate by period for total
    const periodMap = new Map<string, number>()
    for (const d of data) {
      periodMap.set(d.PERIOD, (periodMap.get(d.PERIOD) ?? 0) + d.METRIC_VALUE)
    }
    const periods = [...periodMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    const values = periods.map(([, v]) => v)
    const total = values.reduce((s, v) => s + v, 0)
    const maxIdx = values.indexOf(Math.max(...values))
    const minIdx = values.indexOf(Math.min(...values))
    const mid = Math.floor(periods.length / 2)
    const baseTotal = values.slice(mid).reduce((s, v) => s + v, 0)
    const compareTotal = values.slice(0, mid).reduce((s, v) => s + v, 0)
    const yoyChange = compareTotal > 0 ? ((baseTotal - compareTotal) / compareTotal) * 100 : 0

    return {
      total,
      yoyChange,
      compareTotal,
      maxPeriod: periods[maxIdx]?.[0] ?? "",
      maxValue: values[maxIdx] ?? 0,
      minPeriod: periods[minIdx]?.[0] ?? "",
      minValue: values[minIdx] ?? 0,
    }
  }, [data])

  // Comparison data
  const comparisonData = useMemo(() => {
    if (groupBy !== "total") return []
    if (data.length < 2) return []
    const mid = Math.floor(data.length / 2)
    const base = data.slice(mid)
    const compare = data.slice(0, mid)
    return base.map((b, i) => ({
      period: b.PERIOD,
      base: b.METRIC_VALUE,
      compare: compare[i]?.METRIC_VALUE ?? 0,
      diff: b.METRIC_VALUE - (compare[i]?.METRIC_VALUE ?? 0),
    }))
  }, [data, groupBy])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>トレンド分析結果</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            指標: {metricConfig.label}{groupBy !== "total" && ` | 集計軸: ${GROUPBY_OPTIONS.find((g) => g.id === groupBy)?.label}`}
          </p>
        </div>
        <button
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-[var(--accent)]"
          style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          <Download className="h-3.5 w-3.5" />
          Excel DL
        </button>
      </div>

      {/* KPI cards */}
      {kpis && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>基準期間 {metricConfig.label}合計</p>
            <p className="text-2xl font-bold mt-1" style={{ color: "var(--foreground)" }}>
              {metricConfig.format(kpis.total)}
            </p>
          </div>
          <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>前期比（基準 vs 比較期間）</p>
            <p className={`text-2xl font-bold mt-1 ${kpis.yoyChange >= 0 ? "text-green-500" : "text-red-500"}`}>
              {kpis.yoyChange >= 0 ? "+" : ""}{kpis.yoyChange.toFixed(1)}%
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              比較期間: {metricConfig.format(kpis.compareTotal)}
            </p>
          </div>
          <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>最高月（基準期間）</p>
            <p className="text-2xl font-bold mt-1" style={{ color: "var(--foreground)" }}>{kpis.maxPeriod}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{metricConfig.format(kpis.maxValue)}</p>
          </div>
          <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>最低月（基準期間）</p>
            <p className="text-2xl font-bold mt-1" style={{ color: "var(--foreground)" }}>{kpis.minPeriod}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{metricConfig.format(kpis.minValue)}</p>
          </div>
        </div>
      )}

      {/* Tab: 推移グラフ / 期間比較 */}
      <div className="flex gap-1">
        <button
          onClick={() => setActiveTab("trend")}
          className="rounded-md border px-4 py-2 text-sm font-medium transition-colors"
          style={activeTab === "trend"
            ? { backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }
            : { borderColor: "transparent", color: "var(--muted-foreground)" }
          }
        >
          推移グラフ
        </button>
        <button
          onClick={() => setActiveTab("comparison")}
          className="rounded-md border px-4 py-2 text-sm font-medium transition-colors"
          style={activeTab === "comparison"
            ? { backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }
            : { borderColor: "transparent", color: "var(--muted-foreground)" }
          }
        >
          期間比較
        </button>
      </div>

      {/* Controls bar */}
      <div className="flex flex-wrap gap-3 items-center text-xs">
        <span style={{ color: "var(--muted-foreground)" }}>集計単位:</span>
        <div className="flex gap-1 rounded-md p-0.5" style={{ backgroundColor: "var(--muted)" }}>
          {GRANULARITY_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setGranularity(opt.id)}
              className="rounded px-2.5 py-1 font-medium transition-colors"
              style={
                granularity === opt.id
                  ? { backgroundColor: "var(--brand-primary)", color: "white" }
                  : { color: "var(--muted-foreground)" }
              }
            >
              {opt.label}
            </button>
          ))}
        </div>

        <span style={{ color: "var(--muted-foreground)" }}>表示指標:</span>
        <div className="flex gap-1 rounded-md p-0.5" style={{ backgroundColor: "var(--muted)" }}>
          {METRIC_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setMetric(opt.id)}
              className="rounded px-2.5 py-1 font-medium transition-colors"
              style={
                metric === opt.id
                  ? { backgroundColor: "var(--brand-primary)", color: "white" }
                  : { color: "var(--muted-foreground)" }
              }
            >
              {opt.label}
            </button>
          ))}
        </div>

        <span style={{ color: "var(--muted-foreground)" }}>集計軸:</span>
        <div className="flex gap-1 rounded-md p-0.5" style={{ backgroundColor: "var(--muted)" }}>
          {GROUPBY_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setGroupBy(opt.id)}
              className="rounded px-2.5 py-1 font-medium transition-colors"
              style={
                groupBy === opt.id
                  ? { backgroundColor: "var(--brand-primary)", color: "white" }
                  : { color: "var(--muted-foreground)" }
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex h-64 items-center justify-center rounded-xl border" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2" style={{ color: "var(--muted-foreground)" }}>
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <span>データ取得中...</span>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 p-4" style={{ backgroundColor: "var(--card)" }}>
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {!loading && !error && data.length > 0 && (
        <>
          {/* Chart area */}
          <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            {activeTab === "trend" ? (
              <TrendChart chartData={chartData} groupBy={groupBy} seriesNames={seriesNames} metricConfig={metricConfig} />
            ) : (
              <ComparisonChart data={comparisonData} metricConfig={metricConfig} />
            )}
          </div>

          {/* Report table */}
          <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
              <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>帳票</span>
              <button
                className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors hover:bg-[var(--accent)]"
                style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
              >
                <Download className="h-3 w-3" />
                ダウンロード
              </button>
            </div>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0">
                  <tr style={{ backgroundColor: "var(--muted)" }}>
                    <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>期間</th>
                    {groupBy !== "total" && <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>カテゴリ</th>}
                    <th className="px-3 py-2 text-right text-xs font-medium" style={{ color: "var(--brand-primary)" }}>{metricConfig.label}</th>
                    <th className="px-3 py-2 text-right text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>店舗数</th>
                    <th className="px-3 py-2 text-right text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>会員数</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, i) => (
                    <tr key={i} className="border-t" style={{ borderColor: "var(--border)" }}>
                      <td className="px-3 py-2 font-medium" style={{ color: "var(--foreground)" }}>{row.PERIOD}</td>
                      {groupBy !== "total" && <td className="px-3 py-2" style={{ color: "var(--foreground)" }}>{row.SERIES_NAME}</td>}
                      <td className="px-3 py-2 text-right font-medium" style={{ color: "var(--brand-primary)" }}>{metricConfig.format(row.METRIC_VALUE)}</td>
                      <td className="px-3 py-2 text-right" style={{ color: "var(--muted-foreground)" }}>{row.STORE_COUNT?.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right" style={{ color: "var(--muted-foreground)" }}>{row.MEMBER_COUNT?.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
