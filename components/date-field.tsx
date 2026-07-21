"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { Calendar as CalIcon, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import s from "./date-field.module.css"

const WD = ["日", "月", "火", "水", "木", "金", "土"]

function parseDate(v?: string | null): Date | null {
  if (!v) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}
function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
function display(v?: string | null): string {
  const d = parseDate(v)
  return d ? `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}` : ""
}

type Props = {
  value: string
  onChange: (v: string) => void
  min?: string
  max?: string
  placeholder?: string
  disabled?: boolean
  allowClear?: boolean
}

export function DateField({ value, onChange, min, max, placeholder = "日付を選択", disabled, allowClear }: Props) {
  const [open, setOpen] = React.useState(false)
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null)
  const selected = parseDate(value)
  const [view, setView] = React.useState<Date>(() => selected ?? parseDate(max) ?? new Date())
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const popRef = React.useRef<HTMLDivElement>(null)

  const minD = parseDate(min)
  const maxD = parseDate(max)
  const inRange = (d: Date) => (!minD || d >= minD) && (!maxD || d <= maxD)

  const place = React.useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const w = 300
    const gap = 4
    // Right-align the popup to the trigger's right edge (where the calendar icon
    // sits) so it drops immediately below the icon, clamped to the viewport.
    const left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8))
    const estH = 340
    const below = r.bottom + gap
    const top = below + estH > window.innerHeight ? Math.max(8, r.top - estH - gap) : below
    setPos({ top, left })
  }, [])

  const openPicker = () => {
    if (disabled) return
    setView(parseDate(value) ?? parseDate(max) ?? new Date())
    place()
    setOpen(true)
  }

  React.useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (popRef.current?.contains(t) || triggerRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    const onScroll = () => setOpen(false)
    document.addEventListener("mousedown", onDoc)
    document.addEventListener("keydown", onKey)
    window.addEventListener("scroll", onScroll, true)
    window.addEventListener("resize", onScroll)
    return () => {
      document.removeEventListener("mousedown", onDoc)
      document.removeEventListener("keydown", onKey)
      window.removeEventListener("scroll", onScroll, true)
      window.removeEventListener("resize", onScroll)
    }
  }, [open])

  const year = view.getFullYear()
  const month = view.getMonth()
  const gridStart = new Date(year, month, 1 - new Date(year, month, 1).getDay())
  const days: Date[] = []
  for (let i = 0; i < 42; i++) days.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i))
  const todayKey = toKey(new Date())
  const selKey = selected ? toKey(selected) : ""

  const pick = (d: Date) => {
    if (!inRange(d)) return
    onChange(toKey(d))
    setOpen(false)
  }

  return (
    <div className={s.wrap}>
      <button
        type="button"
        ref={triggerRef}
        className={s.trigger}
        disabled={disabled}
        data-empty={!selected}
        onClick={() => (open ? setOpen(false) : openPicker())}
      >
        <span className={s.value}>{display(value) || placeholder}</span>
        <CalIcon className={s.icon} />
      </button>

      {open && pos && createPortal(
        <div ref={popRef} className={s.pop} role="dialog" style={{ top: pos.top, left: pos.left }}>
          <div className={s.head}>
            <div className={s.navGroup}>
              <button type="button" className={s.nav} aria-label="前の年" onClick={() => setView(new Date(year - 1, month, 1))}><ChevronsLeft /></button>
              <button type="button" className={s.nav} aria-label="前の月" onClick={() => setView(new Date(year, month - 1, 1))}><ChevronLeft /></button>
            </div>
            <span className={s.title}>{year}年 {month + 1}月</span>
            <div className={s.navGroup}>
              <button type="button" className={s.nav} aria-label="次の月" onClick={() => setView(new Date(year, month + 1, 1))}><ChevronRight /></button>
              <button type="button" className={s.nav} aria-label="次の年" onClick={() => setView(new Date(year + 1, month, 1))}><ChevronsRight /></button>
            </div>
          </div>

          <div className={s.wd}>
            {WD.map((w, i) => (
              <span key={w} className={s.wdCell} data-sun={i === 0} data-sat={i === 6}>{w}</span>
            ))}
          </div>

          <div className={s.grid}>
            {days.map((d, i) => {
              const k = toKey(d)
              return (
                <button
                  key={i}
                  type="button"
                  disabled={!inRange(d)}
                  onClick={() => pick(d)}
                  className={s.day}
                  data-sel={k === selKey}
                  data-today={k === todayKey && k !== selKey}
                  data-out={d.getMonth() !== month}
                  data-dis={!inRange(d)}
                  data-sun={d.getDay() === 0}
                  data-sat={d.getDay() === 6}
                >
                  {d.getDate()}
                </button>
              )
            })}
          </div>

          <div className={s.foot} data-single={!allowClear}>
            {allowClear && (
              <button type="button" className={s.footBtn} onClick={() => { onChange(""); setOpen(false) }}>クリア</button>
            )}
            <button
              type="button"
              className={`${s.footBtn} ${s.accent}`}
              onClick={() => setView(maxD ?? new Date())}
            >
              {maxD ? "最新月へ" : "今月へ"}
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
