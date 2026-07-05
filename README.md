# DataCompass

PPIH ID-POS 分析プラットフォーム。Snowflake App Runtime (SPCS) 上で動作する Next.js アプリ。

## 画面

1. **設定** (`/`) — 管理コンソール 5タブ（ダッシュボード / アカウント管理 / データ開示制御 / クレジット監視 / ユーザー管理）
2. **分析条件設定** (`/analysis/conditions`) — 期間・店舗・商品・会員条件の5ステップウィザード
3. **ABC分析** (`/analysis/abc`) — ID-POS ABC分析（商品別/店舗別・基準切替・パレート図・明細・Excel出力）

## データ

すべて `DATACOMPASS_DB` を完全修飾で参照（Owner's Rights）。

- `MASTER` — DATAMART_COMMON_ITEMS / STORES / MEMBERS
- `ANALYTICS` — TABLEAU_I_ABC_TRADE / TABLEAU_I_ABC_ALL_CUSTOMER
- `ACCESS_CONTROL` — USER_CORPORATION / CATEGORY / MAKER_RELATION
- `APP_CONFIG` — ACCOUNTS / APP_USERS / CREDIT_USAGE / SAVED_CONDITIONS / USER_GROUPS
- `STAGING` — ABC_RUN_<token>（一次テーブル：条件確定時に作成する TRANSIENT スナップショット）

## 一次テーブル（高速化）

条件確定時に `/api/abc/prepare` がフィルタ・マスタ結合済みの TRANSIENT テーブルを1回だけ作成し、
ABC画面の集計単位/基準切替は `/api/abc`（runToken付）でそれを GROUP BY するだけ。再フィルタ・会員サブクエリの再実行を回避。

## 開発・デプロイ

```bash
npm install
npm run dev                      # ローカル開発
snow app deploy -c hwatari_pat   # Snowflake へデプロイ
```

データ基盤の構築は `../sql/01_setup.sql` → `02_datamart_ddl.sql` → `03_generate_sample_data.sql` の順に実行。
