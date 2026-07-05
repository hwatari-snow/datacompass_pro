"use client"

import { useState, useEffect, useMemo } from "react"
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts"
import { Filter, Download } from "lucide-react"
import { useConditions } from "@/components/conditions-context"

async function safeFetch(url: string) {
  const res = await fetch(url)
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(text.slice(0, 120))
  }
}

type TabType = "age_gender" | "area" | "behavior" | "trial_repeat"
type ViewMode = "gender" | "age" | "age_gender"
type MetricKey = "buyer_share" | "buyers" | "purchase_rate" | "repeat_rate" | "avg_spend" | "avg_frequency"

const TABS: { id: TabType; label: string }[] = [
  { id: "age_gender", label: "① 性年代別分析" },
  { id: "area", label: "② エリア別分析" },
  { id: "behavior", label: "③ 購買行動分析" },
  { id: "trial_repeat", label: "④ トライアル/リピート" },
]

const METRICS: { key: MetricKey; label: string; format: (v: number) => string }[] = [
  { key: "buyer_share", label: "購入者構成比", format: (v) => `${v}%` },
  { key: "buyers", label: "購入者数", format: (v) => v.toLocaleString() },
  { key: "purchase_rate", label: "購入率", format: (v) => `${v}%` },
  { key: "repeat_rate", label: "リピート率", format: (v) => `${v}%` },
  { key: "avg_spend", label: "平均購入金額", format: (v) => `¥${v.toLocaleString()}` },
  { key: "avg_frequency", label: "平均購入回数", format: (v) => `${v}回` },
]

const VIEW_MODES: { key: ViewMode; label: string }[] = [
  { key: "gender", label: "男女別" },
  { key: "age", label: "年代別" },
  { key: "age_gender", label: "男女年代別" },
]

const COLORS = { male: "#4A90D9", female: "#E8719E", accent: "#5BC8AC" }
const PIE_COLORS = ["#5BC8AC", "#4A90D9", "#E8719E", "#E6D72A", "#F18D9E", "#95A5A6", "#8E44AD", "#E67E22"]

interface AgeGenderRow {
  AGE_GROUP: string; GENDER: string; BUYERS: number; TOTAL_SALES: number;
  AVG_SPEND: number; AVG_FREQUENCY: number; REPEATERS: number;
}
interface SummaryRow {
  ACTIVE_MEMBERS: number; TOTAL_SALES: number; TOTAL_TRANSACTIONS: number;
  AVG_BASKET: number; AVG_ITEMS: number; TOTAL_MEMBERS: number;
}

function formatNum(n: number) {
  if (n >= 100000000) return (n / 100000000).toFixed(1) + "億"
  if (n >= 10000) return (n / 10000).toFixed(1) + "万"
  return n.toLocaleString()
}

export default function ResultsPage() {
  const { conditions } = useConditions()
  const [activeTab, setActiveTab] = useState<TabType>("age_gender")
  const [metric, setMetric] = useState<MetricKey>("buyer_share")
  const [viewMode, setViewMode] = useState<ViewMode>("age_gender")
  const [data, setData] = useState<AgeGenderRow[]>([])
  const [summary, setSummary] = useState<SummaryRow | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [categories, setCategories] = useState<string[]>([])
  const [areas, setAreas] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState("")
  const [selectedArea, setSelectedArea] = useState("")

  useEffect(() => {
    safeFetch("/api/analysis/filters").then((res) => {
      setCategories(res.categories ?? [])
      setAreas(res.areas ?? [])
    }).catch(() => {})
  }, [])

  // Fetch summary KPIs
  useEffect(() => {
    const params = new URLSearchParams({ type: "summary" })
    if (selectedCategory) params.set("category", selectedCategory)
    if (selectedArea) params.set("area", selectedArea)
    if (conditions.baseStart) params.set("baseStart", conditions.baseStart)
    if (conditions.baseEnd) params.set("baseEnd", conditions.baseEnd)
    if (conditions.storeCodes.length) params.set("storeCodes", conditions.storeCodes.join(","))
    if (conditions.itemCodes.length) params.set("itemCodes", conditions.itemCodes.join(","))
    safeFetch(`/api/analysis?${params}`).then((res) => {
      setSummary(res.data?.[0] ?? null)
    }).catch(() => {})
  }, [selectedCategory, selectedArea, conditions.baseStart, conditions.baseEnd, conditions.storeCodes, conditions.itemCodes])

  // Fetch tab data
  useEffect(() => {
    setLoading(true)
    setError("")
    const params = new URLSearchParams({ type: activeTab })
    if (selectedCategory) params.set("category", selectedCategory)
    if (selectedArea) params.set("area", selectedArea)
    if (conditions.baseStart) params.set("baseStart", conditions.baseStart)
    if (conditions.baseEnd) params.set("baseEnd", conditions.baseEnd)
    if (conditions.storeCodes.length) params.set("storeCodes", conditions.storeCodes.join(","))
    if (conditions.itemCodes.length) params.set("itemCodes", conditions.itemCodes.join(","))
    safeFetch(`/api/analysis?${params}`).then((res) => {
      if (res.error) setError(res.error)
      else setData(res.data ?? [])
    }).catch((e) => setError(e.message)).finally(() => setLoading(false))
  }, [activeTab, selectedCategory, selectedArea, conditions.baseStart, conditions.baseEnd, conditions.storeCodes, conditions.itemCodes])

  const metricConfig = METRICS.find((m) => m.key === metric)!

  // Compute derived metrics for age_gender tab
  const totalBuyers = useMemo(() => data.reduce((s, d) => s + (d.BUYERS ?? 0), 0), [data])

  const chartData = useMemo(() => {
    if (activeTab !== "age_gender" || !data.length) return []
    const ageGroups = [...new Set(data.map((d) => d.AGE_GROUP))].sort()

    if (viewMode === "age_gender") {
      return ageGroups.map((ag) => {
        const male = data.find((d) => d.AGE_GROUP === ag && d.GENDER === "男性")
        const female = data.find((d) => d.AGE_GROUP === ag && d.GENDER === "女性")
        const getVal = (row: AgeGenderRow | undefined) => {
          if (!row) return 0
          switch (metric) {
            case "buyer_share": return totalBuyers > 0 ? Math.round(row.BUYERS / totalBuyers * 1000) / 10 : 0
            case "buyers": return row.BUYERS
            case "purchase_rate": return 0 // would need total members per group
            case "repeat_rate": return row.BUYERS > 0 ? Math.round(row.REPEATERS / row.BUYERS * 1000) / 10 : 0
            case "avg_spend": return row.AVG_SPEND
            case "avg_frequency": return row.AVG_FREQUENCY
          }
        }
        return { age: ag, 男性: getVal(male), 女性: getVal(female) }
      })
    }
    if (viewMode === "age") {
      return ageGroups.map((ag) => {
        const rows = data.filter((d) => d.AGE_GROUP === ag)
        const buyers = rows.reduce((s, d) => s + d.BUYERS, 0)
        const repeaters = rows.reduce((s, d) => s + d.REPEATERS, 0)
        const totalSpend = rows.reduce((s, d) => s + d.AVG_SPEND * d.BUYERS, 0)
        const totalFreq = rows.reduce((s, d) => s + d.AVG_FREQUENCY * d.BUYERS, 0)
        let value = 0
        switch (metric) {
          case "buyer_share": value = totalBuyers > 0 ? Math.round(buyers / totalBuyers * 1000) / 10 : 0; break
          case "buyers": value = buyers; break
          case "repeat_rate": value = buyers > 0 ? Math.round(repeaters / buyers * 1000) / 10 : 0; break
          case "avg_spend": value = buyers > 0 ? Math.round(totalSpend / buyers) : 0; break
          case "avg_frequency": value = buyers > 0 ? Math.round(totalFreq / buyers * 10) / 10 : 0; break
          default: value = buyers
        }
        return { age: ag, value }
      })
    }
    // gender
    const genders = ["男性", "女性"]
    return genders.map((g) => {
      const rows = data.filter((d) => d.GENDER === g)
      const buyers = rows.reduce((s, d) => s + d.BUYERS, 0)
      const repeaters = rows.reduce((s, d) => s + d.REPEATERS, 0)
      const totalSpend = rows.reduce((s, d) => s + d.AVG_SPEND * d.BUYERS, 0)
      const totalFreq = rows.reduce((s, d) => s + d.AVG_FREQUENCY * d.BUYERS, 0)
      let value = 0
      switch (metric) {
        case "buyer_share": value = totalBuyers > 0 ? Math.round(buyers / totalBuyers * 1000) / 10 : 0; break
        case "buyers": value = buyers; break
        case "repeat_rate": value = buyers > 0 ? Math.round(repeaters / buyers * 1000) / 10 : 0; break
        case "avg_spend": value = buyers > 0 ? Math.round(totalSpend / buyers) : 0; break
        case "avg_frequency": value = buyers > 0 ? Math.round(totalFreq / buyers * 10) / 10 : 0; break
        default: value = buyers
      }
      return { label: g, value }
    })
  }, [data, activeTab, viewMode, metric, totalBuyers])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>属性分析結果</h1>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>ID-POS会員の属性・行動パターンを多軸で分析</p>
        </div>
        <button className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-[var(--accent)]" style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
          <Download className="h-3.5 w-3.5" /> Excel DL
        </button>
      </div>

      {/* KPI Strip */}
      {summary && (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {[
            { label: "ユニーク会員数", value: formatNum(summary.ACTIVE_MEMBERS), unit: "人", highlight: true },
            { label: "総売上金額", value: `¥${formatNum(summary.TOTAL_SALES)}`, unit: "", highlight: true },
            { label: "総取引件数", value: formatNum(summary.TOTAL_TRANSACTIONS), unit: "件" },
            { label: "平均客単価", value: `¥${formatNum(summary.AVG_BASKET)}`, unit: "" },
            { label: "平均買上点数", value: String(summary.AVG_ITEMS ?? 0), unit: "点" },
            { label: "総会員数", value: formatNum(summary.TOTAL_MEMBERS), unit: "人" },
          ].map((kpi, i) => (
            <div key={i} className="flex-1 min-w-[130px] rounded-xl p-4 text-center" style={{ backgroundColor: kpi.highlight ? "rgba(91, 200, 172, 0.08)" : "var(--muted)" }}>
              <p className="text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>{kpi.label}</p>
              <p className="text-xl font-bold mt-1" style={{ color: kpi.highlight ? "#2A9D8F" : "var(--foreground)" }}>
                {kpi.value}<span className="text-xs font-normal ml-0.5" style={{ color: "var(--muted-foreground)" }}>{kpi.unit}</span>
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border p-3" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-center gap-1.5" style={{ color: "var(--muted-foreground)" }}>
          <Filter className="h-4 w-4" /><span className="text-xs font-medium">フィルター</span>
        </div>
        <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="rounded-md border px-3 py-1.5 text-sm outline-none" style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}>
          <option value="">全カテゴリ</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={selectedArea} onChange={(e) => setSelectedArea(e.target.value)} className="rounded-md border px-3 py-1.5 text-sm outline-none" style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}>
          <option value="">全エリア</option>
          {areas.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        {(selectedCategory || selectedArea) && (
          <button onClick={() => { setSelectedCategory(""); setSelectedArea("") }} className="rounded-md px-2 py-1 text-xs hover:bg-[var(--accent)]" style={{ color: "var(--muted-foreground)" }}>クリア</button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b" style={{ borderColor: "var(--border)" }}>
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className="px-5 py-3 text-sm font-medium relative transition-colors"
            style={{ color: activeTab === tab.id ? COLORS.accent : "var(--muted-foreground)" }}
          >
            {tab.label}
            {activeTab === tab.id && <span className="absolute bottom-0 left-0 right-0 h-[3px] rounded-t" style={{ backgroundColor: COLORS.accent }} />}
          </button>
        ))}
      </div>

      {/* Age Gender specific controls */}
      {activeTab === "age_gender" && (
        <div className="space-y-3">
          {/* View mode toggle */}
          <div className="flex gap-2">
            {VIEW_MODES.map((v) => (
              <button key={v.key} onClick={() => setViewMode(v.key)}
                className="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
                style={viewMode === v.key ? { backgroundColor: "var(--foreground)", color: "var(--background)", borderColor: "var(--foreground)" } : { borderColor: "var(--border)", color: "var(--muted-foreground)" }}
              >{v.label}</button>
            ))}
          </div>
          {/* Metric selector */}
          <div className="flex flex-wrap gap-1.5">
            {METRICS.map((m) => (
              <button key={m.key} onClick={() => setMetric(m.key)}
                className="rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
                style={metric === m.key ? { backgroundColor: COLORS.accent, color: "white", borderColor: COLORS.accent } : { borderColor: "var(--border)", color: "var(--muted-foreground)" }}
              >{m.label}</button>
            ))}
          </div>
        </div>
      )}

      {/* Loading / Error */}
      {loading && (
        <div className="flex h-48 items-center justify-center rounded-xl border" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2" style={{ color: "var(--muted-foreground)" }}>
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />分析データを取得中...
          </div>
        </div>
      )}
      {error && <div className="rounded-xl border border-red-500/30 p-4" style={{ backgroundColor: "var(--card)" }}><p className="text-sm text-red-400">{error}</p></div>}

      {/* Chart */}
      {!loading && !error && activeTab === "age_gender" && chartData.length > 0 && (
        <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--foreground)" }}>
            {metricConfig.label}（{VIEW_MODES.find((v) => v.key === viewMode)?.label}）
          </h3>
          {viewMode === "age_gender" && (
            <div className="flex gap-4 justify-center mb-2">
              <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--muted-foreground)" }}><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS.male }} />男性</span>
              <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--muted-foreground)" }}><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS.female }} />女性</span>
            </div>
          )}
          <ResponsiveContainer width="100%" height={350}>
            {viewMode === "age_gender" ? (
              <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="age" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Bar dataKey="男性" fill={COLORS.male} radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="女性" fill={COLORS.female} radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            ) : viewMode === "age" ? (
              <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="age" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Bar dataKey="value" name={metricConfig.label} fill={COLORS.accent} radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            ) : (
              <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fill: "var(--muted-foreground)", fontSize: 13 }} />
                <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Bar dataKey="value" name={metricConfig.label} radius={[6, 6, 0, 0]} barSize={60}>
                  {chartData.map((d, i) => <Cell key={i} fill={(d as { label?: string }).label === "男性" ? COLORS.male : COLORS.female} />)}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}

      {/* Area / Behavior / Trial Repeat - generic table */}
      {!loading && !error && activeTab !== "age_gender" && data.length > 0 && (
        <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          {activeTab === "trial_repeat" ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={data} dataKey="MEMBER_COUNT" nameKey="SEGMENT" cx="50%" cy="50%" outerRadius={100} innerRadius={50} label={({ SEGMENT, percent }) => `${SEGMENT} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={data} margin={{ top: 5, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey={activeTab === "area" ? "AREA_NAME" : "DAY_OF_WEEK"} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Legend />
                <Bar dataKey="TOTAL_SALES" name="売上金額" fill={COLORS.accent} radius={[4, 4, 0, 0]} />
                <Bar dataKey="BUYERS" name="購入者数" fill={COLORS.male} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Detail table for age_gender */}
      {!loading && !error && activeTab === "age_gender" && data.length > 0 && (
        <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
            <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{VIEW_MODES.find((v) => v.key === viewMode)?.label} 詳細テーブル</span>
            <button
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold transition-colors hover:opacity-80"
              style={{ borderColor: "var(--brand-green)", color: "var(--brand-green)" }}
            >
              <Download className="h-3 w-3" />Excelダウンロード
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: "var(--muted)" }}>
                  <th className="px-3 py-2 text-left text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>年代</th>
                  {viewMode === "age_gender" && <th className="px-3 py-2 text-left text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>性別</th>}
                  <th className="px-3 py-2 text-right text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>構成比</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>購入者数</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>リピート率</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>平均金額</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>平均回数</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => {
                  const share = totalBuyers > 0 ? Math.round(row.BUYERS / totalBuyers * 1000) / 10 : 0
                  const repeatRate = row.BUYERS > 0 ? Math.round(row.REPEATERS / row.BUYERS * 1000) / 10 : 0
                  return (
                    <tr key={i} className="border-t" style={{ borderColor: "var(--border)" }}>
                      <td className="px-3 py-2 font-medium" style={{ color: "var(--foreground)" }}>{row.AGE_GROUP}</td>
                      {viewMode === "age_gender" && (
                        <td className="px-3 py-2" style={{ color: row.GENDER === "男性" ? COLORS.male : COLORS.female }}>{row.GENDER}</td>
                      )}
                      <td className="px-3 py-2 text-right" style={{ color: "var(--foreground)" }}>{share}%</td>
                      <td className="px-3 py-2 text-right" style={{ color: "var(--foreground)" }}>{row.BUYERS?.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right" style={{ color: "var(--foreground)" }}>{repeatRate}%</td>
                      <td className="px-3 py-2 text-right" style={{ color: "var(--foreground)" }}>¥{row.AVG_SPEND?.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right" style={{ color: "var(--foreground)" }}>{row.AVG_FREQUENCY}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && !error && data.length === 0 && (
        <div className="flex h-48 items-center justify-center rounded-xl border" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <span style={{ color: "var(--muted-foreground)" }}>該当するデータがありません</span>
        </div>
      )}
    </div>
  )
}
