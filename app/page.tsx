"use client"

import { BarChart3, TrendingUp, Users, ShoppingCart, ArrowUp, ArrowDown } from "lucide-react"

interface KpiCardProps {
  title: string
  value: string
  unit: string
  trend?: { value: string; direction: "up" | "down" }
  icon: React.ComponentType<{ className?: string }>
  accentColor: string
}

function KpiCard({ title, value, unit, trend, icon: Icon, accentColor }: KpiCardProps) {
  return (
    <div
      className="rounded-xl border p-5 transition-colors"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>{title}</span>
        <span style={{ color: accentColor }}><Icon className="h-4 w-4" /></span>
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-3xl font-bold" style={{ color: accentColor }}>{value}</span>
        <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>{unit}</span>
      </div>
      {trend && (
        <div className="mt-2 flex items-center gap-1 text-xs">
          {trend.direction === "up" ? (
            <ArrowUp className="h-3 w-3 text-green-400" />
          ) : (
            <ArrowDown className="h-3 w-3 text-red-400" />
          )}
          <span className={trend.direction === "up" ? "text-green-400" : "text-red-400"}>
            {trend.value}
          </span>
          <span style={{ color: "var(--muted-foreground)" }}>vs 前期</span>
        </div>
      )}
    </div>
  )
}

export default function OverviewPage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
          エグゼクティブサマリ
        </h1>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          ID-POS分析の主要KPIをリアルタイムで可視化
        </p>
      </div>

      {/* KPI cards row 1 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="総取引件数"
          value="8.69"
          unit="億件"
          trend={{ value: "2.4%", direction: "up" }}
          icon={ShoppingCart}
          accentColor="var(--brand-cyan)"
        />
        <KpiCard
          title="ユニーク会員数"
          value="2,000"
          unit="万人"
          trend={{ value: "5.2%", direction: "up" }}
          icon={Users}
          accentColor="var(--brand-green)"
        />
        <KpiCard
          title="分析実行数 (今月)"
          value="402"
          unit="件"
          trend={{ value: "12%", direction: "down" }}
          icon={BarChart3}
          accentColor="var(--brand-amber)"
        />
        <KpiCard
          title="ABC-A構成比"
          value="29.4"
          unit="%"
          trend={{ value: "1.2pt", direction: "up" }}
          icon={TrendingUp}
          accentColor="var(--brand-pink)"
        />
      </div>

      {/* KPI cards row 2 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          title="登録店舗数"
          value="695"
          unit="店"
          icon={ShoppingCart}
          accentColor="var(--brand-cyan)"
        />
        <KpiCard
          title="商品マスタ件数"
          value="424"
          unit="万SKU"
          icon={BarChart3}
          accentColor="var(--brand-green)"
        />
        <KpiCard
          title="平均分析レスポンス"
          value="3.2"
          unit="秒"
          trend={{ value: "0.8s", direction: "up" }}
          icon={TrendingUp}
          accentColor="var(--brand-amber)"
        />
      </div>

      {/* Charts placeholder */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div
          className="rounded-xl border p-5"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <h3 className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
            月次分析実行トレンド
          </h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            過去12ヶ月の分析実行件数推移
          </p>
          <div className="mt-4 flex h-48 items-center justify-center rounded-lg" style={{ backgroundColor: "var(--muted)" }}>
            <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>Chart — Coming Soon</span>
          </div>
        </div>
        <div
          className="rounded-xl border p-5"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <h3 className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
            カテゴリ別売上構成
          </h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            直近期間のMD別売上シェア
          </p>
          <div className="mt-4 flex h-48 items-center justify-center rounded-lg" style={{ backgroundColor: "var(--muted)" }}>
            <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>Chart — Coming Soon</span>
          </div>
        </div>
      </div>
    </div>
  )
}
