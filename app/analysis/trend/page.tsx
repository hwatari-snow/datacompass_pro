"use client"

import { useState, useEffect, useMemo } from "react"
import {
  ComposedChart, Line, Bar, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from "recharts"
import { Download } from "lucide-react"
import { useConditions } from "@/components/conditions-context"

type TabType = "trend" | "comparison"
type Granularity = "monthly" | "weekly" | "daily"
type Metric = "sales" | "quantity" | "receipts" | "unit_price"

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

interface TrendRow {
  PERIOD: string
  METRIC_VALUE: number
  STORE_COUNT: number
  MEMBER_COUNT: number
}

export default function TrendPage() {
  const { conditions } = useConditions()
  const [activeTab, setActiveTab] = useState<TabType>("trend")
  const [granularity, setGranularity] = useState<Granularity>("monthly")
  const [metric, setMetric] = useState<Metric>("sales")
  const [data, setData] = useState<TrendRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const metricConfig = METRIC_OPTIONS.find((m) => m.id === metric)!

  useEffect(() => {
    setLoading(true)
    setError("")
    const params = new URLSearchParams({ granularity, metric })
    if (conditions.baseStart) params.set("baseStart", conditions.baseStart)
    if (conditions.baseEnd) params.set("baseEnd", conditions.baseEnd)
    if (conditions.storeCodes.length) params.set("storeCodes", conditions.storeCodes.join(","))
    if (conditions.itemCodes.length) params.set("itemCodes", conditions.itemCodes.join(","))
    fetch(`/api/trend?${params}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.error) setError(res.error)
        else setData(res.data ?? [])
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [granularity, metric, conditions.baseStart, conditions.baseEnd, conditions.storeCodes, conditions.itemCodes])

  // Compute KPIs
  const kpis = useMemo(() => {
    if (data.length === 0) return null
    const values = data.map((d) => d.METRIC_VALUE)
    const total = values.reduce((s, v) => s + v, 0)
    const maxIdx = values.indexOf(Math.max(...values))
    const minIdx = values.indexOf(Math.min(...values))
    const mid = Math.floor(data.length / 2)
    const baseTotal = values.slice(mid).reduce((s, v) => s + v, 0)
    const compareTotal = values.slice(0, mid).reduce((s, v) => s + v, 0)
    const yoyChange = compareTotal > 0 ? ((baseTotal - compareTotal) / compareTotal) * 100 : 0

    return {
      total,
      yoyChange,
      compareTotal,
      maxPeriod: data[maxIdx]?.PERIOD ?? "",
      maxValue: values[maxIdx] ?? 0,
      minPeriod: data[minIdx]?.PERIOD ?? "",
      minValue: values[minIdx] ?? 0,
    }
  }, [data])

  // Comparison data: split into base and compare periods
  const comparisonData = useMemo(() => {
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
  }, [data])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>トレンド分析結果</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            指標: {metricConfig.label}
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
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={data} margin={{ top: 10, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="PERIOD" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
                  <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }}
                    labelStyle={{ color: "var(--foreground)" }}
                    formatter={(value: number) => [metricConfig.format(value), metricConfig.label]}
                  />
                  <Area type="monotone" dataKey="METRIC_VALUE" fill="#3b82f6" fillOpacity={0.08} stroke="none" />
                  <Line type="monotone" dataKey="METRIC_VALUE" name={metricConfig.label} stroke="#3b82f6" strokeWidth={2.5} dot={{ fill: "#3b82f6", r: 3 }} activeDot={{ r: 5 }} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={comparisonData} margin={{ top: 10, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="period" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
                  <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }}
                    labelStyle={{ color: "var(--foreground)" }}
                  />
                  <Legend />
                  <ReferenceLine y={0} stroke="var(--border)" />
                  <Bar dataKey="diff" name="差分" fill="#94a3b8" fillOpacity={0.6} radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="base" name="基準期間" stroke="#3b82f6" strokeWidth={2} dot={{ fill: "#3b82f6", r: 3 }} />
                  <Line type="monotone" dataKey="compare" name="比較期間" stroke="#ef4444" strokeWidth={2} dot={{ fill: "#ef4444", r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: "var(--muted)" }}>
                    <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>期間</th>
                    <th className="px-3 py-2 text-right text-xs font-medium" style={{ color: "var(--brand-primary)" }}>{metricConfig.label}</th>
                    <th className="px-3 py-2 text-right text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>店舗数</th>
                    <th className="px-3 py-2 text-right text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>会員数</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, i) => (
                    <tr key={i} className="border-t" style={{ borderColor: "var(--border)" }}>
                      <td className="px-3 py-2 font-medium" style={{ color: "var(--foreground)" }}>{row.PERIOD}</td>
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
