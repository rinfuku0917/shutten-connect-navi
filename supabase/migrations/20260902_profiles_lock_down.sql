-- 【手順B】ログイン済みの会員が、他人の連絡先を読めないようにします。
--
-- ★ 手順A（ビュー作成）と、アプリ側の入れ替えが終わってから実行してください。
--
-- 【いま起きていること】
--   profiles に profiles_select_all（SELECT / anon,authenticated / 条件 true）があり、
--   行の制限がありません。ログインした出店者は、他の1,404人分の
--   メール・電話・住所を取得できます。
--
-- 【この後どうなるか】
--   profiles を読めるのは
--     ・自分の行（既存ポリシー「自分のプロフィールを読み書き」）
--     ・管理者（既存ポリシー「admin reads all profiles」）
--   だけになります。
--   公開ページと募集者の画面は public_sellers（連絡先なし）から読みます。

begin;

-- 行の制限が無いポリシーを外す
drop policy if exists "profiles_select_all" on public.profiles;

-- 匿名は public_sellers だけを見ればよいので、profiles の列許可も片付ける
revoke select on public.profiles from anon;

commit;

-- ============================================================
-- 確認
-- ============================================================

-- 確認①：profiles に残ったポリシー（自分の行と管理者だけになっていれば成功）
select
  policyname as ポリシー名,
  cmd        as 操作,
  coalesce(qual, '(条件なし)') as 条件
from pg_policies
where schemaname = 'public' and tablename = 'profiles'
order by cmd, policyname;

-- 確認②：public_sellers が使えること（承認済みの出店者数が出れば成功）
select count(*) as 公開用ビューの件数 from public.public_sellers;

-- 確認③：ビューに連絡先が無いこと（email/phone/address が出なければ成功）
select string_agg(column_name, ', ' order by ordinal_position) as ビューの列
from information_schema.columns
where table_schema = 'public' and table_name = 'public_sellers';
