"use client"

import { useState, useEffect, useMemo } from "react"
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ScatterChart, Scatter, ZAxis,
} from "recharts"
import { useConditions } from "@/components/conditions-context"
import s from "./results.module.css"
import { CHART_COLORS, GENDER, SEG_COLORS as SEG, SEMANTIC } from "@/lib/palette"

const COLORS = { male: GENDER.male, female: GENDER.female, accent: CHART_COLORS[4], accent2: CHART_COLORS[1], accent3: CHART_COLORS[7] }
const PALETTE = CHART_COLORS
const SEG_COLORS: Record<string, string> = SEG
const DAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"]

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

function formatNum(n: number) {
  if (n >= 100000000) return (n / 100000000).toFixed(1) + "億"
  if (n >= 10000) return (n / 10000).toFixed(1) + "万"
  return n.toLocaleString()
}
function round1(n: number) { return Math.round(n * 10) / 10 }

async function safeFetch(url: string) {
  const res = await fetch(url)
  const text = await res.text()
  try { return JSON.parse(text) } catch { throw new Error(text.slice(0, 120)) }
}

interface SummaryData { ACTIVE_MEMBERS: number; TOTAL_SALES: number; TOTAL_TRANSACTIONS: number; AVG_BASKET: number; AVG_ITEMS: number; TOTAL_MEMBERS: number }
interface AgeGenderRow { AGE_GROUP: string; GENDER: string; BUYERS: number; TOTAL_SALES: number; AVG_SPEND: number; AVG_FREQUENCY: number; REPEATERS: number }
interface AreaRow { AREA_NAME: string; TOTAL_SALES: number; TRANSACTIONS: number; BUYERS: number; STORE_COUNT: number; AVG_BASKET: number }
interface BehaviorRow { DAY_OF_WEEK: number; TOTAL_SALES: number; TRANSACTIONS: number; BUYERS: number }
interface FreqRow { COUNT: number; BUYERS: number; SALES: number; SHARE: number; SALES_SHARE: number }

export default function ResultsPage() {
  const { conditions } = useConditions()
  const [tab, setTab] = useState<TabType>("age_gender")
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [ageData, setAgeData] = useState<AgeGenderRow[]>([])
  const [areaData, setAreaData] = useState<AreaRow[]>([])
  const [behaviorData, setBehaviorData] = useState<BehaviorRow[]>([])
  const [freqData, setFreqData] = useState<FreqRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const baseParams = useMemo(() => {
    const p = new URLSearchParams()
    if (conditions.baseStart) p.set("baseStart", conditions.baseStart)
    if (conditions.baseEnd) p.set("baseEnd", conditions.baseEnd)
    if (conditions.storeCodes.length) p.set("storeCodes", conditions.storeCodes.join(","))
    if (conditions.mdCodes.length) p.set("mdCodes", conditions.mdCodes.join(","))
    if (conditions.majorCodes.length) p.set("majorCodes", conditions.majorCodes.join(","))
    if (conditions.middleCodes.length) p.set("middleCodes", conditions.middleCodes.join(","))
    return p.toString()
  }, [conditions.baseStart, conditions.baseEnd, conditions.storeCodes, conditions.mdCodes, conditions.majorCodes, conditions.middleCodes])

  useEffect(() => {
    safeFetch(`/api/analysis?type=summary&${baseParams}`).then((r) => setSummary(r.data?.[0] ?? null)).catch(() => {})
  }, [baseParams])

  useEffect(() => {
    setLoading(true); setError("")
    safeFetch(`/api/analysis?type=${tab}&${baseParams}`)
      .then((r) => {
        if (r.error) { setError(r.error); return }
        const d = r.data ?? []
        if (tab === "age_gender") setAgeData(d)
        else if (tab === "area") setAreaData(d)
        else if (tab === "behavior") setBehaviorData(d)
        else if (tab === "trial_repeat") setFreqData(d)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [tab, baseParams])

  return (
    <main className="w-full py-8 px-6">
      {/* Header — same style as ABC page */}
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold">属性分析結果</h1>
      </div>
      {conditions && (
        <p className="text-sm text-muted-foreground mb-6">
          分析期間 {conditions.baseStart}〜{conditions.baseEnd}
          {" / "}
          {conditions.storeCodes.length ? `${conditions.storeCodes.length}店舗` : "全店舗"}
        </p>
      )}

      {/* KPI Strip */}
      {summary && (
        <div className={s.kpiStrip}>
          {[
            { label: "ユニーク会員数", value: formatNum(summary.ACTIVE_MEMBERS), unit: "人", hl: true },
            { label: "総売上金額", value: `¥${formatNum(summary.TOTAL_SALES)}`, unit: "", hl: true },
            { label: "総取引件数", value: formatNum(summary.TOTAL_TRANSACTIONS), unit: "件", hl: false },
            { label: "平均客単価", value: `¥${formatNum(summary.AVG_BASKET)}`, unit: "", hl: false },
            { label: "平均買上点数", value: String(summary.AVG_ITEMS ?? 0), unit: "点", hl: false },
            { label: "総会員数", value: formatNum(summary.TOTAL_MEMBERS), unit: "人", hl: false },
          ].map((k, i) => (
            <div key={i} className={`${s.kpiCard} ${k.hl ? s.highlight : ""}`}>
              <div className={s.kpiLabel}>{k.label}</div>
              <div className={s.kpiValue}>{k.value}<span className={s.kpiUnit}>{k.unit}</span></div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className={s.tabNav}>
        {TABS.map((t) => (
          <button key={t.id} className={`${s.tabBtn} ${tab === t.id ? s.active : ""}`} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {/* Content */}
      <div>
        {loading && <div className={s.loading}>分析データを取得中...</div>}
        {error && <div className={s.error}>{error}</div>}
        {!loading && !error && tab === "age_gender" && <AgeGenderTab data={ageData} />}
        {!loading && !error && tab === "area" && <AreaTab data={areaData} />}
        {!loading && !error && tab === "behavior" && <BehaviorTab data={behaviorData} />}
        {!loading && !error && tab === "trial_repeat" && <TrialRepeatTab data={freqData} />}
      </div>
    </main>
  )
}

/* ============ Age Gender Tab ============ */
function AgeGenderTab({ data }: { data: AgeGenderRow[] }) {
  const [metric, setMetric] = useState<MetricKey>("buyer_share")
  const [viewMode, setViewMode] = useState<ViewMode>("age_gender")
  const m = METRICS.find((x) => x.key === metric)!

  const totalBuyers = useMemo(() => data.reduce((acc, d) => acc + (d.BUYERS ?? 0), 0), [data])
  const ageBins = useMemo(() => [...new Set(data.map((d) => d.AGE_GROUP))].sort(), [data])

  const getVal = (row: AgeGenderRow | undefined) => {
    if (!row) return 0
    switch (metric) {
      case "buyer_share": return totalBuyers > 0 ? round1(row.BUYERS / totalBuyers * 100) : 0
      case "buyers": return row.BUYERS
      case "repeat_rate": return row.BUYERS > 0 ? round1(row.REPEATERS / row.BUYERS * 100) : 0
      case "avg_spend": return row.AVG_SPEND
      case "avg_frequency": return row.AVG_FREQUENCY
      default: return row.BUYERS
    }
  }

  const chartData = useMemo(() => {
    if (viewMode === "age_gender") {
      return ageBins.map((ag) => ({
        age: ag,
        男性: getVal(data.find((d) => d.AGE_GROUP === ag && d.GENDER === "男性")),
        女性: getVal(data.find((d) => d.AGE_GROUP === ag && d.GENDER === "女性")),
      }))
    }
    if (viewMode === "age") {
      return ageBins.map((ag) => {
        const rows = data.filter((d) => d.AGE_GROUP === ag)
        const buyers = rows.reduce((acc, d) => acc + d.BUYERS, 0)
        const repeaters = rows.reduce((acc, d) => acc + d.REPEATERS, 0)
        const spendSum = rows.reduce((acc, d) => acc + d.AVG_SPEND * d.BUYERS, 0)
        const freqSum = rows.reduce((acc, d) => acc + d.AVG_FREQUENCY * d.BUYERS, 0)
        let value = 0
        switch (metric) {
          case "buyer_share": value = totalBuyers > 0 ? round1(buyers / totalBuyers * 100) : 0; break
          case "buyers": value = buyers; break
          case "repeat_rate": value = buyers > 0 ? round1(repeaters / buyers * 100) : 0; break
          case "avg_spend": value = buyers > 0 ? Math.round(spendSum / buyers) : 0; break
          case "avg_frequency": value = buyers > 0 ? round1(freqSum / buyers) : 0; break
          default: value = buyers
        }
        return { age: ag, value }
      })
    }
    return ["男性", "女性"].map((g) => {
      const rows = data.filter((d) => d.GENDER === g)
      const buyers = rows.reduce((acc, d) => acc + d.BUYERS, 0)
      const repeaters = rows.reduce((acc, d) => acc + d.REPEATERS, 0)
      const spendSum = rows.reduce((acc, d) => acc + d.AVG_SPEND * d.BUYERS, 0)
      const freqSum = rows.reduce((acc, d) => acc + d.AVG_FREQUENCY * d.BUYERS, 0)
      let value = 0
      switch (metric) {
        case "buyer_share": value = totalBuyers > 0 ? round1(buyers / totalBuyers * 100) : 0; break
        case "buyers": value = buyers; break
        case "repeat_rate": value = buyers > 0 ? round1(repeaters / buyers * 100) : 0; break
        case "avg_spend": value = buyers > 0 ? Math.round(spendSum / buyers) : 0; break
        case "avg_frequency": value = buyers > 0 ? round1(freqSum / buyers) : 0; break
        default: value = buyers
      }
      return { label: g, value }
    })
  }, [data, viewMode, metric, totalBuyers, ageBins])

  const VIEW_MODES: { key: ViewMode; label: string }[] = [
    { key: "gender", label: "男女別" }, { key: "age", label: "年代別" }, { key: "age_gender", label: "男女年代別" },
  ]

  return (
    <div>
      <div className={s.sectionTitle}><span className={s.dot} />属性分析</div>
      <div className={s.toggleRow}>
        {VIEW_MODES.map((v) => (
          <button key={v.key} className={`${s.toggleBtn} ${viewMode === v.key ? s.active : ""}`} onClick={() => setViewMode(v.key)}>{v.label}</button>
        ))}
      </div>
      <div className={s.metricSelector}>
        {METRICS.map((mt) => (
          <button key={mt.key} className={`${s.metricBtn} ${metric === mt.key ? s.active : ""}`} onClick={() => setMetric(mt.key)}>{mt.label}</button>
        ))}
      </div>
      <div className={s.card}>
        <div className={s.cardTitle}>{m.label}（{VIEW_MODES.find((v) => v.key === viewMode)?.label}）</div>
        {viewMode === "age_gender" && (
          <div className={s.legendRow}>
            <span className={s.legendItem}><span className={s.legendDot} style={{ background: COLORS.male }} />男性</span>
            <span className={s.legendItem}><span className={s.legendDot} style={{ background: COLORS.female }} />女性</span>
          </div>
        )}
        <ResponsiveContainer width="100%" height={360}>
          {viewMode === "age_gender" ? (
            <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8ECF0" />
              <XAxis dataKey="age" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="男性" fill={COLORS.male} radius={[4, 4, 0, 0]} barSize={20} />
              <Bar dataKey="女性" fill={COLORS.female} radius={[4, 4, 0, 0]} barSize={20} />
            </BarChart>
          ) : viewMode === "age" ? (
            <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8ECF0" />
              <XAxis dataKey="age" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" name={m.label} fill={COLORS.accent} radius={[4, 4, 0, 0]} barSize={32} />
            </BarChart>
          ) : (
            <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8ECF0" />
              <XAxis dataKey="label" tick={{ fontSize: 13 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" name={m.label} radius={[6, 6, 0, 0]} barSize={60}>
                {(chartData as { label?: string }[]).map((d, i) => <Cell key={i} fill={d.label === "男性" ? COLORS.male : COLORS.female} />)}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Detail table */}
      <div className={s.card}>
        <div className={s.cardTitle}>{VIEW_MODES.find((v) => v.key === viewMode)?.label} 詳細テーブル</div>
        <table className={s.dataTable}>
          <thead><tr>
            <th>年代</th>{viewMode === "age_gender" && <th>性別</th>}
            <th className={s.num}>構成比</th><th className={s.num}>購入者数</th>
            <th className={s.num}>リピート率</th><th className={s.num}>平均金額</th><th className={s.num}>平均回数</th>
          </tr></thead>
          <tbody>
            {data.map((row, i) => {
              const share = totalBuyers > 0 ? round1(row.BUYERS / totalBuyers * 100) : 0
              const rr = row.BUYERS > 0 ? round1(row.REPEATERS / row.BUYERS * 100) : 0
              return (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{row.AGE_GROUP}</td>
                  {viewMode === "age_gender" && <td style={{ color: row.GENDER === "男性" ? COLORS.male : COLORS.female }}>{row.GENDER}</td>}
                  <td className={s.num}>{share}%</td>
                  <td className={s.num}>{row.BUYERS?.toLocaleString()}</td>
                  <td className={s.num}>{rr}%</td>
                  <td className={s.num}>¥{row.AVG_SPEND?.toLocaleString()}</td>
                  <td className={s.num}>{row.AVG_FREQUENCY}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ============ Area Tab ============ */
function AreaTab({ data }: { data: AreaRow[] }) {
  const [metric, setMetric] = useState("TOTAL_SALES")
  const areaMetrics = [
    { key: "TOTAL_SALES", label: "総売上金額", format: (v: number) => `¥${formatNum(v)}` },
    { key: "TRANSACTIONS", label: "取引件数", format: (v: number) => formatNum(v) },
    { key: "BUYERS", label: "購入者数", format: (v: number) => formatNum(v) },
    { key: "AVG_BASKET", label: "平均客単価", format: (v: number) => `¥${v.toLocaleString()}` },
  ]
  const am = areaMetrics.find((x) => x.key === metric)!

  const sorted = useMemo(() => [...data].sort((a, b) => (b[metric as keyof AreaRow] as number) - (a[metric as keyof AreaRow] as number)), [data, metric])

  return (
    <div>
      <div className={s.sectionTitle}><span className={s.dot} style={{ background: CHART_COLORS[1] }} />エリア別分析</div>
      <div className={s.metricSelector}>
        {areaMetrics.map((mt) => (
          <button key={mt.key} className={`${s.metricBtn} ${metric === mt.key ? s.active : ""}`} onClick={() => setMetric(mt.key)}>{mt.label}</button>
        ))}
      </div>
      <div className={s.card}>
        <div className={s.cardTitle}>エリア別 {am.label}</div>
        <ResponsiveContainer width="100%" height={Math.max(300, sorted.length * 36)}>
          <BarChart data={sorted} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8ECF0" />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="AREA_NAME" tick={{ fontSize: 12 }} width={75} />
            <Tooltip formatter={(v: number) => am.format(v)} />
            <Bar dataKey={metric} fill={COLORS.accent} radius={[0, 6, 6, 0]} barSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className={s.card}>
        <div className={s.cardTitle}>エリア別 詳細テーブル</div>
        <table className={s.dataTable}>
          <thead><tr>
            <th>エリア</th><th className={s.num}>店舗数</th><th className={s.num}>売上金額</th>
            <th className={s.num}>取引件数</th><th className={s.num}>購入者数</th><th className={s.num}>客単価</th>
          </tr></thead>
          <tbody>
            {sorted.map((d, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600 }}>{d.AREA_NAME}</td>
                <td className={s.num}>{d.STORE_COUNT}</td>
                <td className={s.num}>¥{formatNum(d.TOTAL_SALES)}</td>
                <td className={s.num}>{d.TRANSACTIONS?.toLocaleString()}</td>
                <td className={s.num}>{d.BUYERS?.toLocaleString()}</td>
                <td className={s.num}>¥{d.AVG_BASKET?.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ============ Behavior Tab ============ */
function BehaviorTab({ data }: { data: BehaviorRow[] }) {
  const [metric, setMetric] = useState("TRANSACTIONS")
  const bMetrics = [
    { key: "TRANSACTIONS", label: "取引件数", format: (v: number) => v.toLocaleString() + "件" },
    { key: "TOTAL_SALES", label: "売上金額", format: (v: number) => `¥${formatNum(v)}` },
    { key: "BUYERS", label: "購入者数", format: (v: number) => v.toLocaleString() + "人" },
  ]
  const bm = bMetrics.find((x) => x.key === metric)!

  const chartData = useMemo(() =>
    data.map((d) => ({ ...d, day: DAY_NAMES[d.DAY_OF_WEEK] || String(d.DAY_OF_WEEK) })),
    [data]
  )

  const peakDay = useMemo(() => {
    if (!chartData.length) return ""
    const max = Math.max(...chartData.map((d) => (d[metric as keyof typeof d] as number) ?? 0))
    return chartData.find((d) => (d[metric as keyof typeof d] as number) === max)?.day ?? ""
  }, [chartData, metric])

  return (
    <div>
      <div className={s.sectionTitle}><span className={s.dot} style={{ background: CHART_COLORS[7] }} />購買行動分析（曜日別）</div>
      <div className={s.metricSelector}>
        {bMetrics.map((mt) => (
          <button key={mt.key} className={`${s.metricBtn} ${metric === mt.key ? s.active : ""}`} onClick={() => setMetric(mt.key)}>{mt.label}</button>
        ))}
      </div>
      <div className={s.card}>
        <div className={s.cardTitle}>曜日別 {bm.label}</div>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8ECF0" />
            <XAxis dataKey="day" tick={{ fontSize: 12 }} tickFormatter={(v) => v + "曜"} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatNum(v)} />
            <Tooltip formatter={(v: number) => bm.format(v)} />
            <Bar dataKey={metric} name={bm.label} radius={[4, 4, 0, 0]} barSize={36}>
              {chartData.map((d, i) => <Cell key={i} fill={d.day === peakDay ? SEMANTIC.emphasis : COLORS.accent} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {peakDay && <p style={{ textAlign: "center", fontSize: "0.75rem", color: "#7F8C8D", marginTop: 4 }}>※ピーク曜日（{peakDay}曜日）を強調</p>}
      </div>
      <div className={s.card}>
        <div className={s.cardTitle}>曜日別 詳細テーブル</div>
        <table className={s.dataTable}>
          <thead><tr>
            <th>曜日</th><th className={s.num}>取引件数</th><th className={s.num}>売上金額</th><th className={s.num}>購入者数</th>
          </tr></thead>
          <tbody>
            {chartData.map((d, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600 }}>{d.day}曜日</td>
                <td className={s.num}>{d.TRANSACTIONS?.toLocaleString()}</td>
                <td className={s.num}>¥{formatNum(d.TOTAL_SALES)}</td>
                <td className={s.num}>{d.BUYERS?.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ============ Trial/Repeat Tab ============ */
function TrialRepeatTab({ data }: { data: FreqRow[] }) {
  const [middleMin, setMiddleMin] = useState(2)
  const [heavyMin, setHeavyMin] = useState(5)

  const segments = useMemo(() => {
    const totalBuyers = data.reduce((acc, d) => acc + d.BUYERS, 0)
    const totalSales = data.reduce((acc, d) => acc + d.SALES, 0)
    const groups: Record<string, { buyers: number; sales: number }> = { "ライト": { buyers: 0, sales: 0 }, "ミドル": { buyers: 0, sales: 0 }, "ヘビー": { buyers: 0, sales: 0 } }
    data.forEach((d) => {
      const c = d.COUNT
      const seg = c >= heavyMin ? "ヘビー" : c >= middleMin ? "ミドル" : "ライト"
      groups[seg].buyers += d.BUYERS
      groups[seg].sales += d.SALES
    })
    return ["ライト", "ミドル", "ヘビー"].map((seg) => ({
      segment: seg,
      definition: seg === "ライト" ? `1~${middleMin - 1}回` : seg === "ミドル" ? `${middleMin}~${heavyMin - 1}回` : `${heavyMin}回以上`,
      buyers: groups[seg].buyers,
      buyer_share: totalBuyers > 0 ? round1(groups[seg].buyers / totalBuyers * 100) : 0,
      sales: groups[seg].sales,
      sales_share: totalSales > 0 ? round1(groups[seg].sales / totalSales * 100) : 0,
    }))
  }, [data, middleMin, heavyMin])

  const totalBuyers = data.reduce((acc, d) => acc + d.BUYERS, 0)

  return (
    <div>
      <div className={s.sectionTitle}><span className={s.dot} style={{ background: CHART_COLORS[6] }} />トライアル/リピート分析</div>

      {/* Segment definition */}
      <div className={s.segDef}>
        <div className={s.segDefLabel}>セグメント定義</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "0.8rem", color: SEG_COLORS["ライト"], fontWeight: 600 }}>ライト</span>
          <span style={{ fontSize: "0.78rem", color: "#7F8C8D" }}>1~</span>
          <input type="number" className={s.segInput} min={2} max={heavyMin - 1} value={middleMin} onChange={(e) => { const v = parseInt(e.target.value); if (v >= 2 && v < heavyMin) setMiddleMin(v) }} />
          <span style={{ fontSize: "0.78rem", color: "#7F8C8D" }}>回未満</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "0.8rem", color: SEG_COLORS["ミドル"], fontWeight: 600 }}>ミドル</span>
          <span style={{ fontSize: "0.78rem", color: "#7F8C8D" }}>{middleMin}~</span>
          <input type="number" className={s.segInput} min={middleMin + 1} max={20} value={heavyMin} onChange={(e) => { const v = parseInt(e.target.value); if (v > middleMin && v <= 20) setHeavyMin(v) }} />
          <span style={{ fontSize: "0.78rem", color: "#7F8C8D" }}>回未満</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "0.8rem", color: SEG_COLORS["ヘビー"], fontWeight: 600 }}>ヘビー</span>
          <span style={{ fontSize: "0.78rem", color: "#7F8C8D" }}>{heavyMin}回以上</span>
        </div>
      </div>



      <div className={s.grid2}>
        {/* Frequency distribution */}
        <div className={s.card}>
          <div className={s.cardTitle}>購入回数分布</div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} margin={{ top: 5, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8ECF0" />
              <XAxis dataKey="COUNT" tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 11 ? "11+" : v + "回"} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatNum(v)} />
              <Tooltip formatter={(v: number) => v.toLocaleString() + "人"} />
              <Bar dataKey="BUYERS" name="購入者数" fill={COLORS.accent} radius={[4, 4, 0, 0]} barSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Segment pie */}
        <div className={s.card}>
          <div className={s.cardTitle}>顧客セグメント 構成比</div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={segments.filter((seg) => seg.buyers > 0)} dataKey="buyers" nameKey="segment" cx="50%" cy="50%" outerRadius={100} innerRadius={50} labelLine={false}
                label={({ segment, percent }) => percent > 0.01 ? `${segment} ${(percent * 100).toFixed(0)}%` : ""}>
                {segments.map((seg, i) => <Cell key={i} fill={SEG_COLORS[seg.segment] || PALETTE[i]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className={s.legendRow}>
            {segments.map((seg, i) => (
              <span key={i} className={s.legendItem}>
                <span className={s.legendDot} style={{ background: SEG_COLORS[seg.segment] }} />{seg.segment}（{seg.definition}）
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Segment table */}
      <div className={s.card}>
        <div className={s.cardTitle}>セグメント別 詳細テーブル</div>
        <table className={s.dataTable}>
          <thead><tr>
            <th>セグメント</th><th>定義</th><th className={s.num}>購入者数</th>
            <th className={s.num}>構成比</th><th className={s.num}>売上金額</th><th className={s.num}>売上構成比</th>
          </tr></thead>
          <tbody>
            {segments.map((d, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 700, color: SEG_COLORS[d.segment] }}>{d.segment}</td>
                <td>{d.definition}</td>
                <td className={s.num}>{d.buyers.toLocaleString()}</td>
                <td className={s.num}>{d.buyer_share}%</td>
                <td className={s.num}>¥{formatNum(d.sales)}</td>
                <td className={s.num}>{d.sales_share}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
