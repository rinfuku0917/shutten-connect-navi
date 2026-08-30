-- 書類をいつ承認・否認したかを残す。
-- 提出日（uploaded_at）は再提出のたびに新しくなるため、
-- 「いつ出されて、いつこちらが確認したか」が分かるようにする。

alter table public.seller_documents
  add column if not exists reviewed_at timestamptz;

comment on column public.seller_documents.reviewed_at is '承認・否認した日時';
