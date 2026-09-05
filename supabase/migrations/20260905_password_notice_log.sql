-- 旧サイトからの移行組へお送りする「パスワード設定のご案内」の送信記録。
--
-- 会員1,404人のうち1,317人が、一度もログインできていない。
-- 移行のときにアカウントは作られたが、パスワードは認証システムが自動生成した
-- 64文字のランダムな文字列が入っており、本人は知りようがない。
-- パスワードを再設定する以外に入る手段が無い。
--
-- そこで、対象の方へ「再設定をお願いします」というご案内を1通お送りする。
-- 再設定リンクそのものは送らない。リンクは1時間・1回きりで切れるため、
-- 1,300通を一斉に送ると、翌朝開いた大半の方が期限切れ画面に着く。
-- ご案内だけを送り、ご本人が開いたときにその場で発行される形にする。
--
-- ★ このテーブルが要る理由
--    誰にもう送ったかを残さないと、実行のたびに同じ人へ何度も届く。
--    1,300人規模を何回かに分けて送るため、記録が無いと分割そのものが成立しない。
--
-- 読み書きは管理者用のAPI（サービスロール）を通す。
-- RLS を有効にしたうえでポリシーを作らない＝ブラウザからは触れない。
-- onsite_notes・meeting_requests と同じ方針。

create table if not exists public.password_notice_log (
  id uuid primary key default gen_random_uuid(),

  -- 送った相手。会員の登録が消えても記録は残したいので on delete set null
  seller_id uuid references public.profiles(id) on delete set null,

  -- 送った時点のアドレスをそのまま残す。
  -- あとでアドレスを変更されても「どこへ送ったか」を追えるようにするため
  email text not null,

  -- 送信の結果。失敗も残す（送り直す相手を選べるようにするため）
  status text not null default 'sent',
  error text,

  sent_at timestamptz not null default now()
);

alter table public.password_notice_log
  drop constraint if exists password_notice_log_status_check;
alter table public.password_notice_log
  add constraint password_notice_log_status_check check (status in ('sent', 'failed'));

comment on table public.password_notice_log is
  '移行組へのパスワード設定案内の送信記録。二重送信を防ぎ、分割送信を成り立たせるためのもの';
comment on column public.password_notice_log.email is
  '送った時点のアドレス。あとで変更されても追えるように、そのまま残す';
comment on column public.password_notice_log.status is
  'sent=送れた／failed=送信に失敗。failed は送り直しの対象にできる';

-- 「この人にもう送ったか」を引くための索引。
-- 送るたびに対象者ぶんだけ引くので、ここが遅いと分割送信が詰まる
create index if not exists password_notice_log_seller_idx
  on public.password_notice_log (seller_id);

create index if not exists password_notice_log_sent_at_idx
  on public.password_notice_log (sent_at desc);

alter table public.password_notice_log enable row level security;

-- ポリシーは作らない。サービスロールを持つ管理者用APIからだけ触れる


-- ここから、送る相手を出す仕組み。
--
-- 「一度もログインしていない人」は auth.users.last_sign_in_at で判別する。
-- auth スキーマはブラウザからは読めないため、関数にして
-- サービスロールからだけ呼べるようにする。
--
-- last_sign_in_at を条件に使ってよいことは実測で確かめてある。
-- セッションが197件あり（サイト開設の2026-06-21から今日まで全期間ぶん残っている）、
-- 「セッションはあるのに未ログイン扱い」の人が0人だった。
-- GoTrue の記録漏れの不具合（2025-10-31〜2026-07-30）に当たっていない。

create or replace function public.password_notice_targets(p_limit int default 100)
returns table (
  seller_id  uuid,
  email      text,   -- profiles 側のアドレス。ご案内はここへ送る
  auth_email text,   -- 認証側のアドレス。再設定メールはこちらへ届く
  shop_name  text,
  name       text
)
language sql
security definer
set search_path = public, auth, pg_temp
as $$
  select p.id, p.email, u.email::text, p.shop_name, p.name
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.role = 'seller'
    and u.last_sign_in_at is null
    and coalesce(p.email, '') <> ''
    and not exists (
      select 1 from public.password_notice_log l
      where l.seller_id = p.id and l.status = 'sent'
    )
  order by p.id
  limit greatest(p_limit, 0)
$$;

comment on function public.password_notice_targets(int) is
  'パスワード設定のご案内を、まだ送っていない移行組を返す。サービスロールからのみ呼べる';

-- 送る前の下見に使う。送信済み・残り・アドレス食い違いの数を返す
-- 列名は英字にしている。日本語の識別子も動くが、
-- 引用の要否が処理系によって変わるため、関数の入り口では避ける
create or replace function public.password_notice_summary()
returns table (
  never_logged_in bigint,   -- 一度もログインしていない人
  already_sent    bigint,   -- すでに案内を送った人
  remaining       bigint,   -- まだ送っていない人
  email_mismatch  bigint    -- 会員情報とログイン用のアドレスが違う人
)
language sql
security definer
set search_path = public, auth, pg_temp
as $$
  with t as (
    select p.id, p.email, u.email::text as auth_email,
           exists (select 1 from public.password_notice_log l
                   where l.seller_id = p.id and l.status = 'sent') as done
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.role = 'seller'
      and u.last_sign_in_at is null
      and coalesce(p.email, '') <> ''
  )
  select
    count(*),
    count(*) filter (where done),
    count(*) filter (where not done),
    -- ご案内は profiles のアドレスへ送るが、再設定メールは認証側へ届く。
    -- 食い違っていると、案内は届くのにリンクが別のところへ行く
    count(*) filter (where lower(email) is distinct from lower(auth_email))
  from t
$$;

comment on function public.password_notice_summary() is
  'ご案内の送信状況。未ログイン・送信済み・残り・アドレス食い違いの数を返す';

-- 誰でも呼べる状態にはしない。サービスロール（管理者用API）からだけ
revoke all on function public.password_notice_targets(int) from public, anon, authenticated;
revoke all on function public.password_notice_summary()    from public, anon, authenticated;
grant execute on function public.password_notice_targets(int) to service_role;
grant execute on function public.password_notice_summary()    to service_role;


-- 入ったことの確認
select
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'password_notice_log') as 列の数,
  (select relrowsecurity from pg_class where relname = 'password_notice_log') as RLSが有効か,
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'password_notice_log')   as ポリシーの数;

-- 送る相手が何人いるか（まだ何も送っていないので、残り＝未ログインの人数になるはず）
select * from public.password_notice_summary();
