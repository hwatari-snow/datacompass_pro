"use client"

import { useConditions } from "@/components/conditions-context"
import { Calendar, MapPin, Package, Users, SlidersHorizontal } from "lucide-react"
import Link from "next/link"

export function FilterBar() {
  const { conditions, updateConditions } = useConditions()

  const storeLabel = conditions.storeCodes.length
    ? `${conditions.storeCodes.length}店舗`
    : "全店舗"

  const itemLabel = (() => {
    const parts: string[] = []
    if (conditions.mdCodes?.length) parts.push(`MD:${conditions.mdCodes.length}`)
    if (conditions.majorCodes?.length) parts.push(`大:${conditions.majorCodes.length}`)
    if (conditions.middleCodes?.length) parts.push(`中:${conditions.middleCodes.length}`)
    if (conditions.minorCodes?.length) parts.push(`小:${conditions.minorCodes.length}`)
    if (conditions.makerCodes?.length) parts.push(`メーカー:${conditions.makerCodes.length}`)
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
      {/* Period */}
      <div className="flex items-center gap-1.5">
        <span style={{ color: "var(--muted-foreground)" }}>
          <Calendar className="h-3.5 w-3.5" />
        </span>
        <input
          type="date"
          value={conditions.baseStart}
          onChange={(e) => updateConditions({ baseStart: e.target.value })}
          className="rounded border px-2 py-1 text-xs outline-none"
          style={{
            backgroundColor: "var(--background)",
            borderColor: "var(--border)",
            color: "var(--foreground)",
          }}
        />
        <span style={{ color: "var(--muted-foreground)" }}>〜</span>
        <input
          type="date"
          value={conditions.baseEnd}
          onChange={(e) => updateConditions({ baseEnd: e.target.value })}
          className="rounded border px-2 py-1 text-xs outline-none"
          style={{
            backgroundColor: "var(--background)",
            borderColor: "var(--border)",
            color: "var(--foreground)",
          }}
        />
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

      {/* Detail settings link */}
      <Link
        href="/analysis/conditions"
        className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-[var(--accent)]"
        style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
      >
        <SlidersHorizontal className="h-3 w-3" />
        詳細条件
      </Link>
    </div>
  )
}
