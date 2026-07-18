"use client"

import { useState, useEffect, useMemo } from "react"
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts"
import { CHART_COLORS, PALETTE } from "@/lib/palette"

const WH_SIZES = [
  { key: "XS", label: "X-Small", credits: 1 },
  { key: "S", label: "Small", credits: 2 },
  { key: "M", label: "Medium", credits: 4 },
  { key: "L", label: "Large", credits: 8 },
  { key: "XL", label: "X-Large", credits: 16 },
  { key: "2XL", label: "2X-Large", credits: 32 },
  { key: "3XL", label: "3X-Large", credits: 64 },
  { key: "4XL", label: "4X-Large", credits: 128 },
]

// AWS Tokyo credit prices by edition ($/credit, on-demand)
const EDITIONS = [
  { key: "standard", label: "Standard", creditPrice: 3.00 },
  { key: "enterprise", label: "Enterprise", creditPrice: 4.30 },
  { key: "business_critical", label: "Business Critical", creditPrice: 5.70 },
]

const STORAGE_PRICE_TB = 25 // $/TB/month (AWS Tokyo)

const PIE_COLORS = CHART_COLORS

interface HourlyRow { HOUR: number; MINUTE: string; AVG_QUERIES: number; MAX_QUERIES: number }
interface DailyRow { DAY: string; TOTAL_QUERIES: number; PEAK_QUERIES: number; ACTIVE_INTERVALS: number }
interface Summary { TOTAL_INTERVALS: number; ACTIVE_INTERVALS: number; AVG_QUERIES: number; PEAK_QUERIES: number; MIN_TS: string; MAX_TS: string }
interface WhSim { HOURS_SUSPEND_0: number; HOURS_SUSPEND_60: number; HOURS_SUSPEND_120: number; HOURS_SUSPEND_180: number; HOURS_SUSPEND_300: number }

export default function CostEstimationPage() {
  const [hourly, setHourly] = useState<HourlyRow[]>([])
  const [daily, setDaily] = useState<DailyRow[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [whSim, setWhSim] = useState<WhSim | null>(null)
  const [numDays, setNumDays] = useState(31)
  const [loading, setLoading] = useState(true)

  // Variables
  const [edition, setEdition] = useState("enterprise")
  const [whSize, setWhSize] = useState("M")
  const [avgQueryTime, setAvgQueryTime] = useState(5)
  const [autoSuspend, setAutoSuspend] = useState(60)
  const [appRuntimeHourly, setAppRuntimeHourly] = useState(0.30)
  const [dtDailyCredits, setDtDailyCredits] = useState(4)
  const [storageTb, setStorageTb] = useState(4.0)

  // AI variables
  const [aiUsers, setAiUsers] = useState(10)
  const [aiQuestionsPerDay, setAiQuestionsPerDay] = useState(5)
  const [aiCreditsPerQuestion, setAiCreditsPerQuestion] = useState(0.012)

  useEffect(() => {
    fetch("/api/admin/cost-estimation")
      .then((r) => r.json())
      .then((d) => {
        setHourly(d.hourly ?? [])
        setDaily(d.daily ?? [])
        setSummary(d.summary ?? null)
        setWhSim(d.whSim ?? null)
        if (d.numDays) setNumDays(d.numDays)
      })
      .finally(() => setLoading(false))
  }, [])

  const editionInfo = EDITIONS.find((e) => e.key === edition) ?? EDITIONS[1]
  const creditPrice = editionInfo.creditPrice
  const creditsPerHour = WH_SIZES.find((w) => w.key === whSize)?.credits ?? 4

  // Multi-cluster WH scaling calculation
  // Y = 300 / X: max queries one WH can handle per 5-min interval
  const whCapacityPerInterval = 300 / avgQueryTime

  const costCalc = useMemo(() => {
    if (!whSim || hourly.length === 0) return null

    // Calculate WH-instance-hours per day using multi-cluster scaling
    // For each 5-min slot: if queries > capacity, scale out to multiple WHs
    let dailyWhInstanceSlots = 0
    let maxWhInstances = 1
    let scaleOutSlots = 0

    for (const row of hourly) {
      if (row.AVG_QUERIES > 0) {
        const whsNeeded = Math.ceil(row.AVG_QUERIES / whCapacityPerInterval)
        dailyWhInstanceSlots += whsNeeded
        if (whsNeeded > maxWhInstances) maxWhInstances = whsNeeded
        if (whsNeeded > 1) scaleOutSlots++
      }
    }

    // Each slot = 5 minutes = 5/60 hours
    const activeWhInstanceHoursPerDay = dailyWhInstanceSlots * (5 / 60)

    // Add auto-suspend overhead: use ratio from whSim
    // whSim gives total hours for single-WH scenario; compute suspend overhead ratio
    const baseActiveHours = whSim.HOURS_SUSPEND_0 // hours with suspend=0 (pure active)
    let suspendHours: number
    if (autoSuspend <= 0) suspendHours = whSim.HOURS_SUSPEND_0
    else if (autoSuspend <= 60) suspendHours = whSim.HOURS_SUSPEND_60
    else if (autoSuspend <= 120) suspendHours = whSim.HOURS_SUSPEND_120
    else if (autoSuspend <= 180) suspendHours = whSim.HOURS_SUSPEND_180
    else suspendHours = whSim.HOURS_SUSPEND_300

    // Suspend overhead adds idle single-WH time (only 1 WH stays on during suspend tail)
    const suspendOverheadHoursPerMonth = suspendHours - baseActiveHours

    // Total WH-instance-hours per month
    const scaledWhHoursPerMonth = activeWhInstanceHoursPerDay * numDays + suspendOverheadHoursPerMonth
    const runHoursPerDay = Math.round(activeWhInstanceHoursPerDay * 10) / 10

    // Costs
    const whCreditsMonth = scaledWhHoursPerMonth * creditsPerHour
    const whCostMonth = whCreditsMonth * creditPrice
    const appRuntimeMonth = appRuntimeHourly * 24 * 30
    const dtCostMonth = dtDailyCredits * 30 * creditPrice
    const storageCostMonth = storageTb * STORAGE_PRICE_TB

    // AI cost
    const aiQuestionsMonth = aiUsers * aiQuestionsPerDay * 30
    const aiCreditsMonth = aiQuestionsMonth * aiCreditsPerQuestion
    const aiCostMonth = aiCreditsMonth * creditPrice

    const totalMonth = whCostMonth + appRuntimeMonth + dtCostMonth + storageCostMonth + aiCostMonth

    return {
      runHoursPerDay,
      scaledWhHoursPerMonth: Math.round(scaledWhHoursPerMonth),
      maxWhInstances,
      scaleOutSlots,
      whCapacity: Math.round(whCapacityPerInterval * 10) / 10,
      whCreditsMonth: Math.round(whCreditsMonth),
      whCostMonth: Math.round(whCostMonth),
      appRuntimeMonth: Math.round(appRuntimeMonth),
      dtCostMonth: Math.round(dtCostMonth),
      storageCostMonth: Math.round(storageCostMonth),
      aiQuestionsMonth,
      aiCreditsMonth: Math.round(aiCreditsMonth * 10) / 10,
      aiCostMonth: Math.round(aiCostMonth),
      totalMonth: Math.round(totalMonth),
      totalYear: Math.round(totalMonth * 12),
      breakdown: [
        { name: "Warehouse", value: Math.round(whCostMonth) },
        { name: "App Runtime", value: Math.round(appRuntimeMonth) },
        { name: "DT Refresh", value: Math.round(dtCostMonth) },
        { name: "Storage", value: Math.round(storageCostMonth) },
        { name: "Cortex AI", value: Math.round(aiCostMonth) },
      ],
    }
  }, [whSim, hourly, whSize, autoSuspend, creditPrice, appRuntimeHourly, dtDailyCredits, storageTb, creditsPerHour, numDays, aiUsers, aiQuestionsPerDay, aiCreditsPerQuestion, whCapacityPerInterval])

  const chartData = useMemo(() => {
    return hourly.map((r) => ({
      time: `${String(r.HOUR).padStart(2, "0")}:${r.MINUTE}`,
      avg: r.AVG_QUERIES,
      max: r.MAX_QUERIES,
      capacity: whCapacityPerInterval,
    }))
  }, [hourly, whCapacityPerInterval])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <span style={{ color: "var(--muted-foreground)" }}>データ読み込み中...</span>
      </div>
    )
  }

  return (
    <main className="w-full max-w-7xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold">Snowflake コスト試算</h1>
        <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: "rgba(65,105,225,0.1)", color: PALETTE.primary }}>AWS Tokyo (ap-northeast-1)</span>
      </div>
      <p className="text-sm mb-6" style={{ color: "var(--muted-foreground)" }}>
        Redshift Serverless 2026年5月のクエリパターンを元に、マルチクラスター・スケールアウトを考慮したコスト試算
      </p>

      {/* Summary KPIs */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          {[
            { label: "計測期間", value: "2026/5/1〜5/31", sub: "31日間" },
            { label: "総インターバル数", value: summary.TOTAL_INTERVALS.toLocaleString(), sub: "5分間隔" },
            { label: "アクティブ率", value: `${Math.round(summary.ACTIVE_INTERVALS / summary.TOTAL_INTERVALS * 100)}%`, sub: `${summary.ACTIVE_INTERVALS.toLocaleString()} intervals` },
            { label: "平均同時クエリ", value: String(summary.AVG_QUERIES), sub: "全時間帯" },
            { label: "ピーク同時クエリ", value: String(summary.PEAK_QUERIES), sub: "最大値" },
          ].map((k, i) => (
            <div key={i} className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{k.label}</p>
              <p className="text-xl font-bold mt-1" style={{ color: "var(--foreground)" }}>{k.value}</p>
              <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>{k.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Query Pattern Chart with capacity line */}
      <div className="rounded-xl border p-5 mb-6" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--foreground)" }}>
          1日あたりのクエリパターン（30日平均）+ WH処理能力
        </h3>
        <p className="text-xs mb-4" style={{ color: "var(--muted-foreground)" }}>
          横軸: 時刻 / 縦軸: 同時実行クエリ数。オレンジ破線=1WHの処理能力 (Y=300/{avgQueryTime}={Math.round(whCapacityPerInterval * 10) / 10})、超える時間帯はスケールアウト
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData} margin={{ top: 5, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="time" tick={{ fill: "var(--muted-foreground)", fontSize: 9 }} interval={11} />
            <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
            <Tooltip contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "var(--foreground)" }} />
            <Legend />
            <Area type="monotone" dataKey="avg" name="平均クエリ数" stroke={PALETTE.primary} fill="rgba(65,105,225,0.2)" strokeWidth={2} />
            <Area type="monotone" dataKey="max" name="最大クエリ数" stroke="#dc2626" fill="rgba(220,38,38,0.05)" strokeWidth={1} strokeDasharray="4 4" />
            <Area type="monotone" dataKey="capacity" name="1WH処理能力 (Y)" stroke="#d97706" fill="none" strokeWidth={2} strokeDasharray="6 3" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Variables + Result */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Panel */}
        <div className="lg:col-span-1 rounded-xl border p-5 space-y-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>変数設定</h3>

          {/* Edition */}
          <div>
            <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Edition（AWS Tokyo）</label>
            <select value={edition} onChange={(e) => setEdition(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}>
              {EDITIONS.map((e) => (
                <option key={e.key} value={e.key}>{e.label} (${e.creditPrice}/credit)</option>
              ))}
            </select>
          </div>

          {/* WH Size */}
          <div>
            <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Warehouseサイズ</label>
            <select value={whSize} onChange={(e) => setWhSize(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}>
              {WH_SIZES.map((w) => (
                <option key={w.key} value={w.key}>{w.label} ({w.credits} credits/hr)</option>
              ))}
            </select>
          </div>

          {/* Avg Query Time */}
          <div>
            <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
              平均クエリ時間: <strong>{avgQueryTime}秒</strong>
            </label>
            <input type="range" min={1} max={60} value={avgQueryTime} onChange={(e) => setAvgQueryTime(Number(e.target.value))} className="w-full mt-1" />
            <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
              → 1WH処理能力: Y = 300/{avgQueryTime} = <strong>{Math.round(300 / avgQueryTime * 10) / 10}</strong> クエリ/5分
            </p>
          </div>

          {/* Auto Suspend */}
          <div>
            <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
              Auto-suspend: <strong>{autoSuspend}秒</strong>
            </label>
            <input type="range" min={0} max={600} step={30} value={autoSuspend} onChange={(e) => setAutoSuspend(Number(e.target.value))} className="w-full mt-1" />
          </div>

          {/* App Runtime */}
          <div>
            <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>App Runtime ($/hour)</label>
            <input type="number" step={0.05} min={0} max={5} value={appRuntimeHourly} onChange={(e) => setAppRuntimeHourly(Number(e.target.value))}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
          </div>

          {/* DT Credits */}
          <div>
            <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
              DTリフレッシュ: <strong>{dtDailyCredits} credits/日</strong>
            </label>
            <input type="range" min={0} max={20} value={dtDailyCredits} onChange={(e) => setDtDailyCredits(Number(e.target.value))} className="w-full mt-1" />
          </div>

          {/* Storage */}
          <div>
            <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>ストレージ (TB) — ${STORAGE_PRICE_TB}/TB/月</label>
            <input type="number" step={0.5} min={0} max={50} value={storageTb} onChange={(e) => setStorageTb(Number(e.target.value))}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
          </div>

          {/* AI Section */}
          <div className="pt-3 border-t" style={{ borderColor: "var(--border)" }}>
            <h4 className="text-xs font-semibold mb-3" style={{ color: PALETTE.primaryDark }}>Cortex AI 利用</h4>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
                  AIユーザー数: <strong>{aiUsers}人</strong>
                </label>
                <input type="range" min={1} max={100} value={aiUsers} onChange={(e) => setAiUsers(Number(e.target.value))} className="w-full mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
                  1日あたり平均質問数: <strong>{aiQuestionsPerDay}回/人</strong>
                </label>
                <input type="range" min={1} max={50} value={aiQuestionsPerDay} onChange={(e) => setAiQuestionsPerDay(Number(e.target.value))} className="w-full mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>1質問あたりのクレジット</label>
                <input type="number" step={0.001} min={0.001} max={1} value={aiCreditsPerQuestion} onChange={(e) => setAiCreditsPerQuestion(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
              </div>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                月間: {(aiUsers * aiQuestionsPerDay * 30).toLocaleString()}回 × {aiCreditsPerQuestion}cr = {Math.round(aiUsers * aiQuestionsPerDay * 30 * aiCreditsPerQuestion * 10) / 10} credits
              </p>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-4">
          {costCalc && (
            <>
              {/* Total KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
                  <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>月額合計</p>
                  <p className="text-2xl font-bold mt-1" style={{ color: PALETTE.primary }}>${costCalc.totalMonth.toLocaleString()}</p>
                  <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>約¥{(costCalc.totalMonth * 150).toLocaleString()}</p>
                </div>
                <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
                  <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>年額合計</p>
                  <p className="text-2xl font-bold mt-1" style={{ color: "#059669" }}>${costCalc.totalYear.toLocaleString()}</p>
                  <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>約¥{(costCalc.totalYear * 150).toLocaleString()}</p>
                </div>
                <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
                  <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>WH実時間/日</p>
                  <p className="text-2xl font-bold mt-1" style={{ color: "var(--foreground)" }}>{costCalc.runHoursPerDay}h</p>
                  <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>最大{costCalc.maxWhInstances}台並列</p>
                </div>
                <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
                  <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>WHインスタンス時間/月</p>
                  <p className="text-2xl font-bold mt-1" style={{ color: "var(--foreground)" }}>{costCalc.scaledWhHoursPerMonth.toLocaleString()}</p>
                  <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>h (スケール含む)</p>
                </div>
              </div>

              {/* Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
                  <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>コスト内訳</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={costCalc.breakdown.filter(d => d.value > 0)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45}
                        label={({ name, percent }) => percent > 0.03 ? `${name} ${(percent * 100).toFixed(0)}%` : ""} labelLine={false}>
                        {costCalc.breakdown.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
                  <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>詳細内訳（{editionInfo.label} / AWS Tokyo）</h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border)" }}>
                        <th className="text-left py-2 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>項目</th>
                        <th className="text-right py-2 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>月額</th>
                        <th className="text-right py-2 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>構成比</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { name: "Warehouse (マルチクラスター)", cost: costCalc.whCostMonth, detail: `${WH_SIZES.find(w => w.key === whSize)?.label} × ${costCalc.scaledWhHoursPerMonth}h × $${creditPrice}` },
                        { name: "App Runtime (常時稼働)", cost: costCalc.appRuntimeMonth, detail: `$${appRuntimeHourly}/h × 720h` },
                        { name: "DT Refresh (増分更新)", cost: costCalc.dtCostMonth, detail: `${dtDailyCredits}cr/日 × 30日 × $${creditPrice}` },
                        { name: "Storage (データ保管)", cost: costCalc.storageCostMonth, detail: `${storageTb}TB × $${STORAGE_PRICE_TB}/TB` },
                        { name: "Cortex AI", cost: costCalc.aiCostMonth, detail: `${costCalc.aiQuestionsMonth}回 × ${aiCreditsPerQuestion}cr × $${creditPrice}` },
                      ].map((row, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td className="py-2" style={{ color: "var(--foreground)" }}>
                            <div className="font-medium text-xs">{row.name}</div>
                            <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>{row.detail}</div>
                          </td>
                          <td className="text-right py-2 font-medium tabular-nums text-xs" style={{ color: "var(--foreground)" }}>${row.cost.toLocaleString()}</td>
                          <td className="text-right py-2 tabular-nums text-xs" style={{ color: "var(--muted-foreground)" }}>
                            {costCalc.totalMonth > 0 ? `${Math.round(row.cost / costCalc.totalMonth * 100)}%` : "-"}
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td className="py-2 font-bold text-sm" style={{ color: "var(--foreground)" }}>合計</td>
                        <td className="text-right py-2 font-bold tabular-nums text-sm" style={{ color: PALETTE.primary }}>${costCalc.totalMonth.toLocaleString()}</td>
                        <td className="text-right py-2 font-bold tabular-nums text-xs" style={{ color: "var(--foreground)" }}>100%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Scaling detail */}
              <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
                <h4 className="text-xs font-semibold mb-2" style={{ color: "var(--foreground)" }}>マルチクラスター・スケールアウト詳細</h4>
                <div className="grid grid-cols-3 gap-4 text-xs" style={{ color: "var(--muted-foreground)" }}>
                  <div>
                    <span className="font-medium">1WH処理能力 (Y)</span>
                    <p className="text-sm font-bold mt-1" style={{ color: "var(--foreground)" }}>{costCalc.whCapacity} クエリ/5分</p>
                    <p>= 300 / {avgQueryTime}s</p>
                  </div>
                  <div>
                    <span className="font-medium">最大並列WH数</span>
                    <p className="text-sm font-bold mt-1" style={{ color: "var(--foreground)" }}>{costCalc.maxWhInstances}台</p>
                    <p>ピーク時のスケールアウト</p>
                  </div>
                  <div>
                    <span className="font-medium">スケールアウト発生</span>
                    <p className="text-sm font-bold mt-1" style={{ color: "var(--foreground)" }}>{costCalc.scaleOutSlots} / {hourly.length} slots</p>
                    <p>Y超過する時間帯数/日</p>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
                <h4 className="text-xs font-semibold mb-2" style={{ color: "var(--muted-foreground)" }}>前提条件・注意事項</h4>
                <ul className="text-xs space-y-1" style={{ color: "var(--muted-foreground)" }}>
                  <li>- リージョン: AWS Tokyo (ap-northeast-1)。クレジット単価はEditionにより異なる（On-Demand価格）</li>
                  <li>- WH計算: 5分間隔でY=300/平均クエリ時間を超えるとスケールアウト（マルチクラスター）</li>
                  <li>- Auto-suspend: クエリ停止後もWH1台が指定秒数アイドル稼働（追加コスト）</li>
                  <li>- 結果キャッシュ（同一クエリ無料）を未考慮のため、実コストはこれより低くなる可能性あり</li>
                  <li>- Cortex AI: 1質問あたりのクレジット消費は利用モデル・トークン量により変動</li>
                  <li>- App Runtime: 24h稼働のCompute Pool (SYSTEM_COMPUTE_POOL_CPU)</li>
                  <li>- DTリフレッシュ: 専用WH（XL想定）での増分更新コスト</li>
                  <li>- ストレージ: ${STORAGE_PRICE_TB}/TB/月（AWS Tokyo）</li>
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
