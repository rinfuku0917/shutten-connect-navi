-- 平日と土日祝で出店料が変わる案件に対応する。
--
-- Olympic各店のように「平日3,000円・週末4,500円」と決まっている
-- 常設案件があるが、日程を持たないため日ごとの金額を入れられなかった。
-- 曜日（と祝日）から自動で使い分けられるようにする。
--
-- 形: {"weekday":{"placeFee":0,"companyFee":3000},
--      "weekend":{"placeFee":0,"companyFee":4500}}
--   placeFee   … 取引先へ渡す額
--   companyFee … 弊社の利益
-- 未設定なら、これまでどおり案件全体の固定額を使う。
--
-- 金額の優先順位は次のとおり。
--   1. 日程に入れたその日の金額（places.schedule）
--   2. ここで決めた平日／土日祝の金額
--   3. 案件全体の固定額

alter table public.places
  add column if not exists day_type_fees jsonb;

comment on column public.places.day_type_fees is '平日・土日祝ごとの出店料 {"weekday":{placeFee,companyFee},"weekend":{...}}';
