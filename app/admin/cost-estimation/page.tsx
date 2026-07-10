"use client"

import { useState, useEffect, useMemo } from "react"
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts"

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

const PIE_COLORS = ["#29ABE2", "#059669", "#d97706", "#7c3aed", "#dc2626"]

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
  const [whSize, setWhSize] = useState("M")
  const [avgQueryTime, setAvgQueryTime] = useState(5)
  const [autoSuspend, setAutoSuspend] = useState(60)
  const [creditPrice, setCreditPrice] = useState(3.0)
  const [appRuntimeHourly, setAppRuntimeHourly] = useState(0.30)
  const [dtDailyCredits, setDtDailyCredits] = useState(4)
  const [storageTb, setStorageTb] = useState(4.0)
  const [storagePriceTb, setStoragePriceTb] = useState(23)

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

  const creditsPerHour = WH_SIZES.find((w) => w.key === whSize)?.credits ?? 4

  // Use server-side WH simulation results (accurate per-interval calculation)
  const costCalc = useMemo(() => {
    if (!whSim) return null

    // Pick the correct run hours based on auto-suspend setting
    let runHoursMonth: number
    if (autoSuspend <= 0) runHoursMonth = whSim.HOURS_SUSPEND_0
    else if (autoSuspend <= 60) runHoursMonth = whSim.HOURS_SUSPEND_60
    else if (autoSuspend <= 120) runHoursMonth = whSim.HOURS_SUSPEND_120
    else if (autoSuspend <= 180) runHoursMonth = whSim.HOURS_SUSPEND_180
    else runHoursMonth = whSim.HOURS_SUSPEND_300

    const runHoursPerDay = Math.round(runHoursMonth / numDays * 10) / 10

    const whCreditsMonth = runHoursMonth * creditsPerHour
    const whCostMonth = whCreditsMonth * creditPrice

    const appRuntimeMonth = appRuntimeHourly * 24 * 30
    const dtCostMonth = dtDailyCredits * 30 * creditPrice
    const storageCostMonth = storageTb * storagePriceTb

    const totalMonth = whCostMonth + appRuntimeMonth + dtCostMonth + storageCostMonth

    return {
      runHoursPerDay,
      runHoursPerMonth: Math.round(runHoursMonth),
      whCreditsMonth: Math.round(whCreditsMonth),
      whCostMonth: Math.round(whCostMonth),
      appRuntimeMonth: Math.round(appRuntimeMonth),
      dtCostMonth: Math.round(dtCostMonth),
      storageCostMonth: Math.round(storageCostMonth),
      totalMonth: Math.round(totalMonth),
      totalYear: Math.round(totalMonth * 12),
      breakdown: [
        { name: "Warehouse", value: Math.round(whCostMonth) },
        { name: "App Runtime", value: Math.round(appRuntimeMonth) },
        { name: "DT Refresh", value: Math.round(dtCostMonth) },
        { name: "Storage", value: Math.round(storageCostMonth) },
      ],
    }
  }, [whSim, whSize, autoSuspend, creditPrice, appRuntimeHourly, dtDailyCredits, storageTb, storagePriceTb, creditsPerHour, numDays])

  // Chart data: 5-min intervals averaged into hourly pattern
  const chartData = useMemo(() => {
    return hourly.map((r) => ({
      time: `${String(r.HOUR).padStart(2, "0")}:${r.MINUTE}`,
      avg: r.AVG_QUERIES,
      max: r.MAX_QUERIES,
    }))
  }, [hourly])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <span style={{ color: "var(--muted-foreground)" }}>データ読み込み中...</span>
      </div>
    )
  }

  return (
    <main className="w-full max-w-7xl mx-auto py-8 px-4">
      <h1 className="text-xl font-semibold mb-1">Snowflake コスト試算</h1>
      <p className="text-sm mb-6" style={{ color: "var(--muted-foreground)" }}>
        Redshift Serverless 2026年5月のクエリパターンを元に、Snowflake移行時のコストを試算
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

      {/* Query Pattern Chart */}
      <div className="rounded-xl border p-5 mb-6" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--foreground)" }}>
          1日あたりのクエリパターン（30日平均）
        </h3>
        <p className="text-xs mb-4" style={{ color: "var(--muted-foreground)" }}>
          横軸: 時刻（5分間隔） / 縦軸: 同時実行クエリ数
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData} margin={{ top: 5, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="time"
              tick={{ fill: "var(--muted-foreground)", fontSize: 9 }}
              interval={11}
            />
            <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
            <Tooltip
              contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: "var(--foreground)" }}
            />
            <Legend />
            <Area type="monotone" dataKey="avg" name="平均クエリ数" stroke="#29ABE2" fill="rgba(41,171,226,0.2)" strokeWidth={2} />
            <Area type="monotone" dataKey="max" name="最大クエリ数" stroke="#dc2626" fill="rgba(220,38,38,0.05)" strokeWidth={1} strokeDasharray="4 4" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Variables + Result */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Panel */}
        <div className="lg:col-span-1 rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--foreground)" }}>変数設定</h3>

          <div className="space-y-5">
            {/* WH Size */}
            <div>
              <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Warehouseサイズ</label>
              <select
                value={whSize}
                onChange={(e) => setWhSize(e.target.value)}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
              >
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
            </div>

            {/* Auto Suspend */}
            <div>
              <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
                Auto-suspend: <strong>{autoSuspend}秒</strong>
              </label>
              <input type="range" min={0} max={600} step={30} value={autoSuspend} onChange={(e) => setAutoSuspend(Number(e.target.value))} className="w-full mt-1" />
            </div>

            {/* Credit Price */}
            <div>
              <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>クレジット単価 ($/credit)</label>
              <input type="number" step={0.1} min={1} max={10} value={creditPrice} onChange={(e) => setCreditPrice(Number(e.target.value))}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
              />
            </div>

            {/* App Runtime */}
            <div>
              <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>App Runtime ($/hour)</label>
              <input type="number" step={0.05} min={0} max={5} value={appRuntimeHourly} onChange={(e) => setAppRuntimeHourly(Number(e.target.value))}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
              />
            </div>

            {/* DT Credits */}
            <div>
              <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
                DTリフレッシュ: <strong>{dtDailyCredits} credits/日</strong>
              </label>
              <input type="range" min={0} max={20} value={dtDailyCredits} onChange={(e) => setDtDailyCredits(Number(e.target.value))} className="w-full mt-1" />
            </div>

            {/* Storage */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>ストレージ (TB)</label>
                <input type="number" step={0.5} min={0} max={50} value={storageTb} onChange={(e) => setStorageTb(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                />
              </div>
              <div>
                <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>$/TB/月</label>
                <input type="number" step={1} min={1} max={100} value={storagePriceTb} onChange={(e) => setStoragePriceTb(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                />
              </div>
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
                  <p className="text-2xl font-bold mt-1" style={{ color: "#29ABE2" }}>${costCalc.totalMonth.toLocaleString()}</p>
                  <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>約¥{(costCalc.totalMonth * 150).toLocaleString()}</p>
                </div>
                <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
                  <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>年額合計</p>
                  <p className="text-2xl font-bold mt-1" style={{ color: "#059669" }}>${costCalc.totalYear.toLocaleString()}</p>
                  <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>約¥{(costCalc.totalYear * 150).toLocaleString()}</p>
                </div>
                <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
                  <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>WH稼働時間/日</p>
                  <p className="text-2xl font-bold mt-1" style={{ color: "var(--foreground)" }}>{costCalc.runHoursPerDay}h</p>
                  <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>/ 24h</p>
                </div>
                <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
                  <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>WHクレジット/月</p>
                  <p className="text-2xl font-bold mt-1" style={{ color: "var(--foreground)" }}>{costCalc.whCreditsMonth.toLocaleString()}</p>
                  <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>credits</p>
                </div>
              </div>

              {/* Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Pie */}
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

                {/* Table */}
                <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
                  <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>詳細内訳</h3>
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
                        { name: "Warehouse (クエリ実行)", cost: costCalc.whCostMonth, detail: `${WH_SIZES.find(w => w.key === whSize)?.label} × ${costCalc.runHoursPerMonth}h` },
                        { name: "App Runtime (常時稼働)", cost: costCalc.appRuntimeMonth, detail: `$${appRuntimeHourly}/h × 720h` },
                        { name: "DT Refresh (増分更新)", cost: costCalc.dtCostMonth, detail: `${dtDailyCredits}cr/日 × 30日` },
                        { name: "Storage (データ保管)", cost: costCalc.storageCostMonth, detail: `${storageTb}TB × $${storagePriceTb}/TB` },
                      ].map((row, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td className="py-2.5" style={{ color: "var(--foreground)" }}>
                            <div className="font-medium">{row.name}</div>
                            <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>{row.detail}</div>
                          </td>
                          <td className="text-right py-2.5 font-medium tabular-nums" style={{ color: "var(--foreground)" }}>${row.cost.toLocaleString()}</td>
                          <td className="text-right py-2.5 tabular-nums" style={{ color: "var(--muted-foreground)" }}>
                            {costCalc.totalMonth > 0 ? `${Math.round(row.cost / costCalc.totalMonth * 100)}%` : "-"}
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td className="py-2.5 font-bold" style={{ color: "var(--foreground)" }}>合計</td>
                        <td className="text-right py-2.5 font-bold tabular-nums" style={{ color: "#29ABE2" }}>${costCalc.totalMonth.toLocaleString()}</td>
                        <td className="text-right py-2.5 font-bold tabular-nums" style={{ color: "var(--foreground)" }}>100%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Notes */}
              <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
                <h4 className="text-xs font-semibold mb-2" style={{ color: "var(--muted-foreground)" }}>前提条件・注意事項</h4>
                <ul className="text-xs space-y-1" style={{ color: "var(--muted-foreground)" }}>
                  <li>- WH稼働時間: 5分間隔でクエリが存在する時間帯をWH稼働中と見なし、Auto-suspend時間を加算して算出</li>
                  <li>- Snowflakeは同時実行クエリが同一WHで処理されるため、同時実行数が多くてもWHコストは増加しない（キュー待ちが発生）</li>
                  <li>- 結果キャッシュ（同一クエリは無料）を考慮していないため、実コストはこれより低くなる可能性あり</li>
                  <li>- App Runtimeは24時間365日稼働のCompute Pool料金（SYSTEM_COMPUTE_POOL_CPU）</li>
                  <li>- DTリフレッシュは専用WH（XL）での増分更新コスト。1日の平均リフレッシュ時間から算出</li>
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
