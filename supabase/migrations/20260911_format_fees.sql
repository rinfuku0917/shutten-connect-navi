-- 出店の形態（キッチンカー・物販・催事PR）ごとの出店料と条件。
--
-- なぜ要るか:
--   出店料の設定が案件に1組しかなく、キッチンカーの金額しか入れられなかった。
--   物販や催事PRは金額が違うため、概要欄に文章で書いて運用していた。
--   文章だと出店者が見落とすうえ、売上の計算にも反映されないため、
--   請求のたびに運営が手で直すことになる。
--
--   形態ごとに金額と条件を持てるようにする。
--
-- 形:
--   {
--     "キッチンカー": {
--       "placeFee": 0,          取引先へ渡す固定額（円）
--       "companyFee": 3000,     弊社の固定額（円）
--       "sharePct": 0,          取引先の歩合（売上の%）
--       "companySharePct": 10,  弊社の歩合（売上の%）
--       "note": "3m×5m・電源あり", 区画の条件（画面にそのまま出す）
--       "dows": [0, 6]          出られる曜日。空なら案件の日程すべて
--     },
--     "物販": { ... },
--     "催事PR": { ... }
--   }
--
--   ここに入っている形態だけが、申込の選択肢に出る。
--   未設定（null）の案件はこれまでどおり全部の形態を選べて、
--   金額も案件全体の設定を使う。既存の案件を触らずに済ませるため。
--
-- 金額の優先順位（app/lib/placeFee.ts と合わせる）:
--   1. 日程に入れたその日の金額（places.schedule）
--   2. この形態別の金額
--   3. 平日／土日祝の金額（places.day_type_fees）
--   4. 案件全体の固定額

alter table public.places
  add column if not exists format_fees jsonb;

comment on column public.places.format_fees is
  '形態ごとの出店料と条件 {"キッチンカー":{placeFee,companyFee,sharePct,companySharePct,note,dows},...}';

-- 確認
--   select count(*) from public.places where format_fees is not null;
--   → 0 から始まる（設定した案件だけ増える）
