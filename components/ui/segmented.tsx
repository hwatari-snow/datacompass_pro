"use client"

import { cn } from "@/lib/utils"
import { PALETTE } from "@/lib/palette"

/**
 * Segmented toggle control (shared between ABC分析 / トレンド分析).
 * Renders a bordered inline-flex group of buttons with an active fill.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  variant = "blue",
}: {
  options: { key: T; label: string }[]
  value: T
  onChange: (v: T) => void
  variant?: "blue" | "red"
}) {
  const activeStyle =
    variant === "red"
      ? { background: PALETTE.accent, borderColor: PALETTE.accent, color: "#fff" }
      : { background: PALETTE.primary, borderColor: PALETTE.primary, color: "#fff" }
  return (
    <div className="inline-flex rounded-md border overflow-hidden">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          style={value === o.key ? activeStyle : undefined}
          className={cn(
            "px-3 py-1.5 text-sm font-medium border-r last:border-r-0 transition-colors",
            value !== o.key && "bg-background hover:bg-accent text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
