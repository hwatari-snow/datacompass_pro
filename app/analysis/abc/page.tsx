"use client"
import * as React from "react"
import Link from "next/link"
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { yen, num, pct, compact, delta } from "@/lib/format"
import { useConditions } from "@/components/conditions-context"
import type { AbcResult, AbcRow, AbcCriteria, ProductUnit, StoreUnit } from "@/lib/types"

const ABC_COLORS: Record<string, string> = { A: "#4F7CFF", B: "#7C5CFC", C: "#E85A71" }

const PRODUCT_UNITS: { key: ProductUnit; label: string }[] = [
  { key: "item", label: "商品" },
  { key: "md", label: "MD" },
  { key: "major", label: "大分類" },
  { key: "middle", label: "中分類" },
  { key: "minor", label: "小分類" },
  { key: "brand", label: "ブランド" },
  { key: "maker", label: "メーカー" },
]
const STORE_UNITS: { key: StoreUnit; label: string }[] = [
  { key: "store", label: "店舗" },
  { key: "area", label: "エリア" },
  { key: "business_type", label: "業態" },
  { key: "corporation", label: "法人" },
  { key: "prefecture", label: "都道府県" },
]
const CRITERIA: { key: AbcCriteria; label: string }[] = [
  { key: "amount", label: "売上金額" },
  { key: "quantity", label: "売上数量" },
  { key: "receipt", label: "レシート数" },
]

function Toggle<T extends string>({ options, value, onChange, variant = "blue" }: { options: { key: T; label: string }[]; value: T; onChange: (v: T) => void; variant?: "blue" | "red" }) {
  const activeStyle = variant === "red" ? { background: "#E85A71", borderColor: "#E85A71", color: "#fff" } : { background: "#4F7CFF", borderColor: "#4F7CFF", color: "#fff" }
  return (
    <div className="inline-flex rounded-md border overflow-hidden">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          style={value === o.key ? activeStyle : undefined}
          className={cn("px-3 py-1.5 text-sm font-medium border-r last:border-r-0 transition-colors", value !== o.key && "bg-background hover:bg-accent text-foreground")}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Kpi({ label, value, prev, fmt }: { label: string; value: number; prev?: number; fmt: (n: number) => string }) {
  const d = prev != null ? delta(value, prev) : null
  return (
    <Card style={{ borderColor: "#c7d7fe" }}>
      <CardContent className="pt-5">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold mt-1">{fmt(value)}</p>
        {d && (
          <p className={cn("text-xs mt-1", d.dir === "up" ? "text-emerald-600" : d.dir === "down" ? "text-red-500" : "text-muted-foreground")}>
            前期比 {d.text}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export default function AbcPage() {
  const { conditions } = useConditions()
  const [tab, setTab] = React.useState<"product" | "store">("product")
  const [productUnit, setProductUnit] = React.useState<ProductUnit>("item")
  const [storeUnit, setStoreUnit] = React.useState<StoreUnit>("store")
  const [criteria, setCriteria] = React.useState<AbcCriteria>("amount")
  const [data, setData] = React.useState<{ base: AbcResult; compare: AbcResult | null; usedSnapshot?: boolean } | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [classFilter, setClassFilter] = React.useState<"ALL" | "A" | "B" | "C">("ALL")
  const [q, setQ] = React.useState("")
  const [visibleCount, setVisibleCount] = React.useState(100)

  const unit = tab === "product" ? productUnit : storeUnit

  const fetchData = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/abc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conditions, tab, unit, criteria }),
      })
      const text = await res.text()
      let json: Record<string, unknown>
      try { json = JSON.parse(text) } catch { throw new Error(`サーバーエラー (${res.status}): ${text.slice(0, 120)}`) }
      if (!res.ok) throw new Error((json.error as string) ?? "集計に失敗しました")
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : "集計に失敗しました")
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [conditions, tab, unit, criteria])

  React.useEffect(() => {
    fetchData()
  }, [conditions, tab, unit, criteria, fetchData])

  const rows = data?.base.rows ?? []
  const summary = data?.base.summary
  const cmp = data?.compare?.summary

  const metricOf = (r: AbcRow) => (criteria === "amount" ? r.sales : criteria === "quantity" ? r.quantity : r.receipt_count)
  const metricFmt = criteria === "amount" ? yen : num

  const chartData = React.useMemo(
    () => rows.slice(0, 50).map((r) => ({ name: r.name, value: metricOf(r), cumulative: r.cumulative_ratio, abc_class: r.abc_class })),
    [rows, criteria],
  )

  const tableRows = React.useMemo(() => {
    let rs = rows
    if (classFilter !== "ALL") rs = rs.filter((r) => r.abc_class === classFilter)
    const needle = q.trim().toLowerCase()
    if (needle) rs = rs.filter((r) => r.name.toLowerCase().includes(needle) || r.code.toLowerCase().includes(needle))
    return rs
  }, [rows, classFilter, q])

  const visibleRows = React.useMemo(() => tableRows.slice(0, visibleCount), [tableRows, visibleCount])

  // Reset visible count when filters change
  React.useEffect(() => { setVisibleCount(100) }, [classFilter, q, tab, unit, criteria])

  const exportExcel = async () => {
    const XLSX = await import("xlsx")
    const aoa = [
      ["順位", "コード", "名称", "ABC", "売上金額", "売上数量", "レシート数", "構成比%", "累積%"],
      ...rows.map((r) => [r.rank, r.code, r.name, r.abc_class, r.sales, r.quantity, r.receipt_count, r.sales_ratio, r.cumulative_ratio]),
    ]
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "ABC分析")
    XLSX.writeFile(wb, `abc_${tab}_${unit}_${criteria}.xlsx`)
  }

  return (
    <main className="w-full max-w-7xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold">ABC分析結果</h1>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/analysis/conditions">条件を変更</Link>
          </Button>
          <Button variant="outline" onClick={exportExcel} disabled={rows.length === 0}>
            Excel出力
          </Button>
        </div>
      </div>
      {conditions && (
        <p className="text-sm text-muted-foreground mb-6">
          基準期間 {conditions.baseStart}〜{conditions.baseEnd}
          {conditions.compareEnabled && ` / 比較 ${conditions.compareStart}〜${conditions.compareEnd}`}
          {" / "}
          {conditions.storeCodes.length ? `${conditions.storeCodes.length}店舗` : "全店舗"}・
          {conditions.itemCodes.length ? `${conditions.itemCodes.length}商品` : "全商品"}
          {conditions.member.enabled && " / 会員条件あり"}
        </p>
      )}

      {error && <div className="bg-destructive/10 text-destructive text-sm rounded-md p-3 mb-4">{error}</div>}

      {/* KPI */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Kpi label="対象数" value={summary.total_units} prev={cmp?.total_units} fmt={num} />
          <Kpi label="売上金額" value={summary.total_sales} prev={cmp?.total_sales} fmt={yen} />
          <Kpi label="売上数量" value={summary.total_quantity} prev={cmp?.total_quantity} fmt={num} />
          <Kpi label="レシート数" value={summary.total_receipts} prev={cmp?.total_receipts} fmt={num} />
        </div>
      )}

      {/* ABCサマリ */}
      {summary && (
        <div className="flex flex-wrap gap-3 mb-6">
          {(["A", "B", "C"] as const).map((cls) => {
            const cnt = cls === "A" ? summary.a_count : cls === "B" ? summary.b_count : summary.c_count
            const total = summary.a_count + summary.b_count + summary.c_count
            return (
              <div key={cls} className="flex items-center gap-2 border rounded-lg px-4 py-2">
                <span className="w-3 h-3 rounded-full" style={{ background: ABC_COLORS[cls] }} />
                <span className="text-sm font-medium">{cls}ランク</span>
                <span className="text-sm">{cnt}件</span>
                <span className="text-xs text-muted-foreground">({pct(total ? (100 * cnt) / total : 0)})</span>
              </div>
            )
          })}
        </div>
      )}

      {/* コントロール */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Toggle options={[{ key: "product" as const, label: "商品別ABC" }, { key: "store" as const, label: "店舗別ABC" }]} value={tab} onChange={setTab} />
        {tab === "product" ? (
          <Toggle options={PRODUCT_UNITS} value={productUnit} onChange={setProductUnit} />
        ) : (
          <Toggle options={STORE_UNITS} value={storeUnit} onChange={setStoreUnit} />
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">分析基準</span>
          <Toggle options={CRITERIA} value={criteria} onChange={setCriteria} variant="red" />
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground py-12 text-center">集計中…</p>}

      {!loading && rows.length > 0 && (
        <>
          {/* パレート図 */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">パレート図（上位50）</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={340}>
                <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={false} />
                  <YAxis yAxisId="left" tickFormatter={(v) => compact(v as number)} />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    formatter={(value: number, name: string) => (name === "累積%" ? `${value}%` : criteria === "amount" ? yen(value) : num(value))}
                    labelFormatter={(l) => String(l)}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="value" name={CRITERIA.find((x) => x.key === criteria)?.label}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={ABC_COLORS[d.abc_class]} />
                    ))}
                  </Bar>
                  <Line yAxisId="right" type="monotone" dataKey="cumulative" name="累積%" stroke="#1e3a5f" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* 明細テーブル */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">明細（{tableRows.length}件）</CardTitle>
              <div className="flex items-center gap-2">
                <Toggle
                  options={[{ key: "ALL" as const, label: "全て" }, { key: "A" as const, label: "A" }, { key: "B" as const, label: "B" }, { key: "C" as const, label: "C" }]}
                  value={classFilter}
                  onChange={setClassFilter}
                />
                <Input placeholder="検索" value={q} onChange={(e) => setQ(e.target.value)} className="w-40" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background border-b">
                    <tr className="text-left text-muted-foreground">
                      <th className="py-2 pr-3">順位</th>
                      <th className="py-2 pr-3">名称</th>
                      {tab === "product" && unit === "item" && <th className="py-2 pr-3">カテゴリ</th>}
                      <th className="py-2 pr-3">ABC</th>
                      <th className="py-2 pr-3 text-right">売上金額</th>
                      <th className="py-2 pr-3 text-right">数量</th>
                      <th className="py-2 pr-3 text-right">レシート</th>
                      <th className="py-2 pr-3 text-right">構成比</th>
                      <th className="py-2 pr-3 text-right">累積比</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((r) => (
                      <tr key={r.code} className="border-b last:border-0 hover:bg-accent/40">
                        <td className="py-1.5 pr-3 tabular-nums">{r.rank}</td>
                        <td className="py-1.5 pr-3">{r.name}</td>
                        {tab === "product" && unit === "item" && (
                          <td className="py-1.5 pr-3 text-xs text-muted-foreground">{r.major_name} / {r.brand_name}</td>
                        )}
                        <td className="py-1.5 pr-3">
                          <span className="px-1.5 py-0.5 rounded text-xs font-semibold text-white" style={{ background: ABC_COLORS[r.abc_class] }}>
                            {r.abc_class}
                          </span>
                        </td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">{yen(r.sales)}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">{num(r.quantity)}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">{num(r.receipt_count)}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">{pct(r.sales_ratio, 2)}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">{pct(r.cumulative_ratio, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {visibleCount < tableRows.length && (
                <div className="flex justify-center pt-3">
                  <Button variant="outline" size="sm" onClick={() => setVisibleCount((v) => v + 200)}>
                    さらに表示（残り {tableRows.length - visibleCount} 件）
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!loading && !error && rows.length === 0 && (
        <p className="text-sm text-muted-foreground py-12 text-center">該当データがありません。条件を変更してください。</p>
      )}
    </main>
  )
}
