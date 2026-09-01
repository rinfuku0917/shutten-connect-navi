-- 新サイトに移った出店者のうち、実際に使い始めた人が何人かを数える。
--
-- 前提：
--   旧サイトから移した出店者は app/api/admin/import-sellers/route.ts の
--   auth.admin.createUser() で作っている。このときパスワードを渡していないため、
--   移行しただけの人は「パスワードが空のアカウント」になる。
--   本人がパスワード再設定を済ませて初めてログインできる。
--   つまり「パスワードを設定した人＝実際に使い始めた人」。
--
--   移行で作ったアカウントは user_metadata に imported: true が入っている。
--
-- Supabase の SQL Editor は最後のクエリの結果しか表示しないので、
-- 1回の実行で全部見えるように、1つの表にまとめてある。
--
-- パスワードそのものは扱わない。空かどうかだけを見る。

with u as (
  select
    id,
    coalesce((raw_user_meta_data ->> 'imported') = 'true', false) as 移行組,
    coalesce(encrypted_password, '') <> ''                        as パスワードあり,
    last_sign_in_at,
    recovery_sent_at,
    created_at
  from auth.users
),
n as (
  select
    count(*) filter (where 移行組)                                          as 移行総数,
    count(*) filter (where 移行組 and パスワードあり)                         as 移行_設定済,
    count(*) filter (where 移行組 and last_sign_in_at is not null)           as 移行_ログイン済,
    count(*) filter (where 移行組 and recovery_sent_at is not null)          as 移行_再設定メール送信,
    count(*) filter (where 移行組 and last_sign_in_at > now() - interval '30 days') as 移行_直近30日ログイン,
    count(*) filter (where not 移行組)                                       as 新規総数,
    count(*) filter (where not 移行組 and last_sign_in_at is not null)       as 新規_ログイン済
  from u
)
select * from (
  select 1 as 並び, '① 旧サイトから移したアカウント'   as 項目, 移行総数              as 人数, null::numeric as 割合 from n
  union all
  select 2, '② うちパスワードを設定した人',            移行_設定済,
         round(100.0 * 移行_設定済 / nullif(移行総数, 0), 1) from n
  union all
  select 3, '③ うち一度でもログインした人',            移行_ログイン済,
         round(100.0 * 移行_ログイン済 / nullif(移行総数, 0), 1) from n
  union all
  select 4, '④ うち直近30日にログインした人',          移行_直近30日ログイン,
         round(100.0 * 移行_直近30日ログイン / nullif(移行総数, 0), 1) from n
  union all
  select 5, '⑤ 再設定メールが送られた人',              移行_再設定メール送信,
         round(100.0 * 移行_再設定メール送信 / nullif(移行総数, 0), 1) from n
  union all
  select 6, '⑥ 自分で新規登録した会員',                新規総数, null from n
  union all
  select 7, '⑦ うち一度でもログインした人',            新規_ログイン済,
         round(100.0 * 新規_ログイン済 / nullif(新規総数, 0), 1) from n
) t
order by 並び;
