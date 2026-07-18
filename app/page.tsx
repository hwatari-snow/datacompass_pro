"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  BarChart3, TrendingUp, Users, ShoppingCart, ArrowUp, ArrowDown,
  SlidersHorizontal, Target, ArrowLeftRight, Sparkles, Receipt, Package, Wallet, RefreshCw,
} from "lucide-react"
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend,
} from "recharts"
import { yen, compact, delta } from "@/lib/format"
import { CHART_COLORS, PALETTE } from "@/lib/palette"

interface Metric { cur: number; prev: number }
interface OverviewData {
  kpis: {
    sales: Metric; receipts: Metric; quantity: Metric; avgSpend: Metric
    periodStart?: string; periodEnd?: string
  }
  trend: { ym: string; sales: number }[]
  categories: { name: string; sales: number }[]
  freshness: { lastRefresh: string | null; dataThrough: string | null }
}

function KpiCard({
  title, value, unit, metric, icon: Icon, accentColor,
}: {
  title: string; value: string; unit: string
  metric?: Metric; icon: React.ComponentType<{ className?: string }>; accentColor: string
}) {
  const d = metric ? delta(metric.cur, metric.prev) : null
  return (
    <div className="rounded-xl border p-5 transition-colors" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between">
        <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>{title}</span>
        <span style={{ color: accentColor }}><Icon className="h-4 w-4" /></span>
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-3xl font-bold" style={{ color: accentColor }}>{value}</span>
        <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>{unit}</span>
      </div>
      {d && d.dir !== "flat" && (
        <div className="mt-2 flex items-center gap-1 text-xs">
          {d.dir === "up" ? <ArrowUp className="h-3 w-3 text-emerald-500" /> : <ArrowDown className="h-3 w-3 text-red-500" />}
          <span className={d.dir === "up" ? "text-emerald-500" : "text-red-500"}>{d.text}</span>
          <span style={{ color: "var(--muted-foreground)" }}>vs 前月</span>
        </div>
      )}
    </div>
  )
}

const SHORTCUTS = [
  { href: "/analysis/conditions", label: "分析条件設定", desc: "期間・店舗・商品・会員を指定", icon: SlidersHorizontal },
  { href: "/analysis/abc", label: "ABC分析", desc: "売上構成とランク分類", icon: BarChart3 },
  { href: "/analysis/results", label: "属性分析", desc: "会員属性・購買行動", icon: Users },
  { href: "/analysis/trend", label: "トレンド分析", desc: "時系列の推移・比較", icon: TrendingUp },
  { href: "/analysis/basket", label: "バスケット分析", desc: "併売・同時購入", icon: ShoppingCart },
  { href: "/brand/profiling", label: "プロファイリング", desc: "ブランド購買者像", icon: Target },
  { href: "/brand/switching", label: "スイッチング", desc: "ブランド間の移動", icon: ArrowLeftRight },
  { href: "/ai/analyst", label: "Ask Analyst", desc: "自然言語で分析", icon: Sparkles },
]

function fmtRefresh(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (isNaN(d.getTime())) return String(iso)
  return d.toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

export default function OverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/overview")
      .then((r) => r.json())
      .then((d) => { if (!d.error) setData(d) })
      .finally(() => setLoading(false))
  }, [])

  const periodLabel = data?.kpis.periodStart
    ? `${String(data.kpis.periodStart).slice(0, 7)} 実績（前月比）`
    : "最新月実績"

  const catTotal = data?.categories.reduce((a, c) => a + c.sales, 0) ?? 0

  return (
    <div className="space-y-6">
      {/* Page header + freshness badge */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>エグゼクティブサマリ</h1>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{periodLabel} ・ ID-POS主要KPI</p>
        </div>
        <div
          className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--card)", color: "var(--muted-foreground)" }}
          title="Dynamic Tables の最終リフレッシュ時刻"
        >
          <RefreshCw className="h-3.5 w-3.5" style={{ color: PALETTE.primary }} />
          <span>データ更新: <span className="font-medium" style={{ color: "var(--foreground)" }}>{fmtRefresh(data?.freshness.lastRefresh ?? null)}</span></span>
          {data?.freshness.dataThrough && (
            <span className="hidden sm:inline">/ 集計最終日: <span className="font-medium" style={{ color: "var(--foreground)" }}>{String(data.freshness.dataThrough).slice(0, 10)}</span></span>
          )}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="売上金額" value={loading ? "…" : compact(data?.kpis.sales.cur)} unit="円" metric={data?.kpis.sales} icon={Wallet} accentColor="var(--brand-cyan)" />
        <KpiCard title="レシート数（客数）" value={loading ? "…" : compact(data?.kpis.receipts.cur)} unit="件" metric={data?.kpis.receipts} icon={Receipt} accentColor="var(--brand-green)" />
        <KpiCard title="平均客単価" value={loading ? "…" : yen(data?.kpis.avgSpend.cur)} unit="" metric={data?.kpis.avgSpend} icon={TrendingUp} accentColor="var(--brand-amber)" />
        <KpiCard title="販売点数" value={loading ? "…" : compact(data?.kpis.quantity.cur)} unit="点" metric={data?.kpis.quantity} icon={Package} accentColor="var(--brand-pink)" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Monthly sales trend */}
        <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <h3 className="text-sm font-medium" style={{ color: "var(--foreground)" }}>月次売上トレンド</h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>過去12ヶ月の売上金額推移</p>
          <div className="mt-4 h-56">
            {data && data.trend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.trend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={PALETTE.primary} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={PALETTE.primary} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="ym" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
                  <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickFormatter={(v) => compact(v)} width={48} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }}
                    labelStyle={{ color: "var(--foreground)" }}
                    formatter={(v: number) => [yen(v), "売上金額"]}
                  />
                  <Area type="monotone" dataKey="sales" stroke={PALETTE.primary} strokeWidth={2} fill="url(#salesFill)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-lg" style={{ backgroundColor: "var(--muted)" }}>
                <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>{loading ? "読み込み中…" : "データなし"}</span>
              </div>
            )}
          </div>
        </div>

        {/* Category share */}
        <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <h3 className="text-sm font-medium" style={{ color: "var(--foreground)" }}>カテゴリ別売上構成</h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>最新月のMD別売上シェア</p>
          <div className="mt-4 h-56">
            {data && data.categories.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.categories} dataKey="sales" nameKey="name" cx="42%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={1}>
                    {data.categories.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }}
                    formatter={(v: number, n: string) => [`${yen(v)}（${catTotal ? ((v / catTotal) * 100).toFixed(1) : 0}%）`, n]}
                  />
                  <Legend layout="vertical" align="right" verticalAlign="middle" iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-lg" style={{ backgroundColor: "var(--muted)" }}>
                <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>{loading ? "読み込み中…" : "データなし"}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Analysis shortcuts */}
      <div>
        <h3 className="mb-3 text-sm font-semibold" style={{ color: "var(--foreground)" }}>分析メニュー</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {SHORTCUTS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="group flex items-start gap-3 rounded-xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
              style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: "rgba(90,180,224,0.1)", color: PALETTE.primary }}
              >
                <s.icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{s.label}</p>
                <p className="truncate text-xs" style={{ color: "var(--muted-foreground)" }}>{s.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
