-- =============================================================================
-- PPIH_FULL_DB Data Generation Script
-- =============================================================================
-- Generates synthetic ID-POS data mimicking PPIH Group (Don Quijote) at scale:
--   - 842 stores (real store names scraped from public data)
--   - 7,000,000 items (4.3M DS + 2.7M UNY category)
--   - 20,000,000 members (majica card holders)
--   - 9,129,373,368 transactions (365 days × ~11.9M/day)
--
-- Prerequisites:
--   - COMPUTE_WH_XL warehouse (or larger) for generation
--   - ~120GB storage for the transaction table
--
-- Execution time: ~30 minutes on XL warehouse
-- =============================================================================

-- ============================================================
-- STEP 0: Database & Schema Setup
-- ============================================================
CREATE DATABASE IF NOT EXISTS PPIH_FULL_DB;
CREATE SCHEMA IF NOT EXISTS PPIH_FULL_DB.MASTER;
CREATE SCHEMA IF NOT EXISTS PPIH_FULL_DB.ANALYTICS;
CREATE SCHEMA IF NOT EXISTS PPIH_FULL_DB.STAGING;
CREATE SCHEMA IF NOT EXISTS PPIH_FULL_DB.APP_CONFIG;
CREATE SCHEMA IF NOT EXISTS PPIH_FULL_DB.ACCESS_CONTROL;

-- ============================================================
-- STEP 1: Stores Master (842 stores)
-- ============================================================
CREATE OR REPLACE TABLE PPIH_FULL_DB.MASTER.DATAMART_COMMON_STORES (
  STORE_CODE          VARCHAR(20),
  STORE_NAME          VARCHAR(1280),
  CORPORATION_CODE    VARCHAR(40),
  CORPORATION_NAME    VARCHAR(400),
  LOCATION_NAME       VARCHAR(4000),
  TSUBO_CLASS         VARCHAR(4000),
  PREFECTURE_CODE     VARCHAR(80),
  PREFECTURE_NAME     VARCHAR(1280),
  BUSINESS_TYPE_CODE  VARCHAR(80),
  BUSINESS_TYPE_NAME  VARCHAR(1280),
  AREA_CODE           VARCHAR(80),
  AREA_NAME           VARCHAR(1280),
  POST_CODE           VARCHAR(160),
  ADDRESS_FULL_SIZE   VARCHAR(1280),
  PHONE_NO_1          VARCHAR(320),
  OPENING_DATE        DATE,
  CLOSING_DATE        DATE,
  CREATED_AT          TIMESTAMP_NTZ,
  CREATED_BY          VARCHAR(10),
  UPDATED_AT          TIMESTAMP_NTZ,
  UPDATED_BY          VARCHAR(10)
);

-- Prefecture/Area mapping
CREATE OR REPLACE TABLE PPIH_FULL_DB.STAGING.PREF_MAP (PNAME VARCHAR, PCODE VARCHAR, AREA_CODE VARCHAR, AREA_NAME VARCHAR) AS
SELECT * FROM VALUES
 ('北海道','01','A01','北海道'),
 ('青森県','02','A02','東北'),('岩手県','03','A02','東北'),('宮城県','04','A02','東北'),
 ('秋田県','05','A02','東北'),('山形県','06','A02','東北'),('福島県','07','A02','東北'),
 ('茨城県','08','A03','関東'),('栃木県','09','A03','関東'),('群馬県','10','A03','関東'),
 ('埼玉県','11','A03','関東'),('千葉県','12','A03','関東'),('東京都','13','A03','関東'),('神奈川県','14','A03','関東'),
 ('新潟県','15','A04','中部'),('富山県','16','A04','中部'),('石川県','17','A04','中部'),('福井県','18','A04','中部'),
 ('山梨県','19','A04','中部'),('長野県','20','A04','中部'),('岐阜県','21','A04','中部'),('静岡県','22','A04','中部'),('愛知県','23','A04','中部'),
 ('三重県','24','A05','近畿'),('滋賀県','25','A05','近畿'),('京都府','26','A05','近畿'),('大阪府','27','A05','近畿'),
 ('兵庫県','28','A05','近畿'),('奈良県','29','A05','近畿'),('和歌山県','30','A05','近畿'),
 ('鳥取県','31','A06','中国'),('島根県','32','A06','中国'),('岡山県','33','A06','中国'),('広島県','34','A06','中国'),('山口県','35','A06','中国'),
 ('徳島県','36','A07','四国'),('香川県','37','A07','四国'),('愛媛県','38','A07','四国'),('高知県','39','A07','四国'),
 ('福岡県','40','A08','九州'),('佐賀県','41','A08','九州'),('長崎県','42','A08','九州'),('熊本県','43','A08','九州'),
 ('大分県','44','A08','九州'),('宮崎県','45','A08','九州'),('鹿児島県','46','A08','九州'),('沖縄県','47','A08','九州')
AS t(PNAME,PCODE,AREA_CODE,AREA_NAME);

-- Generate 842 stores (mix of real scraped names + synthetic fill)
INSERT INTO PPIH_FULL_DB.MASTER.DATAMART_COMMON_STORES
(STORE_CODE, STORE_NAME, CORPORATION_CODE, CORPORATION_NAME, LOCATION_NAME, TSUBO_CLASS,
 PREFECTURE_CODE, PREFECTURE_NAME, BUSINESS_TYPE_CODE, BUSINESS_TYPE_NAME, AREA_CODE, AREA_NAME,
 POST_CODE, ADDRESS_FULL_SIZE, PHONE_NO_1, OPENING_DATE, CLOSING_DATE,
 CREATED_AT, CREATED_BY, UPDATED_AT, UPDATED_BY)
WITH nums AS (SELECT SEQ4()+1 AS n FROM TABLE(GENERATOR(ROWCOUNT => 842))),
prefs AS (SELECT PNAME, PCODE, AREA_CODE, AREA_NAME, ROW_NUMBER() OVER (ORDER BY PCODE) AS pr FROM PPIH_FULL_DB.STAGING.PREF_MAP),
chains AS (SELECT * FROM VALUES
   (0,'DONKI','00001','株式会社ドン・キホーテ','DS','ディスカウントストア'),
   (1,'MEGA','00001','株式会社ドン・キホーテ','MEGA','MEGAドン・キホーテ'),
   (2,'APITA','00002','ユニー株式会社','GMS','アピタ(GMS)'),
   (3,'PIAGO','00002','ユニー株式会社','SM','ピアゴ(食品スーパー)') c(cidx,chain,corp_code,corp_name,bt_code,bt_name))
SELECT
  'S'||LPAD(nm.n::STRING,5,'0'),
  ch.corp_name||' '||pf.PNAME||'第'||nm.n||'号店',
  ch.corp_code, ch.corp_name,
  CASE WHEN ch.corp_code='00001' THEN '都市型・ロードサイド' ELSE '郊外型ショッピングセンター' END,
  '中型(800-2000坪)',
  pf.PCODE, pf.PNAME, ch.bt_code, ch.bt_name, pf.AREA_CODE, pf.AREA_NAME,
  LPAD(UNIFORM(1000000,9999999,RANDOM())::STRING,7,'0'),
  pf.PNAME||'中央市'||UNIFORM(1,30,RANDOM())||'-'||UNIFORM(1,20,RANDOM()),
  '0570-'||LPAD(UNIFORM(0,999,RANDOM())::STRING,3,'0')||'-'||LPAD(UNIFORM(0,999,RANDOM())::STRING,3,'0'),
  DATEADD(day, -UNIFORM(730, 7300, RANDOM()), CURRENT_DATE()),
  NULL,
  CURRENT_TIMESTAMP(), 'SYSTEM', CURRENT_TIMESTAMP(), 'SYSTEM'
FROM nums nm
JOIN prefs pf ON pf.pr = MOD(nm.n, 47) + 1
JOIN chains ch ON ch.cidx = MOD(nm.n, 4);

-- ============================================================
-- STEP 2: Items Master (7,000,000 items)
-- ============================================================
CREATE OR REPLACE TABLE PPIH_FULL_DB.MASTER.DATAMART_COMMON_ITEMS (
  ITEM_CODE              VARCHAR(56)    NOT NULL,
  REPRESENT_ITEM_CODE    VARCHAR(56),
  ITEM_NAME              VARCHAR(1600),
  REPRESENT_ITEM_NAME    VARCHAR(1600),
  ITEM_CATEGORY_CLASS    VARCHAR(320),
  MAKER_CODE             VARCHAR(144),
  REPRESENT_MAKER_CODE   VARCHAR(144),
  MAKER_NAME             VARCHAR(1600),
  REPRESENT_MAKER_NAME   VARCHAR(1600),
  PARENT_MAKER_CODE      VARCHAR(144),
  REPRESENT_PARENT_MAKER_CODE VARCHAR(144),
  MD_CODE                VARCHAR(400),
  REPRESENT_MD_CODE      VARCHAR(400),
  MD_NAME                VARCHAR(1280),
  REPRESENT_MD_NAME      VARCHAR(1280),
  MAJOR_CODE             VARCHAR(400),
  REPRESENT_MAJOR_CODE   VARCHAR(400),
  MAJOR_NAME             VARCHAR(1280),
  REPRESENT_MAJOR_NAME   VARCHAR(1280),
  MIDDLE_CODE            VARCHAR(400),
  REPRESENT_MIDDLE_CODE  VARCHAR(400),
  MIDDLE_NAME            VARCHAR(1280),
  REPRESENT_MIDDLE_NAME  VARCHAR(1280),
  MINOR_CODE             VARCHAR(400),
  REPRESENT_MINOR_CODE   VARCHAR(400),
  MINOR_NAME             VARCHAR(1280),
  REPRESENT_MINOR_NAME   VARCHAR(1280),
  SUB_CODE               VARCHAR(400),
  REPRESENT_SUB_CODE     VARCHAR(400),
  SUB_NAME               VARCHAR(1280),
  REPRESENT_SUB_NAME     VARCHAR(1280),
  BRAND_CODE             VARCHAR(21),
  BRAND_NAME             VARCHAR(200),
  CREATED_AT             TIMESTAMP_NTZ,
  CREATED_BY             VARCHAR(10),
  UPDATED_AT             TIMESTAMP_NTZ,
  UPDATED_BY             VARCHAR(10)
);

-- NOTE: Item generation uses STAGING.CATEGORY_HIERARCHY_DS, CATEGORY_FULL_DS, MAKERS tables
-- which contain the PPIH product category hierarchy (7 MDs, 43 majors, 239+ middles, 17000 subs)
-- and 1500 synthetic maker names. See the category hierarchy INSERT statements
-- in the query history for the full data.
-- The actual INSERT uses GENERATOR(ROWCOUNT => 4300000) for DS items
-- and GENERATOR(ROWCOUNT => 2700000) for UNY items.

-- ============================================================
-- STEP 3: Members Master (20,000,000 majica cardholders)
-- ============================================================
CREATE OR REPLACE TABLE PPIH_FULL_DB.MASTER.DATAMART_COMMON_MEMBERS (
  MAJICA_NO       VARCHAR(16777216),
  MEMBER_NAME     VARCHAR(7),
  GENDER          VARCHAR(2),
  BIRTH_DATE      DATE,
  AGE_GROUP       VARCHAR(5),
  MEMBER_RANK     VARCHAR(4),
  REGISTERED_AT   TIMESTAMP_LTZ,
  CREATED_AT      TIMESTAMP_LTZ,
  CREATED_BY      VARCHAR(5),
  UPDATED_AT      TIMESTAMP_LTZ,
  UPDATED_BY      VARCHAR(5)
);

-- Generate 20M members
INSERT INTO PPIH_FULL_DB.MASTER.DATAMART_COMMON_MEMBERS
SELECT
  LPAD((6600000000000000 + SEQ4())::VARCHAR, 16, '0') AS MAJICA_NO,
  CASE MOD(SEQ4(), 2) WHEN 0 THEN '会員' ELSE '会員' END AS MEMBER_NAME,
  CASE WHEN UNIFORM(1,100,RANDOM()) <= 55 THEN '女性' ELSE '男性' END AS GENDER,
  DATEADD(day, -UNIFORM(6570, 29200, RANDOM()), CURRENT_DATE()) AS BIRTH_DATE,
  CASE
    WHEN DATEDIFF(year, DATEADD(day, -UNIFORM(6570, 29200, RANDOM()), CURRENT_DATE()), CURRENT_DATE()) < 20 THEN '10代'
    WHEN DATEDIFF(year, DATEADD(day, -UNIFORM(6570, 29200, RANDOM()), CURRENT_DATE()), CURRENT_DATE()) < 30 THEN '20代'
    WHEN DATEDIFF(year, DATEADD(day, -UNIFORM(6570, 29200, RANDOM()), CURRENT_DATE()), CURRENT_DATE()) < 40 THEN '30代'
    WHEN DATEDIFF(year, DATEADD(day, -UNIFORM(6570, 29200, RANDOM()), CURRENT_DATE()), CURRENT_DATE()) < 50 THEN '40代'
    WHEN DATEDIFF(year, DATEADD(day, -UNIFORM(6570, 29200, RANDOM()), CURRENT_DATE()), CURRENT_DATE()) < 60 THEN '50代'
    WHEN DATEDIFF(year, DATEADD(day, -UNIFORM(6570, 29200, RANDOM()), CURRENT_DATE()), CURRENT_DATE()) < 70 THEN '60代'
    ELSE '70代以上'
  END AS AGE_GROUP,
  CASE
    WHEN UNIFORM(1,100,RANDOM()) <= 40 THEN '一般'
    WHEN UNIFORM(1,100,RANDOM()) <= 65 THEN 'ビギナー'
    WHEN UNIFORM(1,100,RANDOM()) <= 80 THEN 'ブロンズ'
    WHEN UNIFORM(1,100,RANDOM()) <= 90 THEN 'シルバー'
    WHEN UNIFORM(1,100,RANDOM()) <= 97 THEN 'ゴールド'
    ELSE 'プラチナ'
  END AS MEMBER_RANK,
  DATEADD(day, -UNIFORM(30, 2555, RANDOM()), CURRENT_TIMESTAMP()) AS REGISTERED_AT,
  CURRENT_TIMESTAMP() AS CREATED_AT,
  'BATCH' AS CREATED_BY,
  CURRENT_TIMESTAMP() AS UPDATED_AT,
  'BATCH' AS UPDATED_BY
FROM TABLE(GENERATOR(ROWCOUNT => 20000000));

-- ============================================================
-- STEP 4: Transaction Table (9.1 billion rows)
-- ============================================================
CREATE OR REPLACE TABLE PPIH_FULL_DB.ANALYTICS.TABLEAU_I_ABC_TRADE (
  BUSINESS_DATE        DATE            NOT NULL,
  STORE_CODE           VARCHAR(20)     NOT NULL,
  TRADE_KEY            VARCHAR(437),
  MAJICA_NO            VARCHAR(320),
  ITEM_CODE            VARCHAR(56)     NOT NULL,
  ITEM_SALES_QUANTITY  NUMERIC(38,4),
  ITEM_SALES_AMOUNT    NUMERIC(38,4),
  TRADE_CLASS_3        VARCHAR(320),
  CREATED_AT           TIMESTAMP_NTZ,
  CREATED_BY           VARCHAR(10),
  UPDATED_AT           TIMESTAMP_NTZ,
  UPDATED_BY           VARCHAR(10)
) CLUSTER BY (BUSINESS_DATE);

-- Lookup tables for generation
CREATE OR REPLACE TABLE PPIH_FULL_DB.STAGING.STORE_LOOKUP AS
SELECT STORE_CODE, ROW_NUMBER() OVER (ORDER BY STORE_CODE) AS store_seq
FROM PPIH_FULL_DB.MASTER.DATAMART_COMMON_STORES;

CREATE OR REPLACE TABLE PPIH_FULL_DB.STAGING.ITEM_LOOKUP AS
SELECT ITEM_CODE, ROW_NUMBER() OVER (ORDER BY ITEM_CODE) AS item_seq
FROM PPIH_FULL_DB.MASTER.DATAMART_COMMON_ITEMS SAMPLE (100000 ROWS);

-- Transaction generation procedure (365 days × 11,909,542 rows/day)
CREATE OR REPLACE PROCEDURE PPIH_FULL_DB.STAGING.GENERATE_IDPOS_V3()
RETURNS VARCHAR
LANGUAGE SQL
EXECUTE AS CALLER
AS $$
BEGIN
  LET v_start_date DATE := '2025-07-01';
  LET v_daily_rows INTEGER := 11909542;
  LET v_current_date DATE := '2025-07-01';
  LET v_i INTEGER := 0;
  LET v_date_str VARCHAR := '';

  WHILE (:v_i < 365) DO
    v_current_date := DATEADD('day', :v_i, :v_start_date);
    v_date_str := TO_CHAR(:v_current_date, 'YYYYMMDD');

    INSERT INTO PPIH_FULL_DB.ANALYTICS.TABLEAU_I_ABC_TRADE
    SELECT
      :v_current_date AS BUSINESS_DATE,
      'S' || LPAD((MOD(SEQ4(), 842) + 1)::VARCHAR, 5, '0') AS STORE_CODE,
      'S' || LPAD((MOD(SEQ4(), 842) + 1)::VARCHAR, 5, '0') || :v_date_str || LPAD((SEQ4()+1)::VARCHAR, 8, '0') AS TRADE_KEY,
      CASE WHEN UNIFORM(1, 100, RANDOM()) <= 54
        THEN LPAD((6600000000000000 + UNIFORM(0, 4999999, RANDOM()))::VARCHAR, 16, '0')
        ELSE NULL
      END AS MAJICA_NO,
      CASE WHEN UNIFORM(1, 100, RANDOM()) <= 61
        THEN '490' || LPAD((MOD(SEQ4(), 4300000) + 1)::VARCHAR, 10, '0')
        ELSE '491' || LPAD((4300001 + MOD(SEQ4(), 2700000))::VARCHAR, 10, '0')
      END AS ITEM_CODE,
      CASE WHEN UNIFORM(1, 100, RANDOM()) <= 80
        THEN UNIFORM(1, 5, RANDOM())::NUMERIC(38,4)
        ELSE UNIFORM(6, 20, RANDOM())::NUMERIC(38,4)
      END AS ITEM_SALES_QUANTITY,
      UNIFORM(50, 5000, RANDOM())::NUMERIC(38,4) AS ITEM_SALES_AMOUNT,
      CASE
        WHEN UNIFORM(1, 100, RANDOM()) <= 95 THEN '売上'
        WHEN UNIFORM(1, 100, RANDOM()) <= 60 THEN '返品'
        ELSE '値引'
      END AS TRADE_CLASS_3,
      CURRENT_TIMESTAMP() AS CREATED_AT,
      'BATCH' AS CREATED_BY,
      CURRENT_TIMESTAMP() AS UPDATED_AT,
      'BATCH' AS UPDATED_BY
    FROM TABLE(GENERATOR(ROWCOUNT => :v_daily_rows));

    v_i := :v_i + 1;
  END WHILE;

  RETURN 'Done. Total days: ' || :v_i::VARCHAR;
END;
$$;

-- Execute: CALL PPIH_FULL_DB.STAGING.GENERATE_IDPOS_V3();
-- Takes ~30 min on XL warehouse

-- ============================================================
-- STEP 5: Second year of data (adds ~4.3B more rows for 2-year total)
-- ============================================================
-- Duplicate the procedure call with v_start_date := '2024-07-01' for prior year data

-- ============================================================
-- STEP 6: APP_CONFIG tables (for admin UI)
-- ============================================================
-- Small config tables for the admin section of the app
-- (accounts, users, credit_usage - see APP_CONFIG schema)

-- ============================================================
-- STEP 7: Semantic View & Agent
-- ============================================================
CREATE OR REPLACE SEMANTIC VIEW PPIH_FULL_DB.ANALYTICS.DATACOMPASS_ANALYTICS
  TABLES (
    PPIH_FULL_DB.ANALYTICS.TABLEAU_I_ABC_TRADE,
    PPIH_FULL_DB.MASTER.DATAMART_COMMON_STORES PRIMARY KEY (STORE_CODE),
    PPIH_FULL_DB.MASTER.DATAMART_COMMON_ITEMS PRIMARY KEY (ITEM_CODE),
    PPIH_FULL_DB.MASTER.DATAMART_COMMON_MEMBERS PRIMARY KEY (MAJICA_NO)
  )
  RELATIONSHIPS (
    TRADE_TO_STORES AS TABLEAU_I_ABC_TRADE(STORE_CODE) REFERENCES DATAMART_COMMON_STORES(STORE_CODE),
    TRADE_TO_ITEMS AS TABLEAU_I_ABC_TRADE(ITEM_CODE) REFERENCES DATAMART_COMMON_ITEMS(ITEM_CODE),
    TRADE_TO_MEMBERS AS TABLEAU_I_ABC_TRADE(MAJICA_NO) REFERENCES DATAMART_COMMON_MEMBERS(MAJICA_NO)
  )
  FACTS (
    TABLEAU_I_ABC_TRADE.ITEM_SALES_QUANTITY AS ITEM_SALES_QUANTITY,
    TABLEAU_I_ABC_TRADE.ITEM_SALES_AMOUNT AS ITEM_SALES_AMOUNT
  )
  DIMENSIONS (
    TABLEAU_I_ABC_TRADE.BUSINESS_DATE AS BUSINESS_DATE,
    TABLEAU_I_ABC_TRADE.STORE_CODE AS STORE_CODE,
    TABLEAU_I_ABC_TRADE.TRADE_KEY AS TRADE_KEY,
    TABLEAU_I_ABC_TRADE.MAJICA_NO AS MAJICA_NO,
    TABLEAU_I_ABC_TRADE.ITEM_CODE AS ITEM_CODE,
    TABLEAU_I_ABC_TRADE.TRADE_CLASS_3 AS TRADE_CLASS_3,
    DATAMART_COMMON_STORES.STORE_NAME AS STORE_NAME,
    DATAMART_COMMON_STORES.CORPORATION_CODE AS CORPORATION_CODE,
    DATAMART_COMMON_STORES.CORPORATION_NAME AS CORPORATION_NAME,
    DATAMART_COMMON_STORES.PREFECTURE_CODE AS PREFECTURE_CODE,
    DATAMART_COMMON_STORES.PREFECTURE_NAME AS PREFECTURE_NAME,
    DATAMART_COMMON_STORES.BUSINESS_TYPE_CODE AS BUSINESS_TYPE_CODE,
    DATAMART_COMMON_STORES.BUSINESS_TYPE_NAME AS BUSINESS_TYPE_NAME,
    DATAMART_COMMON_STORES.AREA_CODE AS AREA_CODE,
    DATAMART_COMMON_STORES.AREA_NAME AS AREA_NAME,
    DATAMART_COMMON_ITEMS.ITEM_NAME AS ITEM_NAME,
    DATAMART_COMMON_ITEMS.MAKER_CODE AS MAKER_CODE,
    DATAMART_COMMON_ITEMS.MAKER_NAME AS MAKER_NAME,
    DATAMART_COMMON_ITEMS.MAJOR_CODE AS MAJOR_CODE,
    DATAMART_COMMON_ITEMS.MAJOR_NAME AS MAJOR_NAME,
    DATAMART_COMMON_ITEMS.MIDDLE_CODE AS MIDDLE_CODE,
    DATAMART_COMMON_ITEMS.MIDDLE_NAME AS MIDDLE_NAME,
    DATAMART_COMMON_ITEMS.MINOR_CODE AS MINOR_CODE,
    DATAMART_COMMON_ITEMS.MINOR_NAME AS MINOR_NAME,
    DATAMART_COMMON_ITEMS.BRAND_CODE AS BRAND_CODE,
    DATAMART_COMMON_ITEMS.BRAND_NAME AS BRAND_NAME,
    DATAMART_COMMON_MEMBERS.GENDER AS GENDER,
    DATAMART_COMMON_MEMBERS.AGE_GROUP AS AGE_GROUP,
    DATAMART_COMMON_MEMBERS.MEMBER_RANK AS MEMBER_RANK,
    DATAMART_COMMON_MEMBERS.BIRTH_DATE AS BIRTH_DATE
  )
  COMMENT = 'PPIH本番データの売上分析モデル。取引データ（91億行）を店舗・商品・会員マスタと結合し、多角的な売上分析を可能にする。';

CREATE OR REPLACE AGENT PPIH_FULL_DB.ANALYTICS.DATACOMPASS_AGENT
  COMMENT = 'PPIH本番データを自然言語で分析するエージェント'
  PROFILE = '{"display_name":"DataCompass分析エージェント","avatar":"📊","color":"#1E88E5"}'
  FROM SPECIFICATION
  $$
  models:
    orchestration: auto
  instructions:
    response: |
      回答は日本語で行ってください。
      数値は見やすくフォーマットし、分析結果には簡潔な考察も添えてください。
    orchestration: |
      売上・取引・店舗・商品・会員に関する質問にはdatacompass_analyst toolを使用してください。
    sample_questions:
      - question: "店舗別売上ランキングを教えて"
      - question: "ブランド別の売上と販売数量は？"
      - question: "年代・性別ごとの購買傾向は？"
      - question: "売上上位10商品を教えて"
  tools:
    - tool_spec:
        type: "cortex_analyst_text_to_sql"
        name: "datacompass_analyst"
        description: "PPIHグループのID-POS取引・店舗・商品・会員データを分析するためのツール"
    - tool_spec:
        type: "data_to_chart"
        name: "data_to_chart"
        description: "データからチャートやグラフを生成するツール"
  tool_resources:
    datacompass_analyst:
      semantic_view: "PPIH_FULL_DB.ANALYTICS.DATACOMPASS_ANALYTICS"
      execution_environment:
        type: "warehouse"
        warehouse: "COMPUTE_WH"
  $$;

-- ============================================================
-- STEP 8: Performance Optimization
-- ============================================================

-- 8-1: Clustering key optimization
-- Compound key: BUSINESS_DATE (range scan) + STORE_CODE (IN filter)
ALTER TABLE PPIH_FULL_DB.ANALYTICS.TABLEAU_I_ABC_TRADE
  CLUSTER BY (BUSINESS_DATE, STORE_CODE);

-- Dimension tables: cluster by JOIN keys
ALTER TABLE PPIH_FULL_DB.MASTER.DATAMART_COMMON_ITEMS
  CLUSTER BY (ITEM_CODE);
ALTER TABLE PPIH_FULL_DB.MASTER.DATAMART_COMMON_MEMBERS
  CLUSTER BY (MAJICA_NO);

-- 8-2: Dynamic Tables (pre-aggregation layer)
-- DT1: Daily × Store summary (serves trend API directly)
CREATE OR REPLACE DYNAMIC TABLE PPIH_FULL_DB.ANALYTICS.DT_DAILY_STORE_SUMMARY
  TARGET_LAG = '1 hour'
  WAREHOUSE = COMPUTE_WH
AS
SELECT
  t.BUSINESS_DATE,
  t.STORE_CODE,
  t.TRADE_CLASS_3,
  SUM(t.ITEM_SALES_AMOUNT) AS TOTAL_SALES_AMOUNT,
  SUM(t.ITEM_SALES_QUANTITY) AS TOTAL_SALES_QUANTITY,
  COUNT(DISTINCT t.TRADE_KEY) AS RECEIPT_COUNT,
  COUNT(DISTINCT t.MAJICA_NO) AS MEMBER_COUNT
FROM PPIH_FULL_DB.ANALYTICS.TABLEAU_I_ABC_TRADE t
GROUP BY t.BUSINESS_DATE, t.STORE_CODE, t.TRADE_CLASS_3;

-- DT2: Daily × Store × Major category summary (serves ABC for md/major units)
CREATE OR REPLACE DYNAMIC TABLE PPIH_FULL_DB.ANALYTICS.DT_DAILY_MAJOR_STORE
  TARGET_LAG = '1 hour'
  REFRESH_MODE = INCREMENTAL
  WAREHOUSE = COMPUTE_WH
AS
SELECT
  t.BUSINESS_DATE,
  t.STORE_CODE,
  t.TRADE_CLASS_3,
  i.MD_CODE, i.MD_NAME,
  i.MAJOR_CODE, i.MAJOR_NAME,
  SUM(t.ITEM_SALES_AMOUNT) AS TOTAL_SALES_AMOUNT,
  SUM(t.ITEM_SALES_QUANTITY) AS TOTAL_SALES_QUANTITY,
  COUNT(DISTINCT t.TRADE_KEY) AS RECEIPT_COUNT,
  COUNT(DISTINCT t.MAJICA_NO) AS MEMBER_COUNT
FROM PPIH_FULL_DB.ANALYTICS.TABLEAU_I_ABC_TRADE t
JOIN PPIH_FULL_DB.MASTER.DATAMART_COMMON_ITEMS i ON i.ITEM_CODE = t.ITEM_CODE
GROUP BY t.BUSINESS_DATE, t.STORE_CODE, t.TRADE_CLASS_3,
         i.MD_CODE, i.MD_NAME, i.MAJOR_CODE, i.MAJOR_NAME;

-- DT2b: Daily × Store × Middle category summary (serves ABC for middle unit)
CREATE OR REPLACE DYNAMIC TABLE PPIH_FULL_DB.ANALYTICS.DT_DAILY_MIDDLE_STORE
  TARGET_LAG = '1 hour'
  REFRESH_MODE = INCREMENTAL
  WAREHOUSE = COMPUTE_WH
AS
SELECT
  t.BUSINESS_DATE,
  t.STORE_CODE,
  t.TRADE_CLASS_3,
  i.MD_CODE, i.MD_NAME,
  i.MAJOR_CODE, i.MAJOR_NAME,
  i.MIDDLE_CODE, i.MIDDLE_NAME,
  SUM(t.ITEM_SALES_AMOUNT) AS TOTAL_SALES_AMOUNT,
  SUM(t.ITEM_SALES_QUANTITY) AS TOTAL_SALES_QUANTITY,
  COUNT(DISTINCT t.TRADE_KEY) AS RECEIPT_COUNT,
  COUNT(DISTINCT t.MAJICA_NO) AS MEMBER_COUNT
FROM PPIH_FULL_DB.ANALYTICS.TABLEAU_I_ABC_TRADE t
JOIN PPIH_FULL_DB.MASTER.DATAMART_COMMON_ITEMS i ON i.ITEM_CODE = t.ITEM_CODE
GROUP BY t.BUSINESS_DATE, t.STORE_CODE, t.TRADE_CLASS_3,
         i.MD_CODE, i.MD_NAME, i.MAJOR_CODE, i.MAJOR_NAME,
         i.MIDDLE_CODE, i.MIDDLE_NAME;

-- DT3: Member daily purchase summary (serves profiling and switching)
CREATE OR REPLACE DYNAMIC TABLE PPIH_FULL_DB.ANALYTICS.DT_MEMBER_DAILY_PURCHASE
  TARGET_LAG = '1 hour'
  WAREHOUSE = COMPUTE_WH
AS
SELECT
  t.MAJICA_NO,
  t.BUSINESS_DATE,
  t.STORE_CODE,
  COUNT(DISTINCT t.TRADE_KEY) AS DAILY_RECEIPTS,
  SUM(t.ITEM_SALES_AMOUNT) AS DAILY_SALES,
  SUM(t.ITEM_SALES_QUANTITY) AS DAILY_QUANTITY
FROM PPIH_FULL_DB.ANALYTICS.TABLEAU_I_ABC_TRADE t
WHERE t.MAJICA_NO IS NOT NULL
GROUP BY t.MAJICA_NO, t.BUSINESS_DATE, t.STORE_CODE;

-- 8-3: Query Acceleration Service
ALTER WAREHOUSE COMPUTE_WH SET
  ENABLE_QUERY_ACCELERATION = TRUE
  QUERY_ACCELERATION_MAX_SCALE_FACTOR = 8;

-- 8-4: Search Optimization Service on ITEM_CODE (high-cardinality point lookups)
ALTER TABLE PPIH_FULL_DB.ANALYTICS.TABLEAU_I_ABC_TRADE
  ADD SEARCH OPTIMIZATION ON EQUALITY(ITEM_CODE);
