-- 出店者への請求書。発行のたびに番号を採番し、二重発行を防ぐために記録する。
-- 番号は「年-4桁連番」（例: 2026-0042）。既に 2026-0041 まで発行済みのため、
-- 2026年分は 42 から始まるように運用する。
--
-- 参照はすべて管理者用のAPI（サービスロール）経由で行うため、
-- RLS を有効にしたうえでポリシーは作らない（＝クライアントからは読めない）。

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_no text not null unique,           -- 例: 2026-0042
  seller_id uuid not null,                   -- 請求先の出店者
  period text not null,                      -- 対象月（例: 2026-07）
  issued_on date not null default current_date,
  subtotal integer not null default 0,       -- 小計（税抜）
  tax integer not null default 0,            -- 消費税10%
  total integer not null default 0,          -- 税込合計
  item_count integer not null default 0,     -- 明細の件数
  sale_ids uuid[],                           -- 対象にした売上記録
  created_at timestamptz not null default now()
);

create index if not exists invoices_seller_period_idx on public.invoices (seller_id, period);

alter table public.invoices enable row level security;

comment on table public.invoices is '出店者への請求書。番号の採番と発行済みの記録に使う（参照は管理者APIのみ）';
