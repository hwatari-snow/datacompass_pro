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
        {groupBy === "total" && (
          <Line type="monotone" dataKey="v" name={metricConfig.label} stroke={PALETTE.primary} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} />
        )}
        {groupBy !== "total" && <Legend wrapperStyle={{ fontSize: 11 }} />}
        {groupBy !== "total" && seriesNames.map((name, i) => (
          <Line key={`s${i}`} type="monotone" dataKey={`s${i}`} name={name} stroke={SERIES_COLORS[i % SERIES_COLORS.length]} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} connectNulls isAnimationActive={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

type CompareRow = { label: string; base: number | null; compare: number | null; baseDate: string; compareDate: string }

function CompareTooltip({ active, payload, label, metricConfig }: { active?: boolean; payload?: { payload: CompareRow }[]; label?: string; metricConfig: typeof METRIC_OPTIONS[number] }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 12 }}>
      <div style={{ fontWeight: 700, color: "var(--foreground)", marginBottom: 4 }}>{label}</div>
      <div style={{ color: PALETTE.primary }}>基準 {row.baseDate || "—"}：{row.base != null ? metricConfig.format(row.base) : "—"}</div>
      <div style={{ color: SEMANTIC.emphasis }}>比較 {row.compareDate || "—"}：{row.compare != null ? metricConfig.format(row.compare) : "—"}</div>
    </div>
  )
}

function ComparisonChart({ data, metricConfig }: { data: CompareRow[]; metricConfig: typeof METRIC_OPTIONS[number] }) {
  return (
    <ResponsiveContainer width="100%" height={360}>
      <LineChart data={data} margin={{ top: 10, right: 20, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="label" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
        <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickFormatter={fmtAxis} />
        <Tooltip content={<CompareTooltip metricConfig={metricConfig} />} />
        <Legend />
        <Line type="monotone" dataKey="base" name="基準期間" stroke={PALETTE.primary} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} connectNulls={false} />
        <Line type="monotone" dataKey="compare" name="比較期間" stroke={SEMANTIC.emphasis} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} connectNulls={false} />
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
import Link from "next/link"
import { Download, CalendarClock, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useConditions } from "@/components/conditions-context"
import { CHART_COLORS, PALETTE, SEMANTIC } from "@/lib/palette"
import { Segmented } from "@/components/ui/segmented"

type TabType = "trend" | "comparison"
type Granularity = "monthly" | "weekly" | "daily"
type Metric = "sales" | "quantity" | "receipts" | "unit_price"
type GroupBy = "total" | "md" | "major" | "middle" | "minor" | "sub" | "item"

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
  { id: "item", label: "商品別" },
  { id: "sub", label: "細分類別" },
  { id: "minor", label: "小分類別" },
  { id: "middle", label: "中分類別" },
  { id: "major", label: "大分類別" },
  { id: "md", label: "MD別" },
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
  const [compareData, setCompareData] = useState<{ PERIOD: string; METRIC_VALUE: number }[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const metricConfig = METRIC_OPTIONS.find((m) => m.id === metric)!
  const periodUnit = granularity === "weekly" ? "週" : granularity === "daily" ? "日" : "月"
  const totalLabel = metric === "unit_price" ? "平均" : "合計"
  const compareSet = !!(conditions.compareEnabled && conditions.compareStart && conditions.compareEnd)

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
    if (conditions.minorCodes.length) params.set("minorCodes", conditions.minorCodes.join(","))
    if (conditions.subCodes.length) params.set("subCodes", conditions.subCodes.join(","))
    fetch(`/api/trend?${params}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.error) setError(res.error)
        else setData((res.data ?? []).map((r: Record<string, unknown>) => ({ PERIOD: String(r.PERIOD ?? ''), SERIES_NAME: r.SERIES_NAME ? String(r.SERIES_NAME) : undefined, METRIC_VALUE: Number(r.METRIC_VALUE) || 0, STORE_COUNT: Number(r.STORE_COUNT) || 0, MEMBER_COUNT: Number(r.MEMBER_COUNT) || 0 })))
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [granularity, metric, groupBy, conditions.baseStart, conditions.baseEnd, conditions.storeCodes, conditions.itemCodes, conditions.mdCodes, conditions.majorCodes, conditions.middleCodes, conditions.minorCodes, conditions.subCodes])

  // Compare-period series (案A): fetched with the same filters/granularity but the compare dates, always as total
  useEffect(() => {
    if (!compareSet) { setCompareData([]); return }
    const params = new URLSearchParams({ granularity, metric, groupBy: "total" })
    params.set("baseStart", conditions.compareStart!)
    params.set("baseEnd", conditions.compareEnd!)
    if (conditions.storeCodes.length) params.set("storeCodes", conditions.storeCodes.join(","))
    if (conditions.itemCodes.length) params.set("itemCodes", conditions.itemCodes.join(","))
    if (conditions.mdCodes.length) params.set("mdCodes", conditions.mdCodes.join(","))
    if (conditions.majorCodes.length) params.set("majorCodes", conditions.majorCodes.join(","))
    if (conditions.middleCodes.length) params.set("middleCodes", conditions.middleCodes.join(","))
    if (conditions.minorCodes.length) params.set("minorCodes", conditions.minorCodes.join(","))
    if (conditions.subCodes.length) params.set("subCodes", conditions.subCodes.join(","))
    let cancelled = false
    fetch(`/api/trend?${params}`)
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return
        if (res.error) { setCompareData([]); return }
        setCompareData((res.data ?? []).map((r: Record<string, unknown>) => ({ PERIOD: String(r.PERIOD ?? ''), METRIC_VALUE: Number(r.METRIC_VALUE) || 0 })))
      })
      .catch(() => { if (!cancelled) setCompareData([]) })
    return () => { cancelled = true }
  }, [compareSet, conditions.compareStart, conditions.compareEnd, granularity, metric, conditions.storeCodes, conditions.itemCodes, conditions.mdCodes, conditions.majorCodes, conditions.middleCodes, conditions.minorCodes, conditions.subCodes])

  // Series names for multi-line mode — top 15 by total metric value (not alphabetical)
  const seriesNames = useMemo(() => {
    if (groupBy === "total") return []
    const totals = new Map<string, number>()
    for (const d of data) {
      if (!d.SERIES_NAME) continue
      totals.set(d.SERIES_NAME, (totals.get(d.SERIES_NAME) ?? 0) + d.METRIC_VALUE)
    }
    return [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([name]) => name)
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
    const isRatio = metric === "unit_price"
    const agg = (arr: number[]) => (arr.length === 0 ? 0 : isRatio ? arr.reduce((s, v) => s + v, 0) / arr.length : arr.reduce((s, v) => s + v, 0))
    const total = agg(values)
    const maxIdx = values.indexOf(Math.max(...values))
    const minIdx = values.indexOf(Math.min(...values))
    // Real compare period: per-period average (length-independent, so 30日 vs 92日 is fair)
    const cmpMap = new Map<string, number>()
    for (const d of compareData) cmpMap.set(d.PERIOD, (cmpMap.get(d.PERIOD) ?? 0) + d.METRIC_VALUE)
    const cmpValues = [...cmpMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v)
    const mean = (arr: number[]) => (arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length)
    const baseAvg = mean(values)
    const compareAvg = mean(cmpValues)
    const avgYoyChange = compareAvg > 0 ? ((baseAvg - compareAvg) / compareAvg) * 100 : 0

    return {
      total,
      baseAvg,
      compareAvg,
      avgYoyChange,
      maxPeriod: periods[maxIdx]?.[0] ?? "",
      maxValue: values[maxIdx] ?? 0,
      minPeriod: periods[minIdx]?.[0] ?? "",
      minValue: values[minIdx] ?? 0,
    }
  }, [data, compareData, metric])

  // Comparison data (案A): align base vs compare by elapsed period index (1日目/1週目/1か月目 …)
  const comparisonData = useMemo<CompareRow[]>(() => {
    if (!compareSet) return []
    const baseMap = new Map<string, number>()
    for (const d of data) baseMap.set(d.PERIOD, (baseMap.get(d.PERIOD) ?? 0) + d.METRIC_VALUE)
    const baseArr = [...baseMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    const cmpMap = new Map<string, number>()
    for (const d of compareData) cmpMap.set(d.PERIOD, (cmpMap.get(d.PERIOD) ?? 0) + d.METRIC_VALUE)
    const cmpArr = [...cmpMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    const len = Math.max(baseArr.length, cmpArr.length)
    const rows: CompareRow[] = []
    for (let i = 0; i < len; i++) {
      rows.push({
        label: `${i + 1}${periodUnit}目`,
        base: baseArr[i]?.[1] ?? null,
        compare: cmpArr[i]?.[1] ?? null,
        baseDate: baseArr[i]?.[0] ?? "",
        compareDate: cmpArr[i]?.[0] ?? "",
      })
    }
    return rows
  }, [data, compareData, compareSet, periodUnit])

  const exportExcel = async () => {
    if (data.length === 0) return
    const XLSX = await import("xlsx")
    const header = ["期間", ...(groupBy !== "total" ? ["カテゴリ"] : []), metricConfig.label, "店舗数", "会員数"]
    const aoa = [
      header,
      ...data.map((r) => [
        r.PERIOD,
        ...(groupBy !== "total" ? [r.SERIES_NAME ?? ""] : []),
        r.METRIC_VALUE,
        r.STORE_COUNT,
        r.MEMBER_COUNT,
      ]),
    ]
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "トレンド分析")
    XLSX.writeFile(wb, `trend_${granularity}_${metric}_${groupBy}.xlsx`)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: "var(--foreground)" }}><TrendingUp className="h-6 w-6" style={{ color: "var(--brand-primary)" }} />トレンド分析結果</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            分析期間 {conditions.baseStart}〜{conditions.baseEnd}
            {" / "}
            {conditions.storeCodes.length ? `${conditions.storeCodes.length}店舗` : "全店舗"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/analysis/conditions">条件を変更</Link>
          </Button>
          <Button variant="outline" onClick={exportExcel} disabled={data.length === 0}>
            <Download className="h-4 w-4" />
            Excel出力
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      {kpis && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>基準期間 {metricConfig.label}{totalLabel}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: "var(--foreground)" }}>
              {metricConfig.format(kpis.total)}
            </p>
          </div>
          {compareSet && (
            <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>前期比（1{periodUnit}あたり平均）</p>
              <p className={`text-2xl font-bold mt-1 ${kpis.avgYoyChange >= 0 ? "text-green-500" : "text-red-500"}`}>
                {kpis.avgYoyChange >= 0 ? "+" : ""}{kpis.avgYoyChange.toFixed(1)}%
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                基準 {metricConfig.format(kpis.baseAvg)} / 比較 {metricConfig.format(kpis.compareAvg)}
              </p>
            </div>
          )}
          <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>最高{periodUnit}（基準期間）</p>
            <p className="text-2xl font-bold mt-1" style={{ color: "var(--foreground)" }}>{kpis.maxPeriod}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{metricConfig.format(kpis.maxValue)}</p>
          </div>
          <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>最低{periodUnit}（基準期間）</p>
            <p className="text-2xl font-bold mt-1" style={{ color: "var(--foreground)" }}>{kpis.minPeriod}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{metricConfig.format(kpis.minValue)}</p>
          </div>
        </div>
      )}

      {/* Tab: 推移グラフ / 期間比較 */}
      <Segmented
        options={[{ key: "trend", label: "推移グラフ" }, { key: "comparison", label: "期間比較" }]}
        value={activeTab}
        onChange={(v) => setActiveTab(v)}
      />

      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>集計単位</span>
          <Segmented
            options={GRANULARITY_OPTIONS.map((o) => ({ key: o.id, label: o.label }))}
            value={granularity}
            onChange={(v) => setGranularity(v)}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>集計軸</span>
          <Segmented
            options={GROUPBY_OPTIONS.map((o) => ({ key: o.id, label: o.label }))}
            value={groupBy}
            onChange={(v) => setGroupBy(v)}
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>表示指標</span>
          <Segmented
            options={METRIC_OPTIONS.map((o) => ({ key: o.id, label: o.label }))}
            value={metric}
            onChange={(v) => setMetric(v)}
            variant="red"
          />
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
            ) : compareSet ? (
              <>
                <p className="text-xs mb-3" style={{ color: "var(--muted-foreground)" }}>
                  経過{periodUnit}数で整列（
                  <span style={{ color: "var(--brand-primary)" }}>基準 {conditions.baseStart}〜{conditions.baseEnd}</span>
                  {" / "}
                  <span style={{ color: SEMANTIC.emphasis }}>比較 {conditions.compareStart}〜{conditions.compareEnd}</span>
                  ）
                </p>
                <ComparisonChart data={comparisonData} metricConfig={metricConfig} />
              </>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <CalendarClock className="h-10 w-10" style={{ color: "var(--muted-foreground)" }} />
                <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>比較期間が設定されていません</p>
                <p className="text-xs max-w-xs" style={{ color: "var(--muted-foreground)" }}>
                  期間比較を表示するには、条件設定で「比較期間」を有効にして期間を指定してください。
                </p>
                <Link
                  href="/analysis/conditions"
                  className="mt-1 inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "var(--brand-primary)" }}
                >
                  <CalendarClock className="h-4 w-4" />
                  比較期間を設定する
                </Link>
              </div>
            )}
          </div>

          {/* Report table */}
          <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
              <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>帳票</span>
              <button
                onClick={exportExcel}
                disabled={data.length === 0}
                className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors hover:bg-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed"
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
