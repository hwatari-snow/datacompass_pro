"use client"

import { useState, useEffect } from "react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts"

type TabType = "overview" | "matrix" | "ranking" | "attributes"

const TABS: { id: TabType; label: string }[] = [
  { id: "overview", label: "① 流入・流出概要" },
  { id: "matrix", label: "② スイッチマトリクス" },
  { id: "ranking", label: "③ ランキング" },
  { id: "attributes", label: "④ 顧客属性" },
]

interface BrandData {
  BRAND_NAME: string
  PERIOD1_BUYERS: number
  PERIOD2_BUYERS: number
  PERIOD1_SALES: number
  PERIOD2_SALES: number
}

export default function SwitchingPage() {
  const [activeTab, setActiveTab] = useState<TabType>("overview")
  const [brandData, setBrandData] = useState<BrandData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/switching")
      .then((r) => r.json())
      .then((res) => {
        if (res.error) setError(res.error)
        else setBrandData(res.brandShare ?? [])
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const chartData = brandData.slice(0, 10).map((b) => ({
    name: b.BRAND_NAME?.slice(0, 10) ?? "",
    前期: b.PERIOD1_BUYERS ?? 0,
    後期: b.PERIOD2_BUYERS ?? 0,
    差分: (b.PERIOD2_BUYERS ?? 0) - (b.PERIOD1_BUYERS ?? 0),
  }))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>ブランドスイッチング</h1>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          期間間のブランド流入・流出分析
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg p-1" style={{ backgroundColor: "var(--muted)" }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="rounded-md px-4 py-2 text-sm font-medium transition-colors"
            style={
              activeTab === tab.id
                ? { backgroundColor: "var(--card)", color: "var(--foreground)", boxShadow: "0 1px 3px rgba(0,0,0,.1)" }
                : { color: "var(--muted-foreground)" }
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex h-64 items-center justify-center rounded-xl border" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2" style={{ color: "var(--muted-foreground)" }}>
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <span>スイッチングデータを取得中...</span>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 p-4" style={{ backgroundColor: "var(--card)" }}>
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <>
          {activeTab === "overview" && (
            <div className="space-y-4">
              {/* Sankey placeholder */}
              <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
                <h3 className="text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                  ブランド流入・流出 (Sankey)
                </h3>
                <div className="flex h-48 items-center justify-center rounded-lg" style={{ backgroundColor: "var(--muted)" }}>
                  <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                    Sankey Diagram — D3実装予定
                  </span>
                </div>
              </div>

              {/* Period comparison bar chart */}
              <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
                <h3 className="text-sm font-medium mb-3" style={{ color: "var(--foreground)" }}>
                  ブランド別購入者数 (前期 vs 後期 Top10)
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} width={75} />
                    <Tooltip contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                    <Legend />
                    <Bar dataKey="前期" fill="#64748b" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="後期" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {activeTab === "ranking" && (
            <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: "var(--muted)" }}>
                    <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>順位</th>
                    <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>ブランド名</th>
                    <th className="px-3 py-2 text-right text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>前期購入者</th>
                    <th className="px-3 py-2 text-right text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>後期購入者</th>
                    <th className="px-3 py-2 text-right text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>増減</th>
                  </tr>
                </thead>
                <tbody>
                  {brandData.map((row, i) => {
                    const diff = (row.PERIOD2_BUYERS ?? 0) - (row.PERIOD1_BUYERS ?? 0)
                    return (
                      <tr key={i} className="border-t" style={{ borderColor: "var(--border)" }}>
                        <td className="px-3 py-2 font-medium" style={{ color: "var(--foreground)" }}>{i + 1}</td>
                        <td className="px-3 py-2" style={{ color: "var(--foreground)" }}>{row.BRAND_NAME}</td>
                        <td className="px-3 py-2 text-right" style={{ color: "var(--muted-foreground)" }}>{(row.PERIOD1_BUYERS ?? 0).toLocaleString()}</td>
                        <td className="px-3 py-2 text-right" style={{ color: "var(--foreground)" }}>{(row.PERIOD2_BUYERS ?? 0).toLocaleString()}</td>
                        <td className={`px-3 py-2 text-right font-medium ${diff >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {diff >= 0 ? "+" : ""}{diff.toLocaleString()}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {(activeTab === "matrix" || activeTab === "attributes") && (
            <div className="flex h-64 items-center justify-center rounded-xl border" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
              <span style={{ color: "var(--muted-foreground)" }}>
                {activeTab === "matrix" ? "スイッチマトリクス (ヒートマップ)" : "スイッチ顧客属性分析"} — 実装予定
              </span>
            </div>
          )}
        </>
      )}
    </div>
  )
}
