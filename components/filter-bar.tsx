"use client"

import { useConditions } from "@/components/conditions-context"
import { Calendar, MapPin, Package, Users, SlidersHorizontal, ChevronUp } from "lucide-react"

interface FilterBarProps {
  onTogglePanel: () => void
  panelOpen: boolean
}

export function FilterBar({ onTogglePanel, panelOpen }: FilterBarProps) {
  const { conditions } = useConditions()

  const storeLabel = conditions.storeCodes.length
    ? conditions.storeCodes.length <= 3 && conditions.storeNames?.length
      ? conditions.storeNames.join(", ")
      : `${conditions.storeCodes.length}店舗`
    : "全店舗"

  const itemLabel = (() => {
    const parts: string[] = []
    const fmt = (codes: string[] | undefined, names: string[] | undefined, prefix: string) => {
      if (!codes?.length) return
      if (codes.length <= 3 && names?.length) {
        parts.push(`${prefix}: ${names.join(", ")}`)
      } else {
        parts.push(`${prefix}:${codes.length}`)
      }
    }
    fmt(conditions.mdCodes, conditions.mdNames, "MD")
    fmt(conditions.majorCodes, conditions.majorNames, "大")
    fmt(conditions.middleCodes, conditions.middleNames, "中")
    fmt(conditions.minorCodes, conditions.minorNames, "小")
    fmt(conditions.makerCodes, conditions.makerNames, "メーカー")
    if (conditions.itemCodes?.length) parts.push(`${conditions.itemCodes.length}商品`)
    return parts.length ? parts.join(" ") : "全商品"
  })()

  const hasMemberFilter = conditions.member.enabled

  return (
    <div
      className="flex items-center gap-3 border-b px-6 py-2 text-sm"
      style={{
        backgroundColor: "var(--card)",
        borderColor: "var(--border)",
      }}
    >
      {/* Period (display-only — edit via 詳細条件 panel) */}
      <div className="flex items-center gap-1.5">
        <span style={{ color: "var(--muted-foreground)" }}>
          <Calendar className="h-3.5 w-3.5" />
        </span>
        <span className="rounded border px-2 py-1 text-xs" style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}>
          {conditions.baseStart}
        </span>
        <span style={{ color: "var(--muted-foreground)" }}>〜</span>
        <span className="rounded border px-2 py-1 text-xs" style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}>
          {conditions.baseEnd}
        </span>
      </div>

      <div className="h-4 w-px" style={{ backgroundColor: "var(--border)" }} />

      {/* Store badge */}
      <button
        className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-[var(--accent)]"
        style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
        title="店舗フィルター（詳細設定で変更）"
      >
        <MapPin className="h-3 w-3" style={{ color: "var(--muted-foreground)" }} />
        {storeLabel}
      </button>

      {/* Item badge */}
      <button
        className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-[var(--accent)]"
        style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
        title="商品フィルター（詳細設定で変更）"
      >
        <Package className="h-3 w-3" style={{ color: "var(--muted-foreground)" }} />
        {itemLabel}
      </button>

      {/* Member condition badge */}
      {hasMemberFilter && (
        <span
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
          style={{ backgroundColor: "rgba(59,130,246,0.1)", color: "var(--brand-primary)" }}
        >
          <Users className="h-3 w-3" />
          会員条件あり
        </span>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Detail settings button */}
      <button
        onClick={onTogglePanel}
        className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-[var(--accent)] ${panelOpen ? "bg-[var(--accent)]" : ""}`}
        style={{ borderColor: panelOpen ? "var(--brand-primary)" : "var(--border)", color: panelOpen ? "var(--brand-primary)" : "var(--muted-foreground)" }}
      >
        {panelOpen ? <ChevronUp className="h-3 w-3" /> : <SlidersHorizontal className="h-3 w-3" />}
        詳細条件
      </button>
    </div>
  )
}
