"use client"

import { useState, useEffect } from "react"
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts"

interface IntervalData { INTERVAL_BUCKET: number; COUNT: number }
interface RetentionData { N: number; REMAINING: number; RETENTION_RATE: number }

export default function ProfilingPage() {
  const [intervals, setIntervals] = useState<IntervalData[]>([])
  const [retention, setRetention] = useState<RetentionData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [churnThreshold, setChurnThreshold] = useState(60)

  useEffect(() => {
    fetch("/api/profiling")
      .then((r) => r.json())
      .then((res) => {
        if (res.error) setError(res.error)
        else {
          setIntervals(res.intervals ?? [])
          setRetention(res.retention ?? [])
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const medianInterval = intervals.length > 0
    ? intervals.reduce((sum, d) => sum + d.INTERVAL_BUCKET * d.COUNT, 0) / intervals.reduce((sum, d) => sum + d.COUNT, 0)
    : 0

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>ブランドプロファイリング</h1>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          購入間隔分布・リテンション曲線・チャーン分析
        </p>
      </div>

      {loading && (
        <div className="flex h-64 items-center justify-center rounded-xl border" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2" style={{ color: "var(--muted-foreground)" }}>
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <span>プロファイリングデータを取得中...</span>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 p-4" style={{ backgroundColor: "var(--card)" }}>
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-5">
          {/* KPI row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>平均購入間隔</p>
              <p className="text-2xl font-bold mt-1" style={{ color: "var(--brand-cyan)" }}>{Math.round(medianInterval)} 日</p>
            </div>
            <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>チャーン閾値</p>
              <p className="text-2xl font-bold mt-1" style={{ color: "var(--brand-amber)" }}>{churnThreshold} 日</p>
            </div>
            <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>2回目購入率</p>
              <p className="text-2xl font-bold mt-1" style={{ color: "var(--brand-green)" }}>
                {retention.find((r) => r.N === 2)?.RETENTION_RATE ?? "-"}%
              </p>
            </div>
          </div>

          {/* Purchase interval histogram */}
          <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium" style={{ color: "var(--foreground)" }}>購入間隔ヒストグラム</h3>
              <div className="flex items-center gap-2">
                <label className="text-xs" style={{ color: "var(--muted-foreground)" }}>チャーン閾値:</label>
                <input
                  type="range" min={14} max={120} value={churnThreshold}
                  onChange={(e) => setChurnThreshold(Number(e.target.value))}
                  className="w-24"
                />
                <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>{churnThreshold}日</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={intervals} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="INTERVAL_BUCKET" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} label={{ value: "日数", position: "insideBottom", offset: -5, fill: "var(--muted-foreground)", fontSize: 10 }} />
                <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <ReferenceLine x={churnThreshold} stroke="#ef4444" strokeDasharray="5 5" label={{ value: "チャーン", fill: "#ef4444", fontSize: 10 }} />
                <Bar dataKey="COUNT" name="件数">
                  {intervals.map((entry, i) => (
                    <rect key={i} fill={entry.INTERVAL_BUCKET >= churnThreshold ? "#ef4444" : "#3b82f6"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Retention curve */}
          <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <h3 className="text-sm font-medium mb-3" style={{ color: "var(--foreground)" }}>N回目購入リテンション曲線</h3>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={retention} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="N" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} label={{ value: "N回目", position: "insideBottom", offset: -5, fill: "var(--muted-foreground)", fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} unit="%" />
                <Tooltip contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Line type="monotone" dataKey="RETENTION_RATE" name="リテンション率" stroke="#22d3ee" strokeWidth={2.5} dot={{ fill: "#22d3ee", r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
