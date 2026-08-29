-- 出店料の入金状況を記録できるようにする。
--
-- これまで請求書を発行したあとの流れ（振り込まれたかどうか）は
-- システムの外で管理していたため、入金の確認漏れや二重の督促が起きていた。
--
-- 状態の流れ:
--   unpaid    … 発行しただけ（未入金）
--   reported  … 出店者が「振り込みました」と報告した
--   paid      … 運営が入金を確認した
--
-- 出店者は自分の請求書だけを見る必要があるが、invoices は RLS でクライアント
-- から読めないようにしてある（管理者APIのみ）。出店者向けにも専用のAPIを用意し、
-- ログイン中の本人の請求書だけを返す。

alter table public.invoices
  add column if not exists paid_status text not null default 'unpaid',
  add column if not exists paid_reported_at timestamptz,  -- 出店者が振込を報告した日時
  add column if not exists paid_on date,                  -- 振り込んだ日（出店者の申告）
  add column if not exists paid_name text,                -- 振込名義（通帳と付き合わせる用）
  add column if not exists paid_confirmed_at timestamptz, -- 運営が入金を確認した日時
  add column if not exists paid_memo text;                -- 運営のメモ

comment on column public.invoices.paid_status is 'unpaid（未入金）/ reported（出店者が振込報告）/ paid（入金確認済み）';
comment on column public.invoices.paid_on is '振り込んだ日（出店者の申告）';
comment on column public.invoices.paid_name is '振込名義。通帳と突き合わせるために受け取る';

create index if not exists invoices_paid_status_idx on public.invoices (paid_status, issued_on desc);
