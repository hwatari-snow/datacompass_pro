"use client"

import { useState, useEffect } from "react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts"
import { ShoppingCart, ArrowRight } from "lucide-react"
import { useConditions } from "@/components/conditions-context"

interface PairRow {
  ITEM_A: string
  ITEM_A_NAME: string
  FREQ_A: number
  ITEM_B: string
  ITEM_B_NAME: string
  FREQ_B: number
  CO_COUNT: number
  CONFIDENCE_A_TO_B: number
  CONFIDENCE_B_TO_A: number
  LIFT: number
}

interface Summary {
  TOTAL_BASKETS: number
  UNIQUE_ITEMS: number
  AVG_ITEMS_PER_BASKET: number
}

export default function BasketPage() {
  const { conditions } = useConditions()
  const [pairs, setPairs] = useState<PairRow[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    setLoading(true)
    setError("")
    const params = new URLSearchParams()
    if (conditions.baseStart) params.set("baseStart", conditions.baseStart)
    if (conditions.baseEnd) params.set("baseEnd", conditions.baseEnd)
    if (conditions.storeCodes.length) params.set("storeCodes", conditions.storeCodes.join(","))
    if (conditions.itemCodes.length) params.set("itemCodes", conditions.itemCodes.join(","))

    fetch(`/api/basket?${params}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.error) setError(res.error)
        else {
          setSummary(res.summary ?? null)
          setPairs(res.pairs ?? [])
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [conditions.baseStart, conditions.baseEnd, conditions.storeCodes, conditions.itemCodes])

  const chartData = pairs.slice(0, 15).map((p) => ({
    name: `${p.ITEM_A_NAME?.slice(0, 8)} × ${p.ITEM_B_NAME?.slice(0, 8)}`,
    lift: p.LIFT,
    co_count: p.CO_COUNT,
  }))

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
          バスケット分析（併買分析）
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--muted-foreground)" }}>
          同一レシート内で一緒に購入される商品ペアをリフト値で可視化
        </p>
      </div>

      {/* KPI cards */}
      {summary && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>総バスケット数</p>
            <p className="text-2xl font-bold mt-1" style={{ color: "var(--brand-cyan)" }}>
              {summary.TOTAL_BASKETS?.toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>ユニーク商品数</p>
            <p className="text-2xl font-bold mt-1" style={{ color: "var(--brand-green)" }}>
              {summary.UNIQUE_ITEMS?.toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>平均買上点数</p>
            <p className="text-2xl font-bold mt-1" style={{ color: "var(--brand-amber)" }}>
              {summary.AVG_ITEMS_PER_BASKET} 点
            </p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex h-64 items-center justify-center rounded-xl border" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2" style={{ color: "var(--muted-foreground)" }}>
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <span>併買ペアを計算中...</span>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 p-4" style={{ backgroundColor: "var(--card)" }}>
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {!loading && !error && pairs.length > 0 && (
        <>
          {/* Lift chart */}
          <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--foreground)" }}>
              リフト値 TOP15（併買の強さ）
            </h3>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 120 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} width={120} />
                <Tooltip
                  contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }}
                  labelStyle={{ color: "var(--foreground)" }}
                  formatter={(value: number, name: string) => [
                    name === "lift" ? value.toFixed(2) : value.toLocaleString(),
                    name === "lift" ? "リフト値" : "共起数",
                  ]}
                />
                <Bar dataKey="lift" name="リフト値" fill="var(--brand-primary)" radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Detail table */}
          <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
              <ShoppingCart className="h-4 w-4" style={{ color: "var(--brand-primary)" }} />
              <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                併買ペア一覧（リフト値順）
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: "var(--muted)" }}>
                    <th className="px-3 py-2 text-left text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>商品A</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}></th>
                    <th className="px-3 py-2 text-left text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>商品B</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>共起数</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>信頼度 A→B</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>信頼度 B→A</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold" style={{ color: "var(--brand-primary)" }}>リフト値</th>
                  </tr>
                </thead>
                <tbody>
                  {pairs.map((row, i) => (
                    <tr key={i} className="border-t" style={{ borderColor: "var(--border)" }}>
                      <td className="px-3 py-2" style={{ color: "var(--foreground)" }}>
                        <div className="font-medium">{row.ITEM_A_NAME}</div>
                        <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>出現: {row.FREQ_A}回</div>
                      </td>
                      <td className="px-1 py-2 text-center">
                        <ArrowRight className="h-3 w-3 inline" style={{ color: "var(--muted-foreground)" }} />
                      </td>
                      <td className="px-3 py-2" style={{ color: "var(--foreground)" }}>
                        <div className="font-medium">{row.ITEM_B_NAME}</div>
                        <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>出現: {row.FREQ_B}回</div>
                      </td>
                      <td className="px-3 py-2 text-right font-medium" style={{ color: "var(--foreground)" }}>
                        {row.CO_COUNT?.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right" style={{ color: "var(--foreground)" }}>
                        {(row.CONFIDENCE_A_TO_B * 100).toFixed(1)}%
                      </td>
                      <td className="px-3 py-2 text-right" style={{ color: "var(--foreground)" }}>
                        {(row.CONFIDENCE_B_TO_A * 100).toFixed(1)}%
                      </td>
                      <td className="px-3 py-2 text-right font-bold" style={{ color: row.LIFT > 2 ? "var(--brand-primary)" : "var(--foreground)" }}>
                        {row.LIFT?.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!loading && !error && pairs.length === 0 && !summary && (
        <div className="flex h-48 items-center justify-center rounded-xl border" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <span style={{ color: "var(--muted-foreground)" }}>該当するデータがありません</span>
        </div>
      )}
    </div>
  )
}
