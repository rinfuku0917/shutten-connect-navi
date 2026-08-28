-- 出店後の「出店報告」に必要な項目と、報告忘れリマインドのための列を追加する。
--
-- 1) sales.items
--    施設・企業から「何が何食売れたか」を求められることがあるため、
--    品目ごとの販売食数を記録できるようにする。
--    形: [{"name":"唐揚げ弁当","qty":12,"price":800}, ...]
--      name  … 品目名
--      qty   … 食数（売れた数）
--      price … 単価（円・任意）
--
-- 2) sales.weather / sales.customers / sales.note
--    企業への報告でよく求められる、当日の状況。いずれも任意。
--      weather   … 天候（晴れ・くもり・雨・雪）
--      customers … 来客数・接客数
--      note      … 所感・特記事項（次回に活かす気づきなど）
--
-- 3) applications.sales_reminded_at
--    出店日を過ぎても売上報告が無い出店者へ、リマインドのメールを送る。
--    同じ申込に何度も送らないよう、送った日時を覚えておく。

alter table public.sales
  add column if not exists items jsonb,
  add column if not exists weather text,
  add column if not exists customers integer,
  add column if not exists note text;

comment on column public.sales.items is '品目ごとの販売食数 [{name, qty, price}]（任意）';
comment on column public.sales.weather is '当日の天候（任意）';
comment on column public.sales.customers is '来客数・接客数（任意）';
comment on column public.sales.note is '所感・特記事項（任意）';

alter table public.applications
  add column if not exists sales_reminded_at timestamptz;

comment on column public.applications.sales_reminded_at is '売上報告リマインドを送った日時（未送信は null）';
