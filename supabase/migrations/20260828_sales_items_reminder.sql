-- 売上報告の品目別内訳と、報告忘れリマインドのための列を追加する。
--
-- 1) sales.items
--    施設・企業から「何が何食売れたか」を求められることがあるため、
--    売上報告のときに品目別の内訳（任意）を付けられるようにする。
--    形: [{"name":"唐揚げ弁当","qty":12,"price":800}, ...]
--      name  … 品目名
--      qty   … 食数（売れた数）
--      price … 単価（円・任意）
--
-- 2) applications.sales_reminded_at
--    出店日を過ぎても売上報告が無い出店者へ、リマインドのメールを送る。
--    同じ申込に何度も送らないよう、送った日時を覚えておく。

alter table public.sales
  add column if not exists items jsonb;

comment on column public.sales.items is '品目別の内訳 [{name, qty, price}]（任意）';

alter table public.applications
  add column if not exists sales_reminded_at timestamptz;

comment on column public.applications.sales_reminded_at is '売上報告リマインドを送った日時（未送信は null）';
