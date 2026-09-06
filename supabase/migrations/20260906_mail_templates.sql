-- 送信メールの文面を、運営が画面から書き換えられるようにする。
--
-- いまは10本のAPIそれぞれに件名も本文もコードで固定されており、
-- 文言を変えるたびにコードを直して出し直す必要がある。
-- 「請求対応や、出店者へのメールの文面を編集したい」というご要望への対応。
--
-- ★ この表に行が無い文面は、これまでどおりコード側の既定の文面が使われる。
--   つまり、この表は「上書き」だけを持つ。
--   行を消せば既定に戻る（元に戻す操作が、行の削除だけで済む）。
--
-- 読み書きは管理者用のAPI（サービスロール）を通す。
-- 送信するAPIもサービスロールで動くので、そこから読める。
-- RLS を有効にしたうえでポリシーを作らない＝ブラウザからは触れない。
-- onsite_notes・password_notice_log・sales_reminder_log と同じ方針。
--
-- ★ 文面は出店者・募集者へ送られるもので、運営だけが書き換えてよい。
--   ブラウザから書き換えられると、なりすましのメールを作れてしまう。

create table if not exists public.mail_templates (
  -- どのメールか。コード側と対応させる名前（例: sales-remind）
  key text primary key,

  subject text not null,
  body text not null,

  -- 誰がいつ直したか。文面は外へ出るものなので、変更の跡を残す
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table public.mail_templates is
  '送信メールの文面の上書き。行が無ければコード側の既定の文面が使われる。行を消せば既定に戻る';
comment on column public.mail_templates.key is
  'どのメールか。コード側の呼び出しと同じ名前を使う（例: sales-remind）';
comment on column public.mail_templates.body is
  '本文。{{屋号}} のような差し込みが使える。使える差し込みはメールごとに決まっている';

-- 更新日時を自動で追う
create or replace function public.touch_mail_templates()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists mail_templates_touch on public.mail_templates;
create trigger mail_templates_touch
  before update on public.mail_templates
  for each row
  execute function public.touch_mail_templates();

alter table public.mail_templates enable row level security;

-- ポリシーは作らない。サービスロールを持つAPIからだけ触れる


-- 入ったことの確認
select
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'mail_templates')   as 列の数,
  (select relrowsecurity from pg_class where relname = 'mail_templates') as RLSが有効か,
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'mail_templates')      as ポリシーの数,
  (select count(*) from public.mail_templates)                          as 上書きの数;
