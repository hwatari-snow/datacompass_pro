// 共通型定義 — DataCompass

// ===== マスタ =====
export interface StoreOption {
  store_code: string
  store_name: string
  corporation_code: string
  corporation_name: string
  business_type_name: string
  area_name: string
  prefecture_name: string
}

export interface ProductHierarchyNode {
  code: string
  name: string
  level: "major" | "middle" | "minor" | "brand" | "maker"
}

export interface ItemOption {
  item_code: string
  item_name: string
  major_name: string
  middle_name: string
  minor_name: string
  brand_name: string
  maker_name: string
}

export interface MemberFacets {
  genders: string[]
  age_groups: string[]
  ranks: string[]
}

// ===== 分析条件 =====
export interface MemberCondition {
  enabled: boolean
  genders: string[]
  ageGroups: string[]
  ranks: string[]
  minPurchaseCount: number | null
  minPurchaseAmount: number | null
}

export interface AnalysisConditions {
  baseStart: string
  baseEnd: string
  compareEnabled: boolean
  compareStart: string | null
  compareEnd: string | null
  storeCodes: string[] // 空 = 全店舗
  itemCodes: string[] // 空 = 全商品 (legacy, 個別商品コード)
  categoryClass: string // "" = 全区分, "DS" or "UNY"
  mdCodes: string[]       // MDコードで絞り込み
  majorCodes: string[]    // 大分類コードで絞り込み
  middleCodes: string[]   // 中分類コードで絞り込み
  minorCodes: string[]    // 小分類コードで絞り込み
  makerCodes: string[]    // メーカーコードで絞り込み
  mdNames?: string[]
  majorNames?: string[]
  middleNames?: string[]
  minorNames?: string[]
  makerNames?: string[]
  storeNames?: string[]
  member: MemberCondition
}

// ===== ABC結果 =====
export type AbcCriteria = "amount" | "quantity" | "receipt"
export type ProductUnit = "item" | "md" | "major" | "middle" | "minor" | "brand" | "maker"
export type StoreUnit = "store" | "area" | "business_type" | "corporation" | "prefecture"

export interface AbcRow {
  code: string
  name: string
  major_name?: string
  middle_name?: string
  minor_name?: string
  brand_name?: string
  area_name?: string
  business_type_name?: string
  corporation_name?: string
  prefecture_name?: string
  sales: number
  quantity: number
  receipt_count: number
  rank: number
  sales_ratio: number
  cumulative_ratio: number
  abc_class: "A" | "B" | "C"
}

export interface AbcSummary {
  total_sales: number
  total_quantity: number
  total_receipts: number
  total_units: number
  a_count: number
  b_count: number
  c_count: number
}

export interface AbcResult {
  summary: AbcSummary
  rows: AbcRow[]
}

// ===== 設定画面 =====
export interface Account {
  account_id: string
  account_name: string
  company_name: string
  industry: string
  prefecture: string
  status: string
  user_count: number
  category_count: number
  store_count: number
  credits_used: number
  credit_limit: number
  last_login: string
  created_at: string
  auth_method: string
  app_version: string
}

export interface AppUser {
  user_id: string
  account_id: string
  user_name: string
  email: string
  auth_method: string
  idp: string
  last_login: string
  status: string
}

export interface CreditMonth {
  usage_month: string
  compute_credits: number
  storage_credits: number
  serverless_credits: number
}
