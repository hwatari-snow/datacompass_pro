"use client"
import * as React from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface SelectorRow {
  [key: string]: string
}

interface GroupField {
  key: string
  label: string
}

interface HierarchySelectorProps {
  rows: SelectorRow[]
  idField: string
  labelField: string
  groupFields: GroupField[]
  selected: string[]
  onChange: (codes: string[]) => void
  emptyMeansAll?: boolean
}

/** 階層マルチセレクト: 軸切替 + 検索 + グループ単位の一括選択 + 選択済み表示 */
export function HierarchySelector({
  rows,
  idField,
  labelField,
  groupFields,
  selected,
  onChange,
  emptyMeansAll = true,
}: HierarchySelectorProps) {
  const [dim, setDim] = React.useState(groupFields[0]?.key ?? "")
  const [q, setQ] = React.useState("")
  const sel = React.useMemo(() => new Set(selected), [selected])

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter(
      (r) =>
        r[labelField]?.toLowerCase().includes(needle) ||
        r[idField]?.toLowerCase().includes(needle) ||
        groupFields.some((g) => r[g.key]?.toLowerCase().includes(needle)),
    )
  }, [rows, q, labelField, idField, groupFields])

  const groups = React.useMemo(() => {
    const m = new Map<string, SelectorRow[]>()
    for (const r of filtered) {
      const k = r[dim] ?? "(未分類)"
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(r)
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0], "ja"))
  }, [filtered, dim])

  const toggle = (code: string) => {
    const next = new Set(sel)
    if (next.has(code)) next.delete(code)
    else next.add(code)
    onChange(Array.from(next))
  }
  const toggleGroup = (items: SelectorRow[]) => {
    const codes = items.map((r) => r[idField])
    const allSel = codes.every((c) => sel.has(c))
    const next = new Set(sel)
    if (allSel) codes.forEach((c) => next.delete(c))
    else codes.forEach((c) => next.add(c))
    onChange(Array.from(next))
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
      <div className="border rounded-lg overflow-hidden">
        <div className="flex flex-wrap gap-1 p-2 border-b bg-muted/40">
          {groupFields.map((g) => (
            <button
              key={g.key}
              type="button"
              onClick={() => setDim(g.key)}
              className={cn(
                "px-2.5 py-1 rounded text-xs font-medium",
                dim === g.key ? "bg-primary text-primary-foreground" : "bg-background border hover:bg-accent",
              )}
            >
              {g.label}
            </button>
          ))}
        </div>
        <div className="p-2 border-b">
          <Input placeholder="検索（名称・コード）" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="max-h-[360px] overflow-y-auto divide-y">
          {groups.map(([gname, items]) => {
            const allSel = items.every((r) => sel.has(r[idField]))
            return (
              <div key={gname}>
                <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 sticky top-0">
                  <span className="text-xs font-semibold">{gname}</span>
                  <button type="button" className="text-xs text-primary hover:underline" onClick={() => toggleGroup(items)}>
                    {allSel ? "解除" : "全選択"}（{items.length}）
                  </button>
                </div>
                {items.map((r) => (
                  <label key={r[idField]} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent cursor-pointer">
                    <input type="checkbox" checked={sel.has(r[idField])} onChange={() => toggle(r[idField])} />
                    <span className="flex-1 truncate">{r[labelField]}</span>
                    <span className="text-xs text-muted-foreground">{r[idField]}</span>
                  </label>
                ))}
              </div>
            )
          })}
          {groups.length === 0 && <div className="p-4 text-sm text-muted-foreground">該当なし</div>}
        </div>
      </div>
      <div className="border rounded-lg overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/40">
          <span className="text-xs font-semibold">
            選択済み {sel.size === 0 ? (emptyMeansAll ? "（全件）" : "（0）") : `（${sel.size}）`}
          </span>
          {sel.size > 0 && (
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => onChange([])}>
              クリア
            </Button>
          )}
        </div>
        <div className="max-h-[400px] overflow-y-auto p-2 flex flex-col gap-1">
          {sel.size === 0 && (
            <p className="text-xs text-muted-foreground p-2">
              {emptyMeansAll ? "未選択の場合は全件が対象です。" : "項目を選択してください。"}
            </p>
          )}
          {rows
            .filter((r) => sel.has(r[idField]))
            .map((r) => (
              <div key={r[idField]} className="flex items-center gap-1 text-xs bg-secondary rounded px-2 py-1">
                <span className="flex-1 truncate">{r[labelField]}</span>
                <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => toggle(r[idField])}>
                  ×
                </button>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
