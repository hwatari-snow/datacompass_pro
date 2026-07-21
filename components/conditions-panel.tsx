"use client"
import * as React from "react"
import s from "@/app/analysis/conditions/conditions.module.css"
import { useConditions } from "@/components/conditions-context"
import { DateField } from "@/components/date-field"
import {
  defaultConditions,
  getCurrentConditions,
  saveCondition,
  getSavedConditions,
  deleteSavedCondition,
  type SavedCondition,
} from "@/lib/conditions"
import type { AnalysisConditions, MemberFacets } from "@/lib/types"
import type { SelectorRow } from "@/components/selector"
import { STEP_COLORS, PALETTE } from "@/lib/palette"

const STEPS = [
  { label: "期間", color: STEP_COLORS[0] },
  { label: "店舗", color: STEP_COLORS[1] },
  { label: "商品", color: STEP_COLORS[2] },
  { label: "会員条件", color: STEP_COLORS[3] },
  { label: "保存・確認", color: STEP_COLORS[4] },
]

const STORE_MODES = [
  { key: "corporation_name", label: "法人" },
  { key: "business_type_name", label: "業態" },
  { key: "area_name", label: "エリア" },
  { key: "prefecture_name", label: "都道府県" },
  { key: "store_code", label: "店舗" },
] as const

const PRODUCT_MODES = [
  { key: "md", label: "MD" },
  { key: "major", label: "大分類" },
  { key: "middle", label: "中分類" },
  { key: "minor", label: "小分類" },
  { key: "sub", label: "細分類" },
  { key: "jan", label: "JAN" },
] as const

interface ConditionsPanelProps {
  open: boolean
  onClose: () => void
}

export function ConditionsPanel({ open, onClose }: ConditionsPanelProps) {
  const { setConditions } = useConditions()
  const [openSection, setOpenSection] = React.useState(1)
  const [cond, setCond] = React.useState<AnalysisConditions>(defaultConditions())
  const [stores, setStores] = React.useState<SelectorRow[]>([])
  const [hierarchy, setHierarchy] = React.useState<{
    md: { code: string; name: string }[]
    major: { code: string; name: string; md_code: string; item_count: number }[]
    middle: { code: string; name: string; major_code: string; item_count: number }[]
    minor: { code: string; name: string; middle_code: string; item_count: number }[]
    sub: { code: string; name: string; minor_code: string; item_count: number }[]
    totalItems: number
  }>({ md: [], major: [], middle: [], minor: [], sub: [], totalItems: 0 })
  const [facets, setFacets] = React.useState<MemberFacets>({ genders: [], age_groups: [], ranks: [] })
  const [saved, setSaved] = React.useState<SavedCondition[]>([])
  const [saveName, setSaveName] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const mastersLoaded = React.useRef(false)

  // Load masters only once when panel first opens
  React.useEffect(() => {
    if (!open || mastersLoaded.current) return
    mastersLoaded.current = true
    setLoading(true)
    setCond(getCurrentConditions())
    setSaved(getSavedConditions())
    Promise.all([
      fetch("/api/masters/stores").then((r) => r.json()),
      fetch("/api/masters/products").then((r) => r.json()),
      fetch("/api/masters/members").then((r) => r.json()),
    ])
      .then(([st, p, f]) => {
        if (Array.isArray(st)) setStores(st)
        if (p && !p.error) setHierarchy({ ...p, totalItems: p.totalItems ?? 0 })
        if (f && !f.error) setFacets(f)
      })
      .finally(() => setLoading(false))
  }, [open])

  // Sync conditions from context when panel opens (after masters loaded)
  React.useEffect(() => {
    if (open && mastersLoaded.current) {
      setCond(getCurrentConditions())
      setSaved(getSavedConditions())
    }
  }, [open])

  const upd = (patch: Partial<AnalysisConditions>) => setCond((prev) => ({ ...prev, ...patch }))
  const updMember = (patch: Partial<AnalysisConditions["member"]>) => setCond((prev) => ({ ...prev, member: { ...prev.member, ...patch } }))
  const updMdCodes = (codes: string[]) => upd({ mdCodes: codes, majorCodes: [], middleCodes: [], minorCodes: [], subCodes: [] })
  const updMajorCodes = (codes: string[]) => upd({ majorCodes: codes, middleCodes: [], minorCodes: [], subCodes: [] })
  const updMiddleCodes = (codes: string[]) => upd({ middleCodes: codes, minorCodes: [], subCodes: [] })
  const updMinorCodes = (codes: string[]) => upd({ minorCodes: codes, subCodes: [] })

  const toggle = (sec: number) => setOpenSection(openSection === sec ? 0 : sec)

  const dateOk = !!(cond.baseStart && cond.baseEnd)
  const storeOk = cond.storeCodes.length > 0
  const prodOk = cond.mdCodes.length > 0 || cond.majorCodes.length > 0 || cond.middleCodes.length > 0 || cond.minorCodes.length > 0 || cond.subCodes.length > 0 || cond.itemCodes.length > 0
  const dateSummary = dateOk ? `${cond.baseStart} 〜 ${cond.baseEnd}${cond.compareEnabled ? " (比較あり)" : ""}` : "未設定"
  const storeSummary = storeOk ? `${cond.storeCodes.length}店舗` : "全店舗"
  const prodSummary = prodOk ? [
    cond.majorCodes.length && `大分類${cond.majorCodes.length}`,
    cond.middleCodes.length && `中分類${cond.middleCodes.length}`,
    cond.minorCodes.length && `小分類${cond.minorCodes.length}`,
    cond.subCodes.length && `細分類${cond.subCodes.length}`,
    cond.itemCodes.length && `JAN${cond.itemCodes.length}`,
  ].filter(Boolean).join(" / ") : "全商品"
  const memberSummary = cond.member.enabled ? `${[cond.member.genders.length && "性別", cond.member.ageGroups.length && "年代", cond.member.ranks.length && "ランク"].filter(Boolean).length || 0}条件` : "条件なし"

  const applyConditions = () => {
    const enriched = {
      ...cond,
      mdNames: hierarchy.md.filter((m) => cond.mdCodes.includes(m.code)).map((m) => m.name),
      majorNames: hierarchy.major.filter((m) => cond.majorCodes.includes(m.code)).map((m) => m.name),
      middleNames: hierarchy.middle.filter((m) => cond.middleCodes.includes(m.code)).map((m) => m.name),
      minorNames: hierarchy.minor.filter((m) => cond.minorCodes.includes(m.code)).map((m) => m.name),
      subNames: hierarchy.sub.filter((m) => cond.subCodes.includes(m.code)).map((m) => m.name),
      storeNames: stores.filter((st) => cond.storeCodes.includes(st.code)).map((st) => st.name),
    }
    setConditions(enriched)
    onClose()
  }
  const doSave = () => { if (!saveName.trim()) return; setSaved(saveCondition(saveName.trim(), cond)); setSaveName("") }
  const resetAll = () => setCond(defaultConditions())

  return (
    <>
      {/* Backdrop */}
      <div
        className={`absolute inset-0 z-40 bg-black/30 backdrop-blur-[2px] transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className={`absolute inset-x-0 z-50 overflow-y-auto overflow-x-visible shadow-2xl transition-all duration-300 ${open ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"}`}
        style={{ top: 0, maxHeight: "85vh", borderBottom: "2px solid var(--border)", borderRadius: "0 0 16px 16px", backgroundColor: "var(--card)" }}
      >
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>マスタ読み込み中...</div>
        ) : (
          <div style={{ maxWidth: 1400, margin: "0 auto", padding: "20px 24px" }}>
            {/* Step Indicator */}
            <div className={s.stepIndicator}>
              {STEPS.map((st, i) => {
                const sec = i + 1
                const isActive = openSection === sec
                const isDone = (sec === 1 && dateOk) || (sec === 2 && storeOk) || (sec === 3 && prodOk) || (sec === 4 && cond.member.enabled) || (sec === 5 && saved.length > 0)
                const cls = isActive ? s[`active${sec}`] : isDone && openSection !== sec ? s[`done${sec}`] : ""
                return (
                  <React.Fragment key={st.label}>
                    <div className={s.stepGroup}>
                      <div className={`${s.stepDot} ${cls}`} onClick={() => toggle(sec)}>
                        {isDone && !isActive ? "✓" : sec}
                      </div>
                      <span className={s.stepLabel}>{st.label}</span>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className={`${s.stepLine} ${isDone ? s[`done${sec}`] : ""}`} />
                    )}
                  </React.Fragment>
                )
              })}
            </div>

            <div style={{ textAlign: "right", marginBottom: 8 }}>
              <button className={s.resetBtn} onClick={resetAll}>クリア</button>
            </div>

            {/* Section 1: 期間 */}
            <div className={`${s.section} ${openSection === 1 ? s.activeSection1 : ""}`}>
              <div className={s.sectionHeader} onClick={() => toggle(1)}>
                <div className={`${s.sectionNum} ${s.num1}`}>1</div>
                <div className={s.sectionTitle}>期間選択</div>
                <div className={s.sectionSummary}>{dateSummary}</div>
                <div className={`${s.sectionChevron} ${openSection === 1 ? s.open : ""}`}>▼</div>
              </div>
              {openSection === 1 && (
                <div className={s.sectionBody}>
                  <div className={s.dateSectionBody}>
                    <div className={s.dateRangeRow}>
                      <span className={s.dateRangeLabel}>基準期間：</span>
                      <DateField value={cond.baseStart} onChange={(v) => upd({ baseStart: v })} min="2023-05-01" max="2026-05-31" />
                      <span className={s.separator}>〜</span>
                      <DateField value={cond.baseEnd} onChange={(v) => upd({ baseEnd: v })} min="2023-05-01" max="2026-05-31" />
                    </div>
                    <div className={`${s.dateRangeRow} ${!cond.compareEnabled ? s.compDisabled : ""}`}>
                      <span className={s.dateRangeLabel} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className={s.toggleSwitch}>
                          <input type="checkbox" checked={cond.compareEnabled} onChange={(e) => upd({ compareEnabled: e.target.checked, compareStart: e.target.checked ? cond.compareStart ?? "2025-08-01" : null, compareEnd: e.target.checked ? cond.compareEnd ?? "2025-10-31" : null })} />
                          <span className={s.toggleSlider} />
                        </span>
                        比較期間：
                      </span>
                      <DateField value={cond.compareStart ?? ""} onChange={(v) => upd({ compareStart: v })} min="2023-05-01" max="2026-05-31" disabled={!cond.compareEnabled} allowClear />
                      <span className={s.separator}>〜</span>
                      <DateField value={cond.compareEnd ?? ""} onChange={(v) => upd({ compareEnd: v })} min="2023-05-01" max="2026-05-31" disabled={!cond.compareEnabled} allowClear />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Section 2: 店舗 */}
            <div className={`${s.section} ${openSection === 2 ? s.activeSection2 : ""}`}>
              <div className={s.sectionHeader} onClick={() => toggle(2)}>
                <div className={`${s.sectionNum} ${s.num2}`}>2</div>
                <div className={s.sectionTitle}>店舗選択</div>
                <div className={s.sectionSummary}>{storeSummary}</div>
                <div className={`${s.sectionChevron} ${openSection === 2 ? s.open : ""}`}>▼</div>
              </div>
              {openSection === 2 && (
                <div className={s.sectionBody}>
                  <StorePane stores={stores} selected={cond.storeCodes} onChange={(codes) => upd({ storeCodes: codes })} />
                </div>
              )}
            </div>

            {/* Section 3: 商品 */}
            <div className={`${s.section} ${openSection === 3 ? s.activeSection3 : ""}`}>
              <div className={s.sectionHeader} onClick={() => toggle(3)}>
                <div className={`${s.sectionNum} ${s.num3}`}>3</div>
                <div className={s.sectionTitle}>商品カテゴリ</div>
                <div className={s.sectionSummary}>{prodSummary}</div>
                <div className={`${s.sectionChevron} ${openSection === 3 ? s.open : ""}`}>▼</div>
              </div>
              {openSection === 3 && (
                <div className={s.sectionBody}>
                  <ProductPane hierarchy={hierarchy} cond={cond} updMdCodes={updMdCodes} updMajorCodes={updMajorCodes} updMiddleCodes={updMiddleCodes} updMinorCodes={updMinorCodes} upd={upd} />
                </div>
              )}
            </div>

            {/* Section 4: 会員条件 */}
            <div className={`${s.section} ${openSection === 4 ? s.activeSection4 : ""}`}>
              <div className={s.sectionHeader} onClick={() => toggle(4)}>
                <div className={`${s.sectionNum} ${s.num4}`}>4</div>
                <div className={s.sectionTitle}>会員条件設定</div>
                <div className={s.sectionSummary}>{memberSummary}</div>
                <div className={`${s.sectionChevron} ${openSection === 4 ? s.open : ""}`}>▼</div>
              </div>
              {openSection === 4 && (
                <div className={s.sectionBody}>
                  <MemberPane facets={facets} member={cond.member} updMember={updMember} />
                </div>
              )}
            </div>

            {/* Section 5: 保存・確認 */}
            <div className={`${s.section} ${openSection === 5 ? s.activeSection5 : ""}`}>
              <div className={s.sectionHeader} onClick={() => toggle(5)}>
                <div className={`${s.sectionNum} ${s.num5}`}>5</div>
                <div className={s.sectionTitle}>保存・確認</div>
                <div className={s.sectionSummary}>{saved.length}件</div>
                <div className={`${s.sectionChevron} ${openSection === 5 ? s.open : ""}`}>▼</div>
              </div>
              {openSection === 5 && (
                <div className={s.sectionBody}>
                  <div style={{ padding: "12px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="text" className={s.searchInput} style={{ maxWidth: 260 }} placeholder="条件名を入力して保存" value={saveName} onChange={(e) => setSaveName(e.target.value)} />
                    <button className={s.resetBtn} style={{ background: PALETTE.primary, boxShadow: "none" }} onClick={doSave} disabled={!saveName.trim()}>保存</button>
                  </div>
                  {saved.length === 0 ? (
                    <div className={s.emptyState} style={{ padding: 32 }}><span className={s.icon}>💾</span><span>保存済み条件はありません</span></div>
                  ) : saved.map((sv) => (
                    <div key={sv.id} className={s.savedItem}>
                      <div className={s.savedInfo} onClick={() => { setCond(sv.conditions); setOpenSection(1) }}>
                        <div className={s.savedName}>{sv.name}</div>
                        <div className={s.savedMeta}>{sv.conditions.baseStart} 〜 {sv.conditions.baseEnd} | {sv.conditions.storeCodes.length || "全"}店舗</div>
                      </div>
                      <button className={`${s.savedAction} ${s.savedLoad}`} onClick={() => { setCond(sv.conditions); setOpenSection(1) }}>↩</button>
                      <button className={`${s.savedAction} ${s.savedDel}`} onClick={() => setSaved(deleteSavedCondition(sv.id))}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Apply button */}
            <div className={s.submitArea}>
              <div>
                <div className={s.submitSummary}>
                  <strong>期間：</strong>{dateSummary}　|　<strong>店舗：</strong>{storeSummary}　|　<strong>商品：</strong>{prodSummary}　|　<strong>会員：</strong>{memberSummary}
                </div>
                <div style={{ textAlign: "center", display: "flex", gap: 12, justifyContent: "center" }}>
                  <button
                    style={{ padding: "12px 32px", border: "1px solid #d0d5dd", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", background: "#fff", color: "#475569" }}
                    onClick={onClose}
                  >
                    キャンセル
                  </button>
                  <button className={s.submitBtn} disabled={!dateOk} onClick={applyConditions}>
                    適用
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

/* ============ Store Pane ============ */
function StorePane({ stores, selected, onChange }: { stores: SelectorRow[]; selected: string[]; onChange: (c: string[]) => void }) {
  const [mode, setMode] = React.useState<string>("corporation_name")
  const [search, setSearch] = React.useState("")
  const [bizFilter, setBizFilter] = React.useState("all")
  const selSet = new Set(selected)

  const filtered = React.useMemo(() => {
    if (bizFilter === "all") return stores
    if (bizFilter === "DS") return stores.filter((st) => st.corporation_name === "株式会社ドン・キホーテ")
    return stores.filter((st) => st.corporation_name === "ユニー株式会社")
  }, [stores, bizFilter])

  const options = React.useMemo(() => {
    const map: Record<string, string[]> = {}
    filtered.forEach((st) => {
      const key = mode === "store_code" ? `${st.store_code} ${st.store_name}` : (st[mode as keyof SelectorRow] as string) ?? ""
      if (!key) return
      if (!map[key]) map[key] = []
      map[key].push(st.store_code)
    })
    let entries = Object.entries(map).sort((a, b) => a[0].localeCompare(b[0], "ja"))
    if (search) {
      const q = search.toLowerCase()
      entries = entries.filter(([k]) => k.toLowerCase().includes(q))
    }
    return entries
  }, [filtered, mode, search])

  const toggleOption = (codes: string[]) => {
    const allSel = codes.every((c) => selSet.has(c))
    if (allSel) onChange(selected.filter((c) => !codes.includes(c)))
    else onChange([...selected, ...codes.filter((c) => !selSet.has(c))])
  }

  const selectedDisplay = React.useMemo(() => {
    if (mode === "store_code") return selected.map((c) => { const st = stores.find((x) => x.store_code === c); return { code: c, label: st ? `${st.store_code} ${st.store_name}` : c } })
    const map: Record<string, string[]> = {}
    stores.forEach((st) => { if (!selSet.has(st.store_code)) return; const k = (st[mode as keyof SelectorRow] as string) ?? ""; if (!map[k]) map[k] = []; map[k].push(st.store_code) })
    return Object.entries(map).map(([k, codes]) => ({ code: codes.join(","), label: `${k} (${codes.length}店舗)` }))
  }, [stores, selected, mode, selSet])

  return (
    <div className={s.threePane}>
      <nav className={s.paneNav}>
        {STORE_MODES.map((m) => (
          <button key={m.key} className={`${s.paneNavBtn} ${mode === m.key ? s.activeStore : ""}`} onClick={() => { setMode(m.key); setSearch("") }}>
            {m.label}
          </button>
        ))}
        <div className={s.navDivider} />
        <button className={s.paneNavBtn} style={{ color: "#dc2626", fontSize: 11 }} onClick={() => onChange([])}>選択リセット</button>
      </nav>
      <div className={s.paneMid}>
        <div className={s.jigyouToggle}>
          <button className={bizFilter === "all" ? "active" : ""} onClick={() => setBizFilter("all")}>すべて</button>
          <button className={bizFilter === "DS" ? "active" : ""} onClick={() => setBizFilter("DS")}>DS事業</button>
          <button className={bizFilter === "GMS" ? "active" : ""} onClick={() => setBizFilter("GMS")}>GMS事業</button>
        </div>
        <div className={s.panelHeader}><h3>{STORE_MODES.find((m) => m.key === mode)?.label}一覧</h3><span className={s.count}>{options.length}項目</span></div>
        <div className={s.searchBar}><input className={s.searchInput} placeholder="検索..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <div className={s.actionBar}><button onClick={() => { const all = options.flatMap(([, c]) => c); toggleOption(all) }}>表示中を全選択</button></div>
        <div className={s.panelBody}>
          {options.map(([label, codes]) => {
            const isSel = codes.every((c) => selSet.has(c))
            return (
              <div key={label} className={`${s.optionRow} ${isSel ? s.selectedStore : ""}`} onClick={() => toggleOption(codes)}>
                <span className={s.optLabel}>{label}</span>
                <span className={s.optCount}>{mode !== "store_code" ? codes.length : ""}</span>
                <span className={`${s.optCheck} ${s.optCheckStore}`}>{isSel ? "✓" : ""}</span>
              </div>
            )
          })}
        </div>
      </div>
      <div className={s.paneSel}>
        <div className={`${s.panelHeader} ${s.panelHeaderStore}`}><h3>選択済み</h3><span className={s.count}>{selected.length}店舗</span></div>
        <div className={s.panelBody}>
          {selectedDisplay.length === 0 ? (
            <div className={s.emptyState}><span className={s.icon}>🏪</span><span>店舗を選択してください</span></div>
          ) : selectedDisplay.map((item) => (
            <div key={item.code} className={s.selItem}>
              <div className={s.info}><div className={s.name}>{item.label}</div></div>
              <button className={s.removeBtn} onClick={() => { const codes = item.code.split(","); onChange(selected.filter((c) => !codes.includes(c))) }}>×</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ============ Product Pane ============ */
function ProductPane({ hierarchy, cond, updMdCodes, updMajorCodes, updMiddleCodes, updMinorCodes, upd }: {
  hierarchy: { md: { code: string; name: string }[]; major: { code: string; name: string; md_code: string; item_count: number }[]; middle: { code: string; name: string; major_code: string; item_count: number }[]; minor: { code: string; name: string; middle_code: string; item_count: number }[]; sub: { code: string; name: string; minor_code: string; item_count: number }[]; totalItems: number }
  cond: AnalysisConditions
  updMdCodes: (c: string[]) => void
  updMajorCodes: (c: string[]) => void
  updMiddleCodes: (c: string[]) => void
  updMinorCodes: (c: string[]) => void
  upd: (p: Partial<AnalysisConditions>) => void
}) {
  const [mode, setMode] = React.useState<string>("md")
  const [search, setSearch] = React.useState("")

  // Item count for bottom counter bar (debounced)
  const [itemCount, setItemCount] = React.useState<number | null>(null)
  const [countLoading, setCountLoading] = React.useState(false)
  const hasSelection = cond.mdCodes.length > 0 || cond.majorCodes.length > 0 || cond.middleCodes.length > 0 || cond.minorCodes.length > 0 || cond.subCodes.length > 0 || cond.itemCodes.length > 0

  React.useEffect(() => {
    if (!hasSelection) { setItemCount(null); return }
    const timer = setTimeout(async () => {
      setCountLoading(true)
      try {
        const res = await fetch("/api/masters/products/count", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mdCodes: cond.mdCodes, majorCodes: cond.majorCodes, middleCodes: cond.middleCodes, minorCodes: cond.minorCodes, subCodes: cond.subCodes, itemCodes: cond.itemCodes }),
        })
        const data = await res.json()
        setItemCount(data.count ?? null)
      } catch { setItemCount(null) }
      setCountLoading(false)
    }, 500)
    return () => clearTimeout(timer)
  }, [cond.mdCodes, cond.majorCodes, cond.middleCodes, cond.minorCodes, cond.subCodes, cond.itemCodes, hasSelection])

  const options: { code: string; name: string; item_count?: number }[] = React.useMemo(() => {
    let items: { code: string; name: string; item_count?: number }[] = []
    // Cascade parent selections down the hierarchy so each level's list is
    // narrowed by ALL ancestor selections (not just its immediate parent).
    const mdSet = cond.mdCodes.length ? new Set(cond.mdCodes) : null
    const majorSet = cond.majorCodes.length
      ? new Set(cond.majorCodes)
      : (mdSet ? new Set(hierarchy.major.filter((m) => mdSet.has(m.md_code)).map((m) => m.code)) : null)
    const middleSet = cond.middleCodes.length
      ? new Set(cond.middleCodes)
      : (majorSet ? new Set(hierarchy.middle.filter((m) => majorSet.has(m.major_code)).map((m) => m.code)) : null)
    const minorSet = cond.minorCodes.length
      ? new Set(cond.minorCodes)
      : (middleSet ? new Set(hierarchy.minor.filter((m) => middleSet.has(m.middle_code)).map((m) => m.code)) : null)

    switch (mode) {
      case "md": items = hierarchy.md; break
      case "major": items = (mdSet ? hierarchy.major.filter((m) => mdSet.has(m.md_code)) : hierarchy.major) as typeof items; break
      case "middle": items = (majorSet ? hierarchy.middle.filter((m) => majorSet.has(m.major_code)) : hierarchy.middle) as typeof items; break
      case "minor": items = (middleSet ? hierarchy.minor.filter((m) => middleSet.has(m.middle_code)) : hierarchy.minor) as typeof items; break
      case "sub": items = (minorSet ? hierarchy.sub.filter((m) => minorSet.has(m.minor_code)) : hierarchy.sub) as typeof items; break
      default: items = []
    }
    if (search) { const q = search.toLowerCase(); items = items.filter((i) => i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q)) }
    return items
  }, [hierarchy, cond, mode, search])

  const selectedCodes = React.useMemo(() => {
    switch (mode) { case "md": return cond.mdCodes; case "major": return cond.majorCodes; case "middle": return cond.middleCodes; case "minor": return cond.minorCodes; case "sub": return cond.subCodes; default: return [] }
  }, [cond, mode])

  const toggleCode = (code: string) => {
    const has = selectedCodes.includes(code)
    const next = has ? selectedCodes.filter((c) => c !== code) : [...selectedCodes, code]
    switch (mode) { case "md": updMdCodes(next); break; case "major": updMajorCodes(next); break; case "middle": updMiddleCodes(next); break; case "minor": updMinorCodes(next); break; case "sub": upd({ subCodes: next }); break }
  }

  const selSet = new Set(selectedCodes)

  return (
    <div className={s.threePane}>
      <nav className={s.paneNav}>
        {PRODUCT_MODES.map((m) => (
          <button key={m.key} className={`${s.paneNavBtn} ${mode === m.key ? s.activeProduct : ""}`} onClick={() => { setMode(m.key); setSearch("") }}>
            {m.label}
          </button>
        ))}
      </nav>
      <div className={s.paneMid}>
        <div className={s.panelHeader}><h3>{PRODUCT_MODES.find((m) => m.key === mode)?.label}一覧</h3><span className={s.count}>{options.length}項目</span></div>
        <div className={s.searchBar}><input className={s.searchInput} placeholder="検索..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        {mode !== "jan" && (
          <div className={s.actionBar}><button onClick={() => { const codes = options.map((o) => o.code); switch (mode) { case "md": updMdCodes(codes); break; case "major": updMajorCodes(codes); break; case "middle": updMiddleCodes(codes); break; case "minor": updMinorCodes(codes); break; case "sub": upd({ subCodes: codes }); break } }}>表示中を全選択</button></div>
        )}
        <div className={s.panelBody}>
          {mode === "jan" ? (
            <div style={{ padding: 14 }}>
              <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>カンマまたは改行区切りで入力</p>
              <textarea
                style={{ width: "100%", height: 200, border: "1px solid #cbd5e1", borderRadius: 6, padding: 8, fontSize: 12, resize: "vertical" }}
                placeholder={"4901234567890\n4901234567891"}
                value={cond.itemCodes.join("\n")}
                onChange={(e) => upd({ itemCodes: e.target.value.split(/[,\n\s]+/).map((x) => x.trim()).filter(Boolean) })}
              />
              {cond.itemCodes.length > 0 && <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{cond.itemCodes.length}件</p>}
            </div>
          ) : options.map((item) => {
            const isSel = selSet.has(item.code)
            return (
              <div key={item.code} className={`${s.optionRow} ${isSel ? s.selectedProduct : ""}`} onClick={() => toggleCode(item.code)}>
                <span className={s.optLabel}>{item.name}</span>
                {item.item_count != null && item.item_count > 0 && (
                  <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: "auto", marginRight: 6, whiteSpace: "nowrap" }}>
                    {item.item_count.toLocaleString()}件
                  </span>
                )}
                <span className={`${s.optCheck} ${s.optCheckProduct}`}>{isSel ? "✓" : ""}</span>
              </div>
            )
          })}
        </div>
      </div>
      <div className={s.paneSel}>
        <div className={`${s.panelHeader} ${s.panelHeaderProduct}`}><h3>選択済み</h3><span className={s.count}>{selectedCodes.length}件</span></div>
        {/* Item count result bar */}
        <div className={s.memberResultBar} style={{ borderTop: "none", borderBottom: "1px solid var(--border)", paddingTop: 10, paddingBottom: 10 }}>
          <span className={s.resultLabel}>対象商品数</span>
          <span>
            {!hasSelection ? (
              <><span className={s.resultValue}>{hierarchy.totalItems.toLocaleString()}</span><span className={s.resultTotal}>件（全商品）</span></>
            ) : countLoading ? (
              <span className={s.resultValue} style={{ fontSize: 14 }}>集計中...</span>
            ) : (
              <>
                <span className={s.resultValue}>{itemCount !== null ? itemCount.toLocaleString() : "---"}</span>
                <span className={s.resultTotal}>/ {hierarchy.totalItems.toLocaleString()}件</span>
                {itemCount !== null && hierarchy.totalItems > 0 && (
                  <span style={{ fontSize: 11, color: PALETTE.primary, marginLeft: 6 }}>
                    ({Math.round(itemCount / hierarchy.totalItems * 100)}%)
                  </span>
                )}
              </>
            )}
          </span>
        </div>
        <div className={s.panelBody}>
          {selectedCodes.length === 0 ? (
            <div className={s.emptyState}><span className={s.icon}>🛒</span><span>カテゴリを選択してください</span></div>
          ) : selectedCodes.map((code) => {
            const item = options.find((o) => o.code === code)
            return (
              <div key={code} className={s.selItem}>
                <div className={s.info}><div className={s.name}>{item?.name ?? code}</div></div>
                <button className={s.removeBtn} onClick={() => toggleCode(code)}>×</button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const TOTAL_MEMBERS = 20_000_000

/* ============ Member Pane ============ */
function MemberPane({ facets, member, updMember }: { facets: MemberFacets; member: AnalysisConditions["member"]; updMember: (p: Partial<AnalysisConditions["member"]>) => void }) {
  const toggleChip = (list: string[], value: string, setter: (v: string[]) => void) => {
    setter(list.includes(value) ? list.filter((x) => x !== value) : [...list, value])
  }

  const [memberCount, setMemberCount] = React.useState<number | null>(null)
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const payload: Record<string, string[]> = {}
        if (member.enabled) {
          if (member.genders.length > 0) payload.genders = member.genders
          if (member.ageGroups.length > 0) payload.ageGroups = member.ageGroups
          if (member.ranks.length > 0) payload.ranks = member.ranks
        }
        const res = await fetch("/api/masters/members/count", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        setMemberCount(data.count ?? null)
      } catch { setMemberCount(null) }
      setLoading(false)
    }, 400)
    return () => clearTimeout(timer)
  }, [member.enabled, member.genders, member.ageGroups, member.ranks])

  return (
    <div className={s.memberSectionBody}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <span className={`${s.toggleSwitch} ${s.togglePurple}`}>
          <input type="checkbox" checked={member.enabled} onChange={(e) => updMember({ enabled: e.target.checked })} />
          <span className={s.toggleSlider} />
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: member.enabled ? PALETTE.primaryDark : "#94a3b8" }}>
          {member.enabled ? "会員条件を設定中" : "条件なし（全会員対象）"}
        </span>
      </div>
      <div className={!member.enabled ? s.memberDisabled : undefined}>
        <div className={s.memberFilterGrid}>
          <div className={s.memberFilterCard}>
            <h4>性別</h4>
            <div className={s.memberChipGroup}>
              {facets.genders.map((g) => (
                <span key={g} className={`${s.memberChip} ${member.genders.includes(g) ? s.selected : ""}`} onClick={() => member.enabled && toggleChip(member.genders, g, (v) => updMember({ genders: v }))}>{g}</span>
              ))}
            </div>
          </div>
          <div className={s.memberFilterCard}>
            <h4>会員ランク</h4>
            <div className={s.memberChipGroup}>
              {facets.ranks.map((r) => (
                <span key={r} className={`${s.memberChip} ${member.ranks.includes(r) ? s.selected : ""}`} onClick={() => member.enabled && toggleChip(member.ranks, r, (v) => updMember({ ranks: v }))}>{r}</span>
              ))}
            </div>
          </div>
          <div className={s.memberFilterCard} style={{ gridColumn: "1 / -1" }}>
            <h4>年代</h4>
            <div className={s.memberChipGroup}>
              {facets.age_groups.map((a) => (
                <span key={a} className={`${s.memberChip} ${member.ageGroups.includes(a) ? s.selected : ""}`} onClick={() => member.enabled && toggleChip(member.ageGroups, a, (v) => updMember({ ageGroups: v }))}>{a}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className={s.memberResultBar}>
        <span className={s.resultLabel}>対象会員数</span>
        <span>
          {loading ? (
            <span className={s.resultValue} style={{ fontSize: 14 }}>集計中...</span>
          ) : (
            <>
              <span className={s.resultValue}>{memberCount !== null ? memberCount.toLocaleString() : "---"}</span>
              <span className={s.resultTotal}>/ {TOTAL_MEMBERS.toLocaleString()} 人</span>
            </>
          )}
        </span>
      </div>
    </div>
  )
}
