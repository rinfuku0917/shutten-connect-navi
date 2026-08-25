-- 請求書を管理画面で修正できるようにするための列。
-- 明細の文言や金額、宛先、備考を手直しした場合に、その内容を保存して
-- 次に開いたときも同じ請求書が再現されるようにする。
-- 保存が無い場合は、これまでどおり売上データから自動で組み立てる。

alter table public.invoices
  add column if not exists items jsonb,        -- 明細（修正後の内容）
  add column if not exists to_name text,       -- 宛先の店舗名
  add column if not exists to_person text,     -- 宛先の担当者名
  add column if not exists note text;          -- 備考

comment on column public.invoices.items is '明細の内容。管理画面で修正した場合に保存する（未保存なら売上から自動生成）';
comment on column public.invoices.to_name is '宛先の店舗名。修正した場合に保存する';
comment on column public.invoices.to_person is '宛先の担当者名。修正した場合に保存する';
comment on column public.invoices.note is '備考。修正した場合に保存する';
