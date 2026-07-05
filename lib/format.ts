// 表示フォーマット用ヘルパー
export function yen(n: number | null | undefined): string {
  if (n == null) return "-"
  return "¥" + Math.round(n).toLocaleString("ja-JP")
}
export function num(n: number | null | undefined): string {
  if (n == null) return "-"
  return Math.round(n).toLocaleString("ja-JP")
}
export function pct(n: number | null | undefined, digits = 1): string {
  if (n == null) return "-"
  return n.toFixed(digits) + "%"
}
/** 前期比(%) を符号付きで返す */
export function delta(curr: number, prev: number): { text: string; dir: "up" | "down" | "flat" } {
  if (!prev) return { text: "-", dir: "flat" }
  const d = ((curr - prev) / prev) * 100
  const dir = d > 0.05 ? "up" : d < -0.05 ? "down" : "flat"
  return { text: (d >= 0 ? "+" : "") + d.toFixed(1) + "%", dir }
}
export function compact(n: number | null | undefined): string {
  if (n == null) return "-"
  if (Math.abs(n) >= 1e8) return (n / 1e8).toFixed(1) + "億"
  if (Math.abs(n) >= 1e4) return (n / 1e4).toFixed(1) + "万"
  return Math.round(n).toLocaleString("ja-JP")
}
