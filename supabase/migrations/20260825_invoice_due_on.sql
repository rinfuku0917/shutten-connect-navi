-- 請求書の振込期限（お支払期限）。発行時に管理者が指定した日付を残す。
-- 過去の請求書を再表示・再印刷したときに同じ期限が出るようにするため。

alter table public.invoices
  add column if not exists due_on date;

comment on column public.invoices.due_on is '振込期限。発行時に管理者が指定する';
