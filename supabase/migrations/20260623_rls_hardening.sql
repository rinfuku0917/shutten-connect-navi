-- ============================================================
-- RLS Hardening Migration (2026-06-23)
-- applications / messages / places のRLSが無効だった問題を修正し、
-- 管理者(admin)が全データを閲覧・操作できるようポリシーを追加。
-- ============================================================

-- 1) RLS有効化（これらは以前 disabled だった）
alter table public.applications enable row level security;
alter table public.messages     enable row level security;
alter table public.places       enable row level security;

-- 2) 管理者判定関数（SECURITY DEFINERで再帰を防ぐ）
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- 3) 管理者の全件SELECTポリシー
create policy "admin reads all applications" on public.applications
  for select using (public.is_admin());
create policy "admin reads all messages" on public.messages
  for select using (public.is_admin());
create policy "admin reads all places" on public.places
  for select using (public.is_admin());
create policy "admin reads all profiles" on public.profiles
  for select using (public.is_admin());
create policy "admin reads all seller_documents" on public.seller_documents
  for select using (public.is_admin());

-- 4) メッセージ既読化(UPDATE)用ポリシー
--    管理者は全件、一般ユーザーは自分が関わる申込のメッセージを更新可
create policy "admin updates all messages" on public.messages
  for update using (public.is_admin());

create policy "users update own thread messages" on public.messages
  for update using (
    application_id in (
      select a.id from public.applications a
      where a.seller_id = auth.uid()
    )
    or
    application_id in (
      select a.id from public.applications a
      join public.places p on p.id = a.place_id
      where p.host_id = auth.uid()
    )
  );
