-- 売上報告で「8%対象の商品」と「10%対象の商品」を分けて入力できるようにする。
-- 例：フードは軽減税率8%、ビールや物販は10% といった混在イベントに対応するため。
--
-- どちらも任意入力。分けずに入力した場合は NULL のままで、
-- 従来どおり sales.revenue と tax_basis / tax_rate だけで計算する。
-- 既存の記録には影響しない。

alter table public.sales
  add column if not exists revenue_reduced integer,   -- 8%（軽減税率）対象の売上
  add column if not exists revenue_standard integer;  -- 10%（標準税率）対象の売上

comment on column public.sales.revenue_reduced is '8%（軽減税率）対象の売上。税率ごとに分けて入力したときのみ入る。合計は revenue と一致する';
comment on column public.sales.revenue_standard is '10%（標準税率）対象の売上。税率ごとに分けて入力したときのみ入る。合計は revenue と一致する';
