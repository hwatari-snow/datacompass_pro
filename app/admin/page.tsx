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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { num, pct, compact } from "@/lib/format"
import type { Account, AppUser, CreditMonth } from "@/lib/types"

const PIE_COLORS = ["#2b6cb0", "#5BC8AC", "#E6D72A", "#cbd5e1"]

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  )
}

interface Category { middle_code: string; middle_name: string; major_name: string }

export default function SettingsPage() {
  const [accounts, setAccounts] = React.useState<Account[]>([])
  const [users, setUsers] = React.useState<(AppUser & { COMPANY_NAME?: string })[]>([])
  const [credits, setCredits] = React.useState<CreditMonth[]>([])
  const [loading, setLoading] = React.useState(true)

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

  return (
    <main className="w-full max-w-7xl mx-auto py-8 px-4">
      <h1 className="text-xl font-semibold mb-1">DataCompass 管理コンソール</h1>
      <p className="text-sm text-muted-foreground mb-6">アカウント・データ開示・クレジット・ユーザーを管理します。</p>

      {loading ? (
        <p className="text-sm text-muted-foreground">読み込み中…</p>
      ) : (
        <Tabs defaultValue="dashboard">
          <TabsList className="mb-6 flex-wrap">
            <TabsTrigger value="dashboard">ダッシュボード</TabsTrigger>
            <TabsTrigger value="accounts">アカウント管理</TabsTrigger>
            <TabsTrigger value="disclosure">データ開示制御</TabsTrigger>
            <TabsTrigger value="credits">クレジット監視</TabsTrigger>
            <TabsTrigger value="users">ユーザー管理</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <DashboardTab accounts={accounts} users={users} credits={credits} />
          </TabsContent>
          <TabsContent value="accounts">
            <AccountsTab accounts={accounts} />
          </TabsContent>
          <TabsContent value="disclosure">
            <DisclosureTab accounts={accounts} />
          </TabsContent>
          <TabsContent value="credits">
            <CreditsTab accounts={accounts} credits={credits} />
          </TabsContent>
          <TabsContent value="users">
            <UsersTab users={users} />
          </TabsContent>
        </Tabs>
      )}
    </main>
  )
}

// ---- 正規化 (Snowflakeは大文字キー) ----
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

// ===== ダッシュボード =====
function DashboardTab({ accounts, users, credits }: { accounts: Account[]; users: (AppUser & { COMPANY_NAME?: string })[]; credits: CreditMonth[] }) {
  const active = accounts.filter((a) => a.status === "稼働中").length
  const overLimit = accounts.filter((a) => a.credits_used >= a.credit_limit).length
  const thisMonth = credits[credits.length - 1]
  const monthTotal = thisMonth ? thisMonth.compute_credits + thisMonth.storage_credits + thisMonth.serverless_credits : 0
  const statusData = ["稼働中", "停止中", "承認待ち"].map((s) => ({ name: s, value: accounts.filter((a) => a.status === s).length }))
  const top = [...accounts].sort((a, b) => b.credits_used - a.credits_used).slice(0, 10)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard label="総アカウント数" value={num(accounts.length)} />
        <KpiCard label="稼働中" value={num(active)} sub={`${pct(accounts.length ? (100 * active) / accounts.length : 0)}`} />
        <KpiCard label="総ユーザー数" value={num(users.length)} />
        <KpiCard label="今月クレジット" value={compact(monthTotal)} />
        <KpiCard label="上限超過" value={num(overLimit)} sub="アカウント" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">月次クレジット消費</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={credits}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="usage_month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => compact(v as number)} />
                <Tooltip formatter={(v: number) => num(v)} />
                <Legend />
                <Bar dataKey="compute_credits" name="Compute" stackId="a" fill="#2b6cb0" />
                <Bar dataKey="storage_credits" name="Storage" stackId="a" fill="#5BC8AC" />
                <Bar dataKey="serverless_credits" name="Serverless" stackId="a" fill="#E6D72A" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">アカウント状態</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90}>
                  {statusData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">クレジット消費 上位10アカウント</CardTitle></CardHeader>
        <CardContent>
          <SimpleTable
            head={["企業名", "業種", "消費", "上限", "利用率"]}
            rows={top.map((a) => [a.company_name, a.industry, num(a.credits_used), num(a.credit_limit), pct((100 * a.credits_used) / a.credit_limit)])}
            align={["left", "left", "right", "right", "right"]}
          />
        </CardContent>
      </Card>
    </div>
  )
}

// ===== アカウント管理 =====
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
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0 flex-wrap">
        <CardTitle className="text-base flex-1">アカウント一覧（{filtered.length}）</CardTitle>
        <Input placeholder="企業名・アカウント検索" value={q} onChange={(e) => { setQ(e.target.value); setPage(0) }} className="w-56" />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0) }} className="h-9 rounded-md border bg-background px-2 text-sm">
          <option value="ALL">全ステータス</option>
          <option value="稼働中">稼働中</option>
          <option value="停止中">停止中</option>
          <option value="承認待ち">承認待ち</option>
        </select>
      </CardHeader>
      <CardContent>
        <SimpleTable
          head={["企業名", "アカウント", "業種", "地域", "ユーザー", "カテゴリ", "店舗", "Ver", "認証", "ステータス"]}
          rows={view.map((a) => [a.company_name, a.account_name, a.industry, a.prefecture, num(a.user_count), num(a.category_count), num(a.store_count), a.app_version, a.auth_method, <StatusBadge key={a.account_id} status={a.status} />])}
          align={["left", "left", "left", "left", "right", "right", "right", "left", "left", "left"]}
        />
        {pages > 1 && (
          <div className="flex items-center justify-end gap-2 mt-4">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>前へ</Button>
            <span className="text-sm text-muted-foreground">{page + 1} / {pages}</span>
            <Button variant="outline" size="sm" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>次へ</Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ===== データ開示制御 =====
function DisclosureTab({ accounts }: { accounts: Account[] }) {
  const [selected, setSelected] = React.useState<string | null>(null)
  const [categories, setCategories] = React.useState<Category[]>([])
  const [enabled, setEnabled] = React.useState<Set<string>>(new Set())
  const [q, setQ] = React.useState("")

  React.useEffect(() => {
    if (!selected) return
    fetch(`/api/admin/disclosure?account=${encodeURIComponent(selected)}`)
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
  const acc = accounts.find((a) => a.account_id === selected)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
      <Card>
        <CardHeader><CardTitle className="text-base">アカウント</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="px-3 pb-2"><Input placeholder="検索" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="max-h-[480px] overflow-y-auto divide-y">
            {accounts.filter((a) => a.company_name.includes(q)).map((a) => (
              <button
                key={a.account_id}
                onClick={() => setSelected(a.account_id)}
                className={cn("w-full text-left px-4 py-2.5 hover:bg-accent", selected === a.account_id && "bg-accent")}
              >
                <p className="text-sm font-medium">{a.company_name}</p>
                <p className="text-xs text-muted-foreground">{a.industry}・カテゴリ{a.category_count}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{acc ? `${acc.company_name} のカテゴリ開示設定` : "アカウントを選択"}</CardTitle>
          {acc && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEnabled(new Set(categories.map((c) => c.middle_code)))}>全て開示</Button>
              <Button variant="outline" size="sm" onClick={() => setEnabled(new Set())}>全て非開示</Button>
              <Button size="sm" onClick={() => alert(`${acc.company_name}: ${enabled.size}カテゴリを保存しました（デモ）`)}>保存</Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {!acc && <p className="text-sm text-muted-foreground">左のアカウントを選択すると開示カテゴリを設定できます。</p>}
          {acc && (
            <>
              <p className="text-sm text-muted-foreground mb-3">開示中 {enabled.size} / {categories.length} カテゴリ</p>
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => (
                  <button
                    key={c.middle_code}
                    onClick={() => toggle(c.middle_code)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-sm border transition-colors",
                      enabled.has(c.middle_code) ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent text-muted-foreground",
                    )}
                    title={c.major_name}
                  >
                    {c.middle_name}
                  </button>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ===== クレジット監視 =====
function CreditsTab({ accounts, credits }: { accounts: Account[]; credits: CreditMonth[] }) {
  const overLimit = accounts.filter((a) => a.credits_used >= a.credit_limit)
  const warn = accounts.filter((a) => a.credits_used >= a.credit_limit * 0.9 && a.credits_used < a.credit_limit)
  const trend = credits.map((c) => ({ usage_month: c.usage_month, total: c.compute_credits + c.storage_credits + c.serverless_credits }))
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard label="総消費 (MTD)" value={compact(accounts.reduce((s, a) => s + a.credits_used, 0))} />
        <KpiCard label="上限超過" value={num(overLimit.length)} sub="アカウント" />
        <KpiCard label="90%超過警告" value={num(warn.length)} sub="アカウント" />
      </div>
      {(overLimit.length > 0 || warn.length > 0) && (
        <div className="space-y-2">
          {overLimit.map((a) => (
            <div key={a.account_id} className="bg-destructive/10 text-destructive text-sm rounded-md px-4 py-2">
              ⚠ {a.company_name}: クレジット上限超過（{num(a.credits_used)} / {num(a.credit_limit)}）
            </div>
          ))}
          {warn.map((a) => (
            <div key={a.account_id} className="bg-amber-500/10 text-amber-700 text-sm rounded-md px-4 py-2">
              {a.company_name}: 上限90%超過（{num(a.credits_used)} / {num(a.credit_limit)}）
            </div>
          ))}
        </div>
      )}
      <Card>
        <CardHeader><CardTitle className="text-base">月次クレジット推移</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="usage_month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => compact(v as number)} />
              <Tooltip formatter={(v: number) => num(v)} />
              <Line type="monotone" dataKey="total" name="合計クレジット" stroke="#2b6cb0" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">アカウント別クレジット</CardTitle></CardHeader>
        <CardContent>
          <SimpleTable
            head={["企業名", "消費", "上限", "利用率"]}
            rows={[...accounts].sort((a, b) => b.credits_used - a.credits_used).map((a) => [a.company_name, num(a.credits_used), num(a.credit_limit), pct((100 * a.credits_used) / a.credit_limit)])}
            align={["left", "right", "right", "right"]}
          />
        </CardContent>
      </Card>
    </div>
  )
}

// ===== ユーザー管理 =====
function UsersTab({ users }: { users: (AppUser & { COMPANY_NAME?: string })[] }) {
  const [q, setQ] = React.useState("")
  const saml = users.filter((u) => u.auth_method === "SAML/SSO").length
  const mfa = users.filter((u) => u.auth_method === "Password+MFA").length
  const filtered = users.filter((u) => (u.COMPANY_NAME ?? "").includes(q) || u.user_name.includes(q) || u.email.includes(q))
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="総ユーザー数" value={num(users.length)} />
        <KpiCard label="SAML/SSO" value={num(saml)} />
        <KpiCard label="Password+MFA" value={num(mfa)} />
        <KpiCard label="有効ユーザー" value={num(users.filter((u) => u.status === "有効").length)} />
      </div>
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">ユーザー一覧（{filtered.length}）</CardTitle>
          <Input placeholder="検索" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
        </CardHeader>
        <CardContent>
          <div className="max-h-[520px] overflow-y-auto">
            <SimpleTable
              head={["企業名", "氏名", "メール", "認証方式", "IdP", "最終ログイン", "状態"]}
              rows={filtered.map((u) => [u.COMPANY_NAME ?? "", u.user_name, u.email, u.auth_method, u.idp, u.last_login, <StatusBadge key={u.user_id} status={u.status} />])}
              align={["left", "left", "left", "left", "left", "left", "left"]}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ---- 共通 ----
function StatusBadge({ status }: { status: string }) {
  const color =
    status === "稼働中" || status === "有効" ? "bg-emerald-100 text-emerald-700" :
    status === "停止中" || status === "無効" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
  return <span className={cn("px-2 py-0.5 rounded text-xs font-medium", color)}>{status}</span>
}

function SimpleTable({ head, rows, align }: { head: string[]; rows: React.ReactNode[][]; align: ("left" | "right")[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b">
          <tr className="text-muted-foreground">
            {head.map((h, i) => (
              <th key={i} className={cn("py-2 px-3", align[i] === "right" ? "text-right" : "text-left")}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-b last:border-0 hover:bg-accent/40">
              {r.map((cell, ci) => (
                <td key={ci} className={cn("py-1.5 px-3", align[ci] === "right" ? "text-right tabular-nums" : "text-left")}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
