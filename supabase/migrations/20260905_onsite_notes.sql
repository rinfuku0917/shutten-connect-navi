-- 出店管理スケジュールの、現場メモを置く場所。
--
-- 運営がカレンダーから出店枠を開いて、その日その現場のことを書き残す。
-- 「搬入口は北側」「担当者は○○さん」「今回は雨だったので早じまい」など、
-- 次に同じ現場へ行くときに効いてくる情報を貯めるためのもの。
--
-- ★ applications に列を足す形にはしない。
--    募集者は自分の案件の applications を update できる
--    （app/dashboard/host/page.tsx で実際に更新している）。
--    出店者も自分の申込を読める。
--    つまり applications に運営メモの列を作ると、
--    募集者に読まれ、書き換えられ、出店者にも見える。
--    「運営だけが見る現場メモ」として成り立たない。
--    20260904_application_cancel.sql にも同じ趣旨のコメントがある。
--
-- 読み書きは管理者用のAPI（サービスロール）を通す。
-- meeting_requests と同じ方針で、RLS は有効にしたうえでポリシーを作らない。
-- ポリシーが無い＝ブラウザからは一切触れない、ということ。

create table if not exists public.onsite_notes (
  id uuid primary key default gen_random_uuid(),

  -- どの出店枠へのメモか。申込が消えたらメモも消す
  application_id uuid not null references public.applications(id) on delete cascade,

  body text not null,

  -- 誰が書いたか。運営の担当者が複数いるため残す。
  -- 書いた人の登録が消えても、メモ自体は残したいので on delete set null
  author_id uuid references public.profiles(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.onsite_notes is
  '出店枠ごとの現場メモ。運営だけが読み書きする。管理者用APIを通してのみ触れる';
comment on column public.onsite_notes.application_id is
  '対象の申込（＝1つの出店枠）。案件×出店者×出店日で1つ';
comment on column public.onsite_notes.author_id is
  '書いた運営担当者。退職などで登録が消えてもメモは残す';

-- カレンダーから「この出店枠のメモ」を引くための索引
create index if not exists onsite_notes_application_idx
  on public.onsite_notes (application_id, created_at desc);

alter table public.onsite_notes enable row level security;

-- ポリシーは作らない。
-- RLS を有効にしてポリシーが無い状態＝anon・authenticated からは読めも書けもしない。
-- サービスロールは RLS を迂回するので、管理者用APIからだけ触れる。
-- （meeting_requests と同じ作り。20260825_meeting_requests.sql 参照）

-- 更新日時を自動で追う
create or replace function public.touch_onsite_notes()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists onsite_notes_touch on public.onsite_notes;
create trigger onsite_notes_touch
  before update on public.onsite_notes
  for each row
  execute function public.touch_onsite_notes();

-- 入ったことの確認
select
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'onsite_notes') as 列の数,
  (select relrowsecurity from pg_class where relname = 'onsite_notes')  as RLSが有効か,
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'onsite_notes')     as ポリシーの数;
