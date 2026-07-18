/**
 * Central color palette — Vivid scheme, base #5AB4E0 (sky).
 * sky → light blue → pink → magenta → lime.
 * Single source of truth for chart & UI accent colors. CSS chrome tokens
 * live in app/globals.css and are kept in sync with these values.
 * (Neutral light/dark backgrounds are intentionally left as-is.)
 */

export const PALETTE = {
  primary: "#5AB4E0", // sky (base)
  primaryLight: "#9CD2EC", // light blue tint
  primaryDark: "#2E8BC0", // deeper sky (lines / strong text / hover)
  accent: "#E05CB4", // pink (pop accent)
  accentLight: "#EFA6DA", // light pink
} as const

/** Categorical data-viz palette — vivid spread, kept distinct for multi-series charts. */
export const CHART_COLORS = [
  "#5AB4E0", // sky
  "#E05CB4", // pink
  "#B4E05C", // lime
  "#C92693", // magenta
  "#9CD2EC", // light blue
  "#2E8BC0", // deep sky
  "#7FB800", // deep lime
  "#EE93D2", // light pink
]

/** ABC rank — distinct hues (sky / lime / pink). */
export const ABC_COLORS: Record<string, string> = {
  A: "#5AB4E0",
  B: "#B4E05C",
  C: "#E05CB4",
}

/** Wizard step colors (5) — full vivid spectrum. */
export const STEP_COLORS = ["#5AB4E0", "#B4E05C", "#E05CB4", "#C92693", "#9CD2EC"]

/** Gender split — sky / pink. */
export const GENDER = { male: "#5AB4E0", female: "#E05CB4" }

/** Purchase-frequency segments — sky intensity ramp (deep→light). */
export const SEG_COLORS: Record<string, string> = {
  ヘビー: "#2E8BC0",
  ミドル: "#5AB4E0",
  ライト: "#9CD2EC",
}

/** Semantic (functional) colors — keep their meaning; not folded into brand palette. */
export const SEMANTIC = {
  success: "#059669",
  danger: "#dc2626",
  warning: "#F59E0B",
  emphasis: "#E05CB4", // highlight (e.g. peak) — pink, contrasts with sky lines
}
