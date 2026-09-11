-- 「何を見て知ったか」を、新規登録のときに記録する。
--
-- なぜ要るか:
--   どの入口から来た方なのかが分からないため、どこに手をかけるべきかの
--   判断ができない。検索から来ているのか、公式LINEなのか、営業で取れた方なのか。
--   登録の画面で1つ選んでもらって残す。
--
-- なぜ profiles ではなく別の表か:
--   登録の直後はまだメールの確認が済んでおらず、本人としてログインできない。
--   profiles の行を作っているのは Supabase 側のトリガーで、
--   このリポジトリからは中身を変えられない（マイグレーションに無い）。
--   そこで、登録の通知を受ける API（サービスロール）から書ける別の表に残す。
--   あとで profiles と突き合わせられるよう、メールアドレスも持つ。
--
-- 参照・登録は管理者用のAPI（サービスロール）経由のみ。
-- メールアドレスが入るため、RLS を有効にしてポリシーは作らない。

create table if not exists public.signup_sources (
  id         uuid primary key default gen_random_uuid(),
  -- 'seller'（出店したい）/ 'host'（お店を呼びたい）
  role       text,
  name       text,
  email      text,
  -- 選んでもらった入口。値は app/lib/signupSource.ts の一覧と合わせる
  found_via  text,
  -- 「その他」を選んだときの記述、または補足
  found_note text,
  created_at timestamptz not null default now()
);

create index if not exists signup_sources_created_idx on public.signup_sources (created_at desc);
create index if not exists signup_sources_via_idx on public.signup_sources (found_via);

alter table public.signup_sources enable row level security;

comment on table public.signup_sources is '新規登録で選ばれた「何を見て知ったか」（参照・登録は管理者APIのみ）';

-- 確認
--   select count(*) as ポリシー数 from pg_policies where tablename = 'signup_sources';
--   → 0 なら想定どおり
