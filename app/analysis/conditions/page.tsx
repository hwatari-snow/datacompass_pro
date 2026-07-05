"use client"
import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { HierarchySelector, type SelectorRow } from "@/components/selector"
import { cn } from "@/lib/utils"
import {
  defaultConditions,
  getCurrentConditions,
  setCurrentConditions,
  saveCondition,
  getSavedConditions,
  deleteSavedCondition,
  type SavedCondition,
} from "@/lib/conditions"
import type { AnalysisConditions, MemberFacets } from "@/lib/types"

const STEPS = ["期間", "店舗", "商品", "会員条件", "保存・確認"]
// 元HTMLモックのステップ色 (青/ティール/黄/橙/紫)
const STEP_COLORS = ["#4A90D9", "#5BC8AC", "#E6D72A", "#E8A87C", "#9B7ED8"]

function CheckGroup({ options, selected, onChange }: { options: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  const sel = new Set(selected)
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => {
            const next = new Set(sel)
            next.has(o) ? next.delete(o) : next.add(o)
            onChange(Array.from(next))
          }}
          className={cn(
            "px-3 py-1.5 rounded-full text-sm border transition-colors",
            sel.has(o) ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent",
          )}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

export default function ConditionsPage() {
  const router = useRouter()
  const [step, setStep] = React.useState(0)
  const [c, setC] = React.useState<AnalysisConditions>(defaultConditions())
  const [stores, setStores] = React.useState<SelectorRow[]>([])
  const [hierarchy, setHierarchy] = React.useState<{
    md: { code: string; name: string }[]
    major: { code: string; name: string; md_code: string }[]
    middle: { code: string; name: string; major_code: string }[]
    minor: { code: string; name: string; middle_code: string }[]
    makers: { code: string; name: string }[]
  }>({ md: [], major: [], middle: [], minor: [], makers: [] })
  const [facets, setFacets] = React.useState<MemberFacets>({ genders: [], age_groups: [], ranks: [] })
  const [saved, setSaved] = React.useState<SavedCondition[]>([])
  const [saveName, setSaveName] = React.useState("")
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    setC(getCurrentConditions())
    setSaved(getSavedConditions())
    Promise.all([
      fetch("/api/masters/stores").then((r) => r.json()),
      fetch("/api/masters/products").then((r) => r.json()),
      fetch("/api/masters/members").then((r) => r.json()),
    ])
      .then(([s, p, f]) => {
        if (Array.isArray(s)) setStores(s)
        if (p && !p.error) setHierarchy(p)
        if (f && !f.error) setFacets(f)
      })
      .finally(() => setLoading(false))
  }, [])

  const upd = (patch: Partial<AnalysisConditions>) => setC((prev) => ({ ...prev, ...patch }))
  const updMember = (patch: Partial<AnalysisConditions["member"]>) => setC((prev) => ({ ...prev, member: { ...prev.member, ...patch } }))

  const runAnalysis = () => {
    setCurrentConditions(c)
    router.push("/analysis/abc")
  }
  const doSave = () => {
    if (!saveName.trim()) return
    setSaved(saveCondition(saveName.trim(), c))
    setSaveName("")
  }
  const loadSaved = (s: SavedCondition) => {
    setC(s.conditions)
    setStep(0)
  }

  return (
    <main className="w-full max-w-6xl mx-auto py-8 px-4">
      <h1 className="text-xl font-semibold mb-1">分析条件設定</h1>
      <p className="text-sm text-muted-foreground mb-6">期間・店舗・商品・会員条件を設定してID-POS ABC分析を実行します。</p>

      {/* ステップインジケーター (元モックの色を踏襲) */}
      <div className="flex items-center mb-8">
        {STEPS.map((s, i) => {
          const color = STEP_COLORS[i]
          const isActive = i === step
          const isDone = i < step
          const dotStyle: React.CSSProperties = isDone
            ? { background: color, borderColor: color, color: "#fff" }
            : isActive
              ? { borderColor: color, color, background: `${color}1a` }
              : {}
          return (
            <React.Fragment key={s}>
              <button type="button" onClick={() => setStep(i)} className="flex flex-col items-center gap-1 shrink-0">
                <span
                  style={dotStyle}
                  className={cn(
                    "w-9 h-9 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-all",
                    !isActive && !isDone && "border-[#d0d5dd] text-muted-foreground bg-white",
                  )}
                >
                  {i + 1}
                </span>
                <span className={cn("text-xs", isActive ? "text-foreground font-medium" : "text-muted-foreground")}>{s}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className="flex-1 h-0.5 mx-2 transition-colors" style={{ background: isDone ? color : "#d0d5dd" }} />
              )}
            </React.Fragment>
          )
        })}
      </div>

      <Card>
        <CardContent className="pt-6 min-h-[360px]">
          {loading && <p className="text-sm text-muted-foreground">マスタ読み込み中…</p>}

          {/* Step 1: 期間 */}
          {step === 0 && (
            <div className="space-y-6 max-w-xl">
              <div>
                <label className="text-sm font-medium">基準期間</label>
                <div className="flex items-center gap-2 mt-2">
                  <Input type="date" value={c.baseStart} onChange={(e) => upd({ baseStart: e.target.value })} />
                  <span className="text-muted-foreground">〜</span>
                  <Input type="date" value={c.baseEnd} onChange={(e) => upd({ baseEnd: e.target.value })} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={c.compareEnabled}
                  onChange={(e) =>
                    upd({
                      compareEnabled: e.target.checked,
                      compareStart: e.target.checked ? c.compareStart ?? "2025-08-01" : null,
                      compareEnd: e.target.checked ? c.compareEnd ?? "2025-10-31" : null,
                    })
                  }
                />
                比較期間を設定する（前期比を表示）
              </label>
              {c.compareEnabled && (
                <div className="flex items-center gap-2">
                  <Input type="date" value={c.compareStart ?? ""} onChange={(e) => upd({ compareStart: e.target.value })} />
                  <span className="text-muted-foreground">〜</span>
                  <Input type="date" value={c.compareEnd ?? ""} onChange={(e) => upd({ compareEnd: e.target.value })} />
                </div>
              )}
            </div>
          )}

          {/* Step 2: 店舗 */}
          {step === 1 && (
            <HierarchySelector
              rows={stores}
              idField="store_code"
              labelField="store_name"
              groupFields={[
                { key: "corporation_name", label: "法人" },
                { key: "business_type_name", label: "業態" },
                { key: "area_name", label: "エリア" },
                { key: "prefecture_name", label: "都道府県" },
              ]}
              selected={c.storeCodes}
              onChange={(codes) => upd({ storeCodes: codes })}
            />
          )}

          {/* Step 3: 商品カテゴリ */}
          {step === 2 && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">カテゴリを選択して商品を絞り込みます。未選択＝全体が対象です。</p>

              {/* MDコード */}
              <div>
                <p className="text-sm font-medium mb-2">MDコード</p>
                <CheckGroup
                  options={hierarchy.md.map(m => m.name)}
                  selected={c.mdCodes.map(code => hierarchy.md.find(m => m.code === code)?.name ?? code)}
                  onChange={(names) => upd({ mdCodes: names.map(n => hierarchy.md.find(m => m.name === n)?.code ?? n) })}
                />
              </div>

              {/* 大分類 */}
              <div>
                <p className="text-sm font-medium mb-2">大分類</p>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                  {(c.mdCodes.length > 0
                    ? hierarchy.major.filter(m => c.mdCodes.includes(m.md_code))
                    : hierarchy.major
                  ).map((item) => (
                    <button
                      key={item.code}
                      type="button"
                      onClick={() => {
                        const next = c.majorCodes.includes(item.code)
                          ? c.majorCodes.filter(x => x !== item.code)
                          : [...c.majorCodes, item.code]
                        upd({ majorCodes: next })
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-sm border transition-colors",
                        c.majorCodes.includes(item.code) ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent",
                      )}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* 中分類 */}
              <div>
                <p className="text-sm font-medium mb-2">中分類</p>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                  {(c.majorCodes.length > 0
                    ? hierarchy.middle.filter(m => c.majorCodes.includes(m.major_code))
                    : hierarchy.middle.slice(0, 50)
                  ).map((item) => (
                    <button
                      key={item.code}
                      type="button"
                      onClick={() => {
                        const next = c.middleCodes.includes(item.code)
                          ? c.middleCodes.filter(x => x !== item.code)
                          : [...c.middleCodes, item.code]
                        upd({ middleCodes: next })
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs border transition-colors",
                        c.middleCodes.includes(item.code) ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent",
                      )}
                    >
                      {item.name}
                    </button>
                  ))}
                  {c.majorCodes.length === 0 && hierarchy.middle.length > 50 && (
                    <span className="text-xs text-muted-foreground self-center">大分類を選択すると絞り込めます</span>
                  )}
                </div>
              </div>

              {/* 小分類 */}
              <div>
                <p className="text-sm font-medium mb-2">小分類</p>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                  {(c.middleCodes.length > 0
                    ? hierarchy.minor.filter(m => c.middleCodes.includes(m.middle_code))
                    : []
                  ).map((item) => (
                    <button
                      key={item.code}
                      type="button"
                      onClick={() => {
                        const next = c.minorCodes.includes(item.code)
                          ? c.minorCodes.filter(x => x !== item.code)
                          : [...c.minorCodes, item.code]
                        upd({ minorCodes: next })
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs border transition-colors",
                        c.minorCodes.includes(item.code) ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent",
                      )}
                    >
                      {item.name}
                    </button>
                  ))}
                  {c.middleCodes.length === 0 && (
                    <span className="text-xs text-muted-foreground">中分類を選択すると表示されます</span>
                  )}
                </div>
              </div>

              {/* メーカー */}
              <div>
                <p className="text-sm font-medium mb-2">メーカー</p>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                  {hierarchy.makers.slice(0, 100).map((item) => (
                    <button
                      key={item.code}
                      type="button"
                      onClick={() => {
                        const next = c.makerCodes.includes(item.code)
                          ? c.makerCodes.filter(x => x !== item.code)
                          : [...c.makerCodes, item.code]
                        upd({ makerCodes: next })
                      }}
                      className={cn(
                        "px-2.5 py-1 rounded-full text-xs border transition-colors",
                        c.makerCodes.includes(item.code) ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent",
                      )}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* JANコード直接入力 */}
              <div>
                <p className="text-sm font-medium mb-2">JANコード（個別商品指定）</p>
                <p className="text-xs text-muted-foreground mb-2">カンマまたは改行区切りで入力してください（例: 4901234567890, 4901234567891）</p>
                <textarea
                  className="w-full h-24 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="4901234567890&#10;4901234567891"
                  value={c.itemCodes.join("\n")}
                  onChange={(e) => {
                    const codes = e.target.value
                      .split(/[,\n\s]+/)
                      .map(s => s.trim())
                      .filter(s => s.length > 0)
                    upd({ itemCodes: codes })
                  }}
                />
                {c.itemCodes.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">{c.itemCodes.length}件のJANコードが指定されています</p>
                )}
              </div>
            </div>
          )}

          {/* Step 4: 会員条件 */}
          {step === 3 && (
            <div className="space-y-6">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={c.member.enabled} onChange={(e) => updMember({ enabled: e.target.checked })} />
                会員条件で絞り込む（ID-POS）
              </label>
              {!c.member.enabled && (
                <p className="text-sm text-muted-foreground">未設定の場合は全会員＋非会員が対象です。</p>
              )}
              {c.member.enabled && (
                <div className="space-y-5">
                  <div>
                    <p className="text-sm font-medium mb-2">性別</p>
                    <CheckGroup options={facets.genders} selected={c.member.genders} onChange={(v) => updMember({ genders: v })} />
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">年代</p>
                    <CheckGroup options={facets.age_groups} selected={c.member.ageGroups} onChange={(v) => updMember({ ageGroups: v })} />
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">会員ランク</p>
                    <CheckGroup options={facets.ranks} selected={c.member.ranks} onChange={(v) => updMember({ ranks: v })} />
                  </div>
                  <div className="flex flex-wrap gap-6">
                    <div>
                      <p className="text-sm font-medium mb-2">最低購入回数</p>
                      <Input
                        type="number"
                        min={0}
                        className="w-36"
                        value={c.member.minPurchaseCount ?? ""}
                        onChange={(e) => updMember({ minPurchaseCount: e.target.value ? Number(e.target.value) : null })}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-2">最低購入金額（円）</p>
                      <Input
                        type="number"
                        min={0}
                        className="w-44"
                        value={c.member.minPurchaseAmount ?? ""}
                        onChange={(e) => updMember({ minPurchaseAmount: e.target.value ? Number(e.target.value) : null })}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 5: 保存・確認 */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <Summary label="基準期間" value={`${c.baseStart} 〜 ${c.baseEnd}`} />
                <Summary label="比較期間" value={c.compareEnabled ? `${c.compareStart} 〜 ${c.compareEnd}` : "なし"} />
                <Summary label="店舗" value={c.storeCodes.length ? `${c.storeCodes.length}店舗` : "全店舗"} />
                <Summary label="商品" value={
                  [
                    c.mdCodes.length ? `MD: ${c.mdCodes.length}件` : "",
                    c.majorCodes.length ? `大分類: ${c.majorCodes.length}件` : "",
                    c.middleCodes.length ? `中分類: ${c.middleCodes.length}件` : "",
                    c.minorCodes.length ? `小分類: ${c.minorCodes.length}件` : "",
                    c.makerCodes.length ? `メーカー: ${c.makerCodes.length}件` : "",
                    c.itemCodes.length ? `個別: ${c.itemCodes.length}件` : "",
                  ].filter(Boolean).join(" / ") || "全商品"
                } />
                <Summary
                  label="会員条件"
                  value={
                    c.member.enabled
                      ? [
                          c.member.genders.join("・"),
                          c.member.ageGroups.join("・"),
                          c.member.ranks.join("・"),
                          c.member.minPurchaseCount ? `${c.member.minPurchaseCount}回以上` : "",
                          c.member.minPurchaseAmount ? `${c.member.minPurchaseAmount}円以上` : "",
                        ]
                          .filter(Boolean)
                          .join(" / ") || "属性指定なし"
                      : "なし（全会員＋非会員）"
                  }
                />
              </div>
              <div className="flex items-center gap-2 border-t pt-4">
                <Input placeholder="条件名を入力して保存" value={saveName} onChange={(e) => setSaveName(e.target.value)} className="max-w-xs" />
                <Button variant="outline" onClick={doSave} disabled={!saveName.trim()}>
                  保存
                </Button>
              </div>
              {saved.length > 0 && (
                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-2">保存済み条件</p>
                  <div className="flex flex-col gap-1">
                    {saved.map((s) => (
                      <div key={s.id} className="flex items-center gap-2 text-sm bg-muted/40 rounded px-3 py-1.5">
                        <span className="flex-1">{s.name}</span>
                        <button className="text-primary hover:underline text-xs" onClick={() => loadSaved(s)}>
                          読込
                        </button>
                        <button className="text-destructive hover:underline text-xs" onClick={() => setSaved(deleteSavedCondition(s.id))}>
                          削除
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ナビゲーション */}
      <div className="flex items-center justify-between mt-6">
        <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          戻る
        </Button>
        <div className="flex items-center gap-3">
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>次へ</Button>
          ) : (
            <Button onClick={runAnalysis}>
              この条件でABC分析を実行
            </Button>
          )}
        </div>
      </div>
    </main>
  )
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/40 rounded-lg px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium mt-0.5">{value}</p>
    </div>
  )
}
