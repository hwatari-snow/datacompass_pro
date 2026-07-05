import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Snowflakeは未引用の列エイリアスを大文字で返すため、
 * クライアントが小文字キーで参照できるよう全キーを小文字化する。
 */
export function lowercaseKeys<T extends Record<string, unknown>>(rows: T[]): Record<string, unknown>[] {
  return rows.map((r) => {
    const o: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(r)) o[k.toLowerCase()] = v
    return o
  })
}
