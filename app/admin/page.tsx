"use client"
import * as React from "react"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { cn } from "@/lib/utils"
import { num, pct, compact } from "@/lib/format"
import type { Account, AppUser, CreditMonth } from "@/lib/types"
import { CHART_COLORS } from "@/lib/palette"

interface Category { md_code: string; md_name: string; major_code: string; major_name: string; middle_code: string; middle_name: string }

export default function SettingsPage() {
  const [accounts, setAccounts] = React.useState<Account[]>([])
  const [users, setUsers] = React.useState<(AppUser & { COMPANY_NAME?: string })[]>([])
  const [credits, setCredits] = React.useState<CreditMonth[]>([])
  const [loading, setLoading] = React.useState(true)
  const [tab, setTab] = React.useState("dashboard")

  React.useEffect(() => {
    Promise.all([
      fetch("/api/admin/accounts").then((r) => r.json()),
      fetch("/api/admin/users").then((r) => r.json()),
      fetch("/api/admin/credits").then((r) => r.json()),
    ])
      .then(([a, u, c]) => {
        if (Array.isArray(a)) setAccounts(a.map(normAccount))
        if (Array.isArray(u)) setUsers(u.map(normUser))
        if (Array.isArray(c)) setCredits(c.map(normCredit))
      })
      .finally(() => setLoading(false))
  }, [])

  const tabs = [
    { id: "dashboard", label: "ダッシュボード", icon: "◈" },
    { id: "accounts", label: "アカウント", icon: "◇" },
    { id: "disclosure", label: "データ開示", icon: "◆" },
    { id: "credits", label: "クレジット", icon: "◎" },
    { id: "users", label: "ユーザー", icon: "◉" },
  ]

  return (
    <main className="w-full max-w-[1400px] mx-auto py-6 px-5">
      <header className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>管理コンソール</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
          DataCompass Pro のアカウント・データ開示・クレジット・ユーザーを一元管理
        </p>
      </header>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-sm" style={{ color: "var(--muted-foreground)" }}>読み込み中…</div>
        </div>
      ) : (
        <>
          <nav className="flex gap-1 rounded-lg p-1 mb-6" style={{ backgroundColor: "var(--muted)" }}>
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all",
                  tab === t.id
                    ? "text-white shadow-sm"
                    : "hover:opacity-80",
                )}
                style={tab === t.id
                  ? { backgroundColor: "var(--brand-primary)" }
                  : { color: "var(--muted-foreground)" }
                }
              >
                <span className="text-xs">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </nav>

          {tab === "dashboard" && <DashboardTab accounts={accounts} users={users} credits={credits} />}
          {tab === "accounts" && <AccountsTab accounts={accounts} />}
          {tab === "disclosure" && <DisclosureTab accounts={accounts} />}
          {tab === "credits" && <CreditsTab accounts={accounts} credits={credits} />}
          {tab === "users" && <UsersTab users={users} />}
        </>
      )}
    </main>
  )
}

// ---- Normalizers ----
function normAccount(r: Record<string, unknown>): Account {
  return {
    account_id: String(r.ACCOUNT_ID), account_name: String(r.ACCOUNT_NAME), company_name: String(r.COMPANY_NAME),
    industry: String(r.INDUSTRY), prefecture: String(r.PREFECTURE), status: String(r.STATUS),
    user_count: Number(r.USER_COUNT), category_count: Number(r.CATEGORY_COUNT), store_count: Number(r.STORE_COUNT),
    credits_used: Number(r.CREDITS_USED), credit_limit: Number(r.CREDIT_LIMIT), last_login: String(r.LAST_LOGIN ?? ""),
    created_at: String(r.CREATED_AT ?? ""), auth_method: String(r.AUTH_METHOD), app_version: String(r.APP_VERSION),
  }
}
function normUser(r: Record<string, unknown>): AppUser & { COMPANY_NAME?: string } {
  return {
    user_id: String(r.USER_ID), account_id: String(r.ACCOUNT_ID), user_name: String(r.USER_NAME), email: String(r.EMAIL),
    auth_method: String(r.AUTH_METHOD), idp: String(r.IDP), last_login: String(r.LAST_LOGIN ?? ""), status: String(r.STATUS),
    COMPANY_NAME: String(r.COMPANY_NAME ?? ""),
  }
}
function normCredit(r: Record<string, unknown>): CreditMonth {
  return {
    usage_month: String(r.USAGE_MONTH), compute_credits: Number(r.COMPUTE_CREDITS),
    storage_credits: Number(r.STORAGE_CREDITS), serverless_credits: Number(r.SERVERLESS_CREDITS),
  }
}

// ---- Shared Components ----
function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <p className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>{label}</p>
      <p className="text-2xl font-bold mt-1" style={{ color: accent || "var(--foreground)" }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>{sub}</p>}
    </div>
  )
}

function Panel({ title, actions, children, className }: { title?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border overflow-hidden", className)} style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      {(title || actions) && (
        <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: "var(--border)" }}>
          {title && <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{title}</h3>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  )
}

function Badge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; fg: string }> = {
    "稼働中": { bg: "rgba(34,211,153,0.12)", fg: "#34d399" },
    "有効": { bg: "rgba(34,211,153,0.12)", fg: "#34d399" },
    "停止中": { bg: "rgba(239,68,68,0.12)", fg: "#ef4444" },
    "無効": { bg: "rgba(239,68,68,0.12)", fg: "#ef4444" },
    "承認待ち": { bg: "rgba(251,191,36,0.12)", fg: "#fbbf24" },
  }
  const s = styles[status] ?? { bg: "var(--muted)", fg: "var(--muted-foreground)" }
  return (
    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: s.bg, color: s.fg }}>
      {status}
    </span>
  )
}

function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  React.useEffect(() => {
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-in slide-in-from-bottom-4"
      style={{
        backgroundColor: type === "success" ? "rgba(34,211,153,0.15)" : "rgba(239,68,68,0.15)",
        color: type === "success" ? "#34d399" : "#ef4444",
        border: `1px solid ${type === "success" ? "rgba(34,211,153,0.3)" : "rgba(239,68,68,0.3)"}`,
      }}
    >
      <span>{type === "success" ? "✓" : "✕"}</span>
      {message}
    </div>
  )
}

function DataTable({ head, rows, align }: { head: string[]; rows: React.ReactNode[][]; align: ("left" | "right")[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ backgroundColor: "var(--muted)" }}>
            {head.map((h, i) => (
              <th
                key={i}
                className={cn("py-2.5 px-3 text-xs font-medium whitespace-nowrap", align[i] === "right" ? "text-right" : "text-left")}
                style={{ color: "var(--muted-foreground)" }}
              >{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-t transition-colors hover:opacity-80" style={{ borderColor: "var(--border)" }}>
              {r.map((cell, ci) => (
                <td key={ci} className={cn("py-2 px-3", align[ci] === "right" ? "text-right tabular-nums" : "text-left")}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ===== Dashboard =====
function DashboardTab({ accounts, users, credits }: { accounts: Account[]; users: (AppUser & { COMPANY_NAME?: string })[]; credits: CreditMonth[] }) {
  const active = accounts.filter((a) => a.status === "稼働中").length
  const overLimit = accounts.filter((a) => a.credits_used >= a.credit_limit).length
  const thisMonth = credits[credits.length - 1]
  const monthTotal = thisMonth ? thisMonth.compute_credits + thisMonth.storage_credits + thisMonth.serverless_credits : 0
  const statusData = ["稼働中", "停止中", "承認待ち"].map((s) => ({ name: s, value: accounts.filter((a) => a.status === s).length })).filter((d) => d.value > 0)
  const top = [...accounts].sort((a, b) => b.credits_used - a.credits_used).slice(0, 8)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard label="総アカウント数" value={num(accounts.length)} />
        <KpiCard label="稼働中" value={num(active)} sub={`全体の ${pct(accounts.length ? (100 * active) / accounts.length : 0)}`} accent="#34d399" />
        <KpiCard label="総ユーザー数" value={num(users.length)} />
        <KpiCard label="今月クレジット" value={compact(monthTotal)} accent="#22d3ee" />
        <KpiCard label="上限超過" value={num(overLimit)} sub="要確認" accent={overLimit > 0 ? "#ef4444" : undefined} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Panel title="月次クレジット消費" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={credits} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="usage_month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => compact(v as number)} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => num(v)}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="compute_credits" name="Compute" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
              <Bar dataKey="storage_credits" name="Storage" stackId="a" fill="#22d3ee" />
              <Bar dataKey="serverless_credits" name="Serverless" stackId="a" fill="#34d399" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="アカウント状態">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={88} paddingAngle={2}>
                {statusData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <Panel title="クレジット消費 上位アカウント">
        <DataTable
          head={["企業名", "業種", "消費", "上限", "利用率"]}
          rows={top.map((a) => [
            a.company_name,
            a.industry,
            num(a.credits_used),
            num(a.credit_limit),
            <ProgressCell key={a.account_id} value={(a.credits_used / a.credit_limit) * 100} />,
          ])}
          align={["left", "left", "right", "right", "right"]}
        />
      </Panel>
    </div>
  )
}

function ProgressCell({ value }: { value: number }) {
  const color = value >= 100 ? "#ef4444" : value >= 80 ? "#fbbf24" : "#34d399"
  return (
    <div className="flex items-center gap-2 justify-end">
      <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--muted)" }}>
        <div className="h-full rounded-full" style={{ width: `${Math.min(value, 100)}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs tabular-nums" style={{ color }}>{pct(value)}</span>
    </div>
  )
}

// ===== Accounts =====
function AccountsTab({ accounts }: { accounts: Account[] }) {
  const [q, setQ] = React.useState("")
  const [status, setStatus] = React.useState("ALL")
  const [page, setPage] = React.useState(0)
  const PER = 12
  const filtered = accounts.filter(
    (a) => (status === "ALL" || a.status === status) && (a.company_name.includes(q) || a.account_name.includes(q)),
  )
  const pages = Math.ceil(filtered.length / PER)
  const view = filtered.slice(page * PER, page * PER + PER)

  return (
    <Panel
      title={`アカウント一覧（${filtered.length}件）`}
      actions={
        <div className="flex items-center gap-2">
          <input
            placeholder="検索…"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(0) }}
            className="h-8 rounded-md border px-3 text-sm w-48 outline-none focus:ring-1"
            style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
          />
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(0) }}
            className="h-8 rounded-md border px-2 text-sm outline-none"
            style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            <option value="ALL">全ステータス</option>
            <option value="稼働中">稼働中</option>
            <option value="停止中">停止中</option>
            <option value="承認待ち">承認待ち</option>
          </select>
        </div>
      }
    >
      <DataTable
        head={["企業名", "アカウント", "業種", "地域", "ユーザー", "カテゴリ", "店舗", "認証", "ステータス"]}
        rows={view.map((a) => [
          <span key={a.account_id} className="font-medium">{a.company_name}</span>,
          <span key={`n-${a.account_id}`} className="text-xs" style={{ color: "var(--muted-foreground)" }}>{a.account_name}</span>,
          a.industry, a.prefecture, num(a.user_count), num(a.category_count), num(a.store_count),
          a.auth_method, <Badge key={`s-${a.account_id}`} status={a.status} />,
        ])}
        align={["left", "left", "left", "left", "right", "right", "right", "left", "left"]}
      />
      {pages > 1 && (
        <div className="flex items-center justify-end gap-3 mt-4 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 rounded-md border text-sm disabled:opacity-30 hover:opacity-80 transition-opacity"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            前へ
          </button>
          <span className="text-xs tabular-nums" style={{ color: "var(--muted-foreground)" }}>
            {page + 1} / {pages}
          </span>
          <button
            disabled={page >= pages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 rounded-md border text-sm disabled:opacity-30 hover:opacity-80 transition-opacity"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            次へ
          </button>
        </div>
      )}
    </Panel>
  )
}

// ===== Disclosure =====
type HierLevel = "md" | "major" | "middle"

function DisclosureTab({ accounts }: { accounts: Account[] }) {
  const [selected, setSelected] = React.useState<string | null>(null)
  const [categories, setCategories] = React.useState<Category[]>([])
  const [enabled, setEnabled] = React.useState<Set<string>>(new Set())
  const [saving, setSaving] = React.useState(false)
  const [toast, setToast] = React.useState<{ msg: string; type: "success" | "error" } | null>(null)
  const [level, setLevel] = React.useState<HierLevel>("md")
  const [mdFilter, setMdFilter] = React.useState<string | null>(null)
  const [majorFilter, setMajorFilter] = React.useState<string | null>(null)
  const [searchQ, setSearchQ] = React.useState("")
  const [acctQ, setAcctQ] = React.useState("")

  React.useEffect(() => {
    if (!selected) return
    fetch(`/api/admin/disclosure?accountId=${encodeURIComponent(selected)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.categories) setCategories(d.categories)
        if (d.enabled) setEnabled(new Set(d.enabled))
      })
  }, [selected])

  const toggle = (code: string) => {
    setEnabled((prev) => {
      const next = new Set(prev)
      next.has(code) ? next.delete(code) : next.add(code)
      return next
    })
  }

  const save = async () => {
    if (!selected) return
    setSaving(true)
    try {
      const res = await fetch("/api/admin/disclosure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: selected, enabled: [...enabled] }),
      })
      const data = await res.json()
      if (res.ok) setToast({ msg: `${data.count}カテゴリを保存しました`, type: "success" })
      else setToast({ msg: data.error || "保存に失敗しました", type: "error" })
    } catch { setToast({ msg: "ネットワークエラー", type: "error" }) }
    finally { setSaving(false) }
  }

  const acc = accounts.find((a) => a.account_id === selected)

  // Derived hierarchy data
  const mds = React.useMemo(() => {
    const map = new Map<string, { code: string; name: string; cats: Category[] }>()
    for (const c of categories) {
      if (!map.has(c.md_code)) map.set(c.md_code, { code: c.md_code, name: c.md_name, cats: [] })
      map.get(c.md_code)!.cats.push(c)
    }
    return [...map.values()]
  }, [categories])

  const majors = React.useMemo(() => {
    const filtered = mdFilter ? categories.filter((c) => c.md_code === mdFilter) : categories
    const map = new Map<string, { code: string; name: string; cats: Category[] }>()
    for (const c of filtered) {
      if (!map.has(c.major_code)) map.set(c.major_code, { code: c.major_code, name: c.major_name, cats: [] })
      map.get(c.major_code)!.cats.push(c)
    }
    return [...map.values()]
  }, [categories, mdFilter])

  const visibleMiddles = React.useMemo(() => {
    let list = categories
    if (mdFilter) list = list.filter((c) => c.md_code === mdFilter)
    if (majorFilter) list = list.filter((c) => c.major_code === majorFilter)
    if (searchQ) list = list.filter((c) => c.middle_name.includes(searchQ))
    return list
  }, [categories, mdFilter, majorFilter, searchQ])

  const selectAllVisible = () => {
    setEnabled((prev) => {
      const next = new Set(prev)
      for (const c of visibleMiddles) next.add(c.middle_code)
      return next
    })
  }

  const deselectAllVisible = () => {
    setEnabled((prev) => {
      const next = new Set(prev)
      for (const c of visibleMiddles) next.delete(c.middle_code)
      return next
    })
  }

  const selectedCategories = categories.filter((c) => enabled.has(c.middle_code))

  const navItems: { id: HierLevel; label: string }[] = [
    { id: "md", label: "MD" },
    { id: "major", label: "大分類" },
    { id: "middle", label: "中分類" },
  ]

  return (
    <>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-5">
        {/* Left: Account selector */}
        <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div className="px-3 py-3 border-b" style={{ borderColor: "var(--border)" }}>
            <p className="text-xs font-semibold mb-2" style={{ color: "var(--foreground)" }}>アカウント</p>
            <input
              placeholder="検索…"
              value={acctQ}
              onChange={(e) => setAcctQ(e.target.value)}
              className="w-full h-7 rounded border px-2 text-xs outline-none"
              style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
            />
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            {accounts.filter((a) => a.company_name.includes(acctQ)).map((a) => (
              <button
                key={a.account_id}
                onClick={() => { setSelected(a.account_id); setLevel("md"); setMdFilter(null); setMajorFilter(null) }}
                className="w-full text-left px-3 py-2.5 border-b transition-colors hover:opacity-80"
                style={{
                  borderColor: "var(--border)",
                  backgroundColor: selected === a.account_id ? "var(--accent)" : "transparent",
                }}
              >
                <p className="text-xs font-medium" style={{ color: selected === a.account_id ? "var(--brand-primary)" : "var(--foreground)" }}>{a.company_name}</p>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>DC_ACCT_{String(a.account_id).padStart(3, "0")}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Hierarchy browser + selected */}
        <div>
          {/* Header */}
          {acc && (
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                  {acc.company_name} — カテゴリ開示設定
                </h3>
                <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                  開示中 <span className="font-medium" style={{ color: "#22d3ee" }}>{enabled.size}</span> / {categories.length} カテゴリ
                </p>
              </div>
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-1.5 rounded-md text-xs font-medium text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
                style={{ backgroundColor: "var(--brand-primary)" }}
              >
                {saving ? "保存中…" : "保存"}
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[80px_1fr_240px] gap-0 rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", minHeight: 480 }}>
            {/* Nav tabs */}
            <div className="border-r" style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}>
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => { setLevel(item.id); if (item.id === "md") { setMdFilter(null); setMajorFilter(null) } else if (item.id === "major") { setMajorFilter(null) } setSearchQ("") }}
                  className="w-full text-left px-3 py-3 text-xs font-medium border-b transition-colors"
                  style={{
                    borderColor: "var(--border)",
                    backgroundColor: level === item.id ? "var(--card)" : "transparent",
                    color: level === item.id ? "var(--brand-primary)" : "var(--muted-foreground)",
                    borderLeft: level === item.id ? "2px solid var(--brand-primary)" : "2px solid transparent",
                  }}
                >
                  {item.label}
                </button>
              ))}
              {/* Breadcrumb indicators */}
              {mdFilter && (
                <div className="px-2 py-2 border-t text-[10px]" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
                  <p className="truncate" title={mds.find((m) => m.code === mdFilter)?.name}>{mds.find((m) => m.code === mdFilter)?.name}</p>
                  {majorFilter && <p className="truncate mt-1" title={majors.find((m) => m.code === majorFilter)?.name}>{majors.find((m) => m.code === majorFilter)?.name}</p>}
                </div>
              )}
            </div>

            {/* List */}
            <div className="border-r" style={{ borderColor: "var(--border)" }}>
              <div className="px-4 py-2.5 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
                <span className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
                  {level === "md" ? "MD一覧" : level === "major" ? "大分類一覧" : "中分類一覧"}
                  <span className="ml-2 tabular-nums" style={{ color: "var(--foreground)" }}>
                    {level === "md" ? `${mds.length}件` : level === "major" ? `${majors.length}件` : `${visibleMiddles.length}件`}
                  </span>
                </span>
                {level === "middle" && acc && (
                  <div className="flex gap-1.5">
                    <button onClick={selectAllVisible} className="px-2 py-1 rounded border text-[10px] hover:opacity-80" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>表示中を全選択</button>
                    <button onClick={deselectAllVisible} className="px-2 py-1 rounded border text-[10px] hover:opacity-80" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>全解除</button>
                  </div>
                )}
              </div>

              {level === "middle" && (
                <div className="px-4 py-2 border-b" style={{ borderColor: "var(--border)" }}>
                  <input
                    placeholder="検索..."
                    value={searchQ}
                    onChange={(e) => setSearchQ(e.target.value)}
                    className="w-full h-7 rounded border px-2 text-xs outline-none"
                    style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                  />
                </div>
              )}

              <div className="max-h-[420px] overflow-y-auto">
                {!acc && (
                  <div className="px-4 py-12 text-center">
                    <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>アカウントを選択してください</p>
                  </div>
                )}

                {/* MD list */}
                {acc && level === "md" && mds.map((md) => {
                  const enabledCount = md.cats.filter((c) => enabled.has(c.middle_code)).length
                  return (
                    <button
                      key={md.code}
                      onClick={() => { setMdFilter(md.code); setMajorFilter(null); setLevel("major") }}
                      className="w-full text-left px-4 py-2.5 border-b transition-colors hover:opacity-80 flex items-center justify-between"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <span className="text-sm" style={{ color: "var(--foreground)" }}>{md.name}</span>
                      <span className="text-xs tabular-nums" style={{ color: enabledCount > 0 ? "#22d3ee" : "var(--muted-foreground)" }}>
                        {enabledCount}/{md.cats.length}
                      </span>
                    </button>
                  )
                })}

                {/* Major list */}
                {acc && level === "major" && majors.map((maj) => {
                  const enabledCount = maj.cats.filter((c) => enabled.has(c.middle_code)).length
                  return (
                    <button
                      key={maj.code}
                      onClick={() => { setMajorFilter(maj.code); setLevel("middle") }}
                      className="w-full text-left px-4 py-2.5 border-b transition-colors hover:opacity-80 flex items-center justify-between"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <span className="text-sm" style={{ color: "var(--foreground)" }}>{maj.name}</span>
                      <span className="text-xs tabular-nums" style={{ color: enabledCount > 0 ? "#22d3ee" : "var(--muted-foreground)" }}>
                        {enabledCount}/{maj.cats.length}
                      </span>
                    </button>
                  )
                })}

                {/* Middle list */}
                {acc && level === "middle" && visibleMiddles.map((c) => {
                  const active = enabled.has(c.middle_code)
                  return (
                    <button
                      key={c.middle_code}
                      onClick={() => toggle(c.middle_code)}
                      className="w-full text-left px-4 py-2 border-b transition-colors flex items-center gap-3"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <span
                        className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0"
                        style={active
                          ? { backgroundColor: "var(--brand-primary)", borderColor: "var(--brand-primary)" }
                          : { borderColor: "var(--border)" }
                        }
                      >
                        {active && <span className="text-white text-[10px]">✓</span>}
                      </span>
                      <span className="text-sm" style={{ color: active ? "var(--foreground)" : "var(--muted-foreground)" }}>{c.middle_name}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Selected panel */}
            <div>
              <div className="px-4 py-2.5 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
                <span className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>選択済み</span>
                <span className="text-xs tabular-nums font-medium" style={{ color: "#22d3ee" }}>{enabled.size}</span>
              </div>
              <div className="max-h-[440px] overflow-y-auto">
                {selectedCategories.length === 0 && (
                  <div className="px-4 py-12 text-center">
                    <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>カテゴリを選択してください</p>
                  </div>
                )}
                {selectedCategories.map((c) => (
                  <div
                    key={c.middle_code}
                    className="px-3 py-1.5 border-b flex items-center justify-between group"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <div className="min-w-0">
                      <p className="text-xs truncate" style={{ color: "var(--foreground)" }}>{c.middle_name}</p>
                      <p className="text-[10px] truncate" style={{ color: "var(--muted-foreground)" }}>{c.md_name} &gt; {c.major_name}</p>
                    </div>
                    <button
                      onClick={() => toggle(c.middle_code)}
                      className="text-xs opacity-0 group-hover:opacity-100 transition-opacity px-1 flex-shrink-0"
                      style={{ color: "#ef4444" }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ===== Credits =====
function CreditsTab({ accounts, credits }: { accounts: Account[]; credits: CreditMonth[] }) {
  const overLimit = accounts.filter((a) => a.credits_used >= a.credit_limit)
  const warn = accounts.filter((a) => a.credits_used >= a.credit_limit * 0.9 && a.credits_used < a.credit_limit)
  const trend = credits.map((c) => ({ usage_month: c.usage_month, total: c.compute_credits + c.storage_credits + c.serverless_credits }))

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <KpiCard label="総消費 (MTD)" value={compact(accounts.reduce((s, a) => s + a.credits_used, 0))} accent="#22d3ee" />
        <KpiCard label="上限超過" value={num(overLimit.length)} sub="即時対応が必要" accent={overLimit.length > 0 ? "#ef4444" : "#34d399"} />
        <KpiCard label="90%超過警告" value={num(warn.length)} sub="間もなく上限到達" accent={warn.length > 0 ? "#fbbf24" : "#34d399"} />
      </div>

      {(overLimit.length > 0 || warn.length > 0) && (
        <div className="space-y-2">
          {overLimit.map((a) => (
            <div key={a.account_id} className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm" style={{ backgroundColor: "rgba(239,68,68,0.08)", color: "#ef4444" }}>
              <span className="font-medium">{a.company_name}</span>
              <span className="ml-auto tabular-nums">{num(a.credits_used)} / {num(a.credit_limit)}</span>
            </div>
          ))}
          {warn.map((a) => (
            <div key={a.account_id} className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm" style={{ backgroundColor: "rgba(251,191,36,0.08)", color: "#fbbf24" }}>
              <span className="font-medium">{a.company_name}</span>
              <span className="ml-auto tabular-nums">{num(a.credits_used)} / {num(a.credit_limit)}</span>
            </div>
          ))}
        </div>
      )}

      <Panel title="月次クレジット推移">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={trend} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis dataKey="usage_month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v) => compact(v as number)} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => num(v)} />
            <Line type="monotone" dataKey="total" name="合計" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="アカウント別クレジット">
        <DataTable
          head={["企業名", "消費", "上限", "利用率"]}
          rows={[...accounts].sort((a, b) => b.credits_used - a.credits_used).map((a) => [
            a.company_name,
            num(a.credits_used),
            num(a.credit_limit),
            <ProgressCell key={a.account_id} value={(a.credits_used / a.credit_limit) * 100} />,
          ])}
          align={["left", "right", "right", "right"]}
        />
      </Panel>
    </div>
  )
}

// ===== Users =====
function UsersTab({ users }: { users: (AppUser & { COMPANY_NAME?: string })[] }) {
  const [q, setQ] = React.useState("")
  const saml = users.filter((u) => u.auth_method === "SAML/SSO").length
  const mfa = users.filter((u) => u.auth_method === "Password+MFA").length
  const activeUsers = users.filter((u) => u.status === "有効").length
  const filtered = users.filter((u) => (u.COMPANY_NAME ?? "").includes(q) || u.user_name.includes(q) || u.email.includes(q))

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="総ユーザー数" value={num(users.length)} />
        <KpiCard label="有効ユーザー" value={num(activeUsers)} sub={pct(users.length ? (100 * activeUsers) / users.length : 0)} accent="#34d399" />
        <KpiCard label="SAML/SSO" value={num(saml)} sub={pct(users.length ? (100 * saml) / users.length : 0)} accent="#3b82f6" />
        <KpiCard label="Password+MFA" value={num(mfa)} sub={pct(users.length ? (100 * mfa) / users.length : 0)} accent="#22d3ee" />
      </div>

      <Panel
        title={`ユーザー一覧（${filtered.length}件）`}
        actions={
          <input
            placeholder="検索…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-8 rounded-md border px-3 text-sm w-48 outline-none focus:ring-1"
            style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
          />
        }
      >
        <div className="max-h-[480px] overflow-y-auto">
          <DataTable
            head={["企業名", "氏名", "メール", "認証", "IdP", "最終ログイン", "状態"]}
            rows={filtered.map((u) => [
              u.COMPANY_NAME ?? "",
              <span key={u.user_id} className="font-medium">{u.user_name}</span>,
              <span key={`e-${u.user_id}`} className="text-xs" style={{ color: "var(--muted-foreground)" }}>{u.email}</span>,
              u.auth_method,
              u.idp,
              u.last_login,
              <Badge key={`s-${u.user_id}`} status={u.status} />,
            ])}
            align={["left", "left", "left", "left", "left", "left", "left"]}
          />
        </div>
      </Panel>
    </div>
  )
}
