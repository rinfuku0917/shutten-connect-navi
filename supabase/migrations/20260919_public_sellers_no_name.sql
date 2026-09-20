-- 公開用ビュー public_sellers から本名（profiles.name）を外す。
--
-- 【なぜ外すか】
--   2026-09-19 に出店者ご本人から「公開ページに本名が出ている」と申し出があった。
--   ページの表示そのものはコミット dda948d で直した（屋号が無ければ
--   「キッチンカー出店者」と出し、本名は取得もしない）。
--   ところが、このビューが name 列を持ったままだった。
--   ビューには anon の SELECT が付いており、anon キーはブラウザに置いてあるので、
--   ページに出ていなくても
--     GET /rest/v1/public_sellers?select=name
--   を叩けば、承認済み出店者1,386人ぶんの本名が誰にでも取れる状態だった
--   （うち304人は屋号が未登録で、本名しか名前が無い）。
--   画面から消しただけでは「公開していない」とは言えないので、列ごと落とす。
--
--   ビューには security_invoker が付いていないため、profiles の RLS
--   （20260902_profiles_lock_down.sql で「自分の行と管理者だけ」に絞った）を
--   素通りする。security_invoker を足すには profiles 側へ
--   「承認済み出店者の公開列だけ anon が読める」SELECT ポリシーを
--   同時に足す必要があり、順番を誤ると公開ページの一覧が空になる。
--   それは別の移行で扱い、ここでは列を落とすことに絞る。
--
-- 【あわせて権限を締め直す】
--   移行ファイルには grant select しか書いていないのに、実測すると anon キーで
--   UPDATE と INSERT が通ってしまう（INSERT のエラーが
--   「null value in column "id" of relation "profiles"」を返すので、
--   書き込みが profiles 本体に届いていることまで確認できた）。
--   create or replace view で作られたビューに、public スキーマの既定権限が
--   当たったものと思われる。
--   下で drop → create し直すと同じ既定権限がまた付くので、
--   作り直した直後に revoke all してから select だけを grant する。
--
--   revoke の相手には PUBLIC ロールも入れる。既定権限の付与先が anon 直付けでは
--   なく PUBLIC 経由だった場合、anon は PUBLIC を継承するので
--   「from anon, authenticated」だけでは外れない。
--   anon 直付けだったとしても結果は変わらないので、足しておく。
--
-- 【このファイルで直していないこと（大事）】
--   原因は public スキーマの既定権限（default privileges）そのものだが、
--   ここで戻しているのはこのビュー1つぶんだけ。
--   今後 public に作る表やビューには、同じ書き込み権限がまた付く。
--   既定権限そのものを外すのは影響範囲が広いので、この移行には混ぜない。
--   現状は下のクエリで確かめられる（別の移行で扱う）。
--     select defaclrole::regrole, defaclnamespace::regnamespace, defaclacl
--     from pg_default_acl;
--
-- 【何度流しても同じ結果になる】
--   drop view if exists → create view → revoke → grant の順なので、
--   繰り返し実行しても最後は同じ状態になる。
--
-- 【アプリ側との順番】
--   アプリは先に name を読むのをやめてある（このSQLを流す前でも後でも動く）。
--   運営の画面で本名が要るところは /api/admin/seller-names
--   （サービスキー。profiles.role='admin' を確かめてから profiles を読む）に
--   付け替えた。募集者の画面と提出用Excelは屋号だけで出す。
--
-- 【流し方】
--   Supabase の SQL エディタは、まとめて流すと最後の1文の結果しか画面に出ない。
--   下の「流す前の確認」は、本体より先に “その段落だけを選択して” 実行すること。
--   そのあとで「本体」を流し、最後に「流したあとの確認」を流す
--   （流したあとの確認は1文にまとめてあるので、まとめて流しても全部見える）。

-- ============================================================
-- 流す前の確認（本体より先に、この段落だけを選択して実行する）
-- ============================================================

-- 確認①：いまの列（name が入っているはず）
select string_agg(column_name, ', ' order by ordinal_position) as 流す前のビューの列
from information_schema.columns
where table_schema = 'public' and table_name = 'public_sellers';

-- 確認②：いまの件数（流したあとと同じ数になるはず。控えておく）
select count(*) as 流す前の件数 from public.public_sellers;

-- 確認③：いまの権限（anon に INSERT / UPDATE が付いているはず）。
--         information_schema.role_table_grants は PUBLIC への付与を表示しないので、
--         ここに出ない＝権限が無い、とは読まないこと。
--         実際に持っているかは has_table_privilege（流したあとの確認）で見る
select grantee as 相手, string_agg(privilege_type, ', ' order by privilege_type) as 権限
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'public_sellers'
group by grantee
order by grantee;

-- 確認④：このビューに依存している物が無いこと。
--         下の drop view は cascade を付けない（黙って消さずエラーで止めたい）ので、
--         依存があるとトランザクションの途中で止まり、以降の確認が全部
--         「current transaction is aborted」になる。行が出たら先に手当てする
select dependent_ns.nspname || '.' || dependent_view.relname as 依存している物
from pg_depend d
join pg_rewrite r on r.oid = d.objid
join pg_class dependent_view on dependent_view.oid = r.ev_class
join pg_namespace dependent_ns on dependent_ns.oid = dependent_view.relnamespace
join pg_class source on source.oid = d.refobjid
where source.relname = 'public_sellers'
  and dependent_view.relname <> 'public_sellers';

-- ============================================================
-- 本体
-- ============================================================

begin;

-- 列を1つ減らすので create or replace view では置き換えられない（列の削除は不可）。
-- いったん落としてから作り直す。
-- cascade は付けない。ほかに依存している物があるなら、黙って消さずエラーで止めたい
drop view if exists public.public_sellers;

-- 20260904_public_sellers_profile.sql の定義から name だけを外したもの。
-- ほかの列・絞り込みは触らない
create view public.public_sellers as
select
  id,
  shop_name,
  genre,
  areas,
  photos,
  role,
  approval_status,
  takeout_bag,      -- 提出用Excelで使う（連絡先ではない）
  payment_methods,  -- 同上
  bio,              -- 紹介文・特徴
  sales_type,       -- 販売形態（キッチンカー／テント・ブースなど）
  vehicle_type,     -- 車種
  size_length,      -- 車両サイズ（mm）
  size_width,
  size_height,
  equipment,        -- 設備
  menu              -- メニューの自由記述
from public.profiles
where role = 'seller'
  and approval_status = 'approved';

comment on view public.public_sellers is
  '出店者の公開情報だけを見せる入口。本名・メール・電話・住所は含めない。公開ページと募集者の画面はここを読む。';

-- 作り直すと public スキーマの既定権限がまた付く。読み取り以外を落としてから
-- SELECT だけを渡し直す。
-- public（PUBLIC ロール）も相手に入れる。付与元が PUBLIC 経由だと
-- anon は継承するだけなので、anon を名指ししても外れないため
revoke all privileges on public.public_sellers from public, anon, authenticated;
grant select on public.public_sellers to anon, authenticated;

-- service_role にも明示で渡し直す。
-- drop view でビューの権限は全部消えるので、「service_role には触れない」では残らない。
-- 公開の出店者一覧（app/sellers/page.tsx）は SUPABASE_SERVICE_ROLE_KEY で
-- このビューを読み、読めないと error を throw してページが丸ごと落ちる。
-- 既定権限で勝手に付いていたとしても、明示しておけば結果は変わらない
grant select on public.public_sellers to service_role;

commit;

-- ============================================================
-- 流したあとの確認
-- ============================================================

-- 1文にまとめてある（SQLエディタは最後の1文しか表示しないため）。
-- 合格の条件：
--   列        … name が入っていないこと
--   件数      … 「流す前の件数」と同じであること（減っていたら公開ページが欠ける）
--   anon読取  … true
--   anon書込* … どちらも false（PUBLIC 経由の付与もここに出る）
--   service_role読取 … true（false だと /sellers が丸ごと落ちる）
select
  (select string_agg(column_name, ', ' order by ordinal_position)
     from information_schema.columns
    where table_schema = 'public' and table_name = 'public_sellers')            as 列,
  (select count(*) from public.public_sellers)                                  as 件数,
  has_table_privilege('anon',         'public.public_sellers', 'select') as anon読取,
  has_table_privilege('anon',         'public.public_sellers', 'insert') as anon書込insert,
  has_table_privilege('anon',         'public.public_sellers', 'update') as anon書込update,
  has_table_privilege('anon',         'public.public_sellers', 'delete') as anon書込delete,
  has_table_privilege('authenticated','public.public_sellers', 'update') as ログイン書込update,
  has_table_privilege('service_role', 'public.public_sellers', 'select') as service_role読取;

-- 確認（ブラウザから。SQLではなくターミナルで）
--   本名が取れないこと。列が無いので 400 が返れば成功
--     curl "$URL/rest/v1/public_sellers?select=name&limit=1" -H "apikey: $ANON_KEY"
--
--   書き込みが弾かれること。どちらも 42501 permission denied が返れば成功。
--   UPDATE と INSERT の両方を試す（profiles 本体まで届いていた証拠は
--   INSERT のほうだったので、そちらこそ確かめる）。
--   INSERT は列の指定を最小にしてある（万一通っても profiles の
--   not null 制約で落ち、行は出来ない）
--     curl -X PATCH "$URL/rest/v1/public_sellers?id=eq.00000000-0000-0000-0000-000000000000" \
--       -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
--       -H "Content-Type: application/json" -d '{"bio":"x"}'
--     curl -X POST "$URL/rest/v1/public_sellers" \
--       -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
--       -H "Content-Type: application/json" -d '{"bio":"x"}'

-- ============================================================
-- 元に戻すSQL（公開ページが壊れたときだけ。本名がまた読めるようになる）
-- ============================================================
--
-- begin;
-- drop view if exists public.public_sellers;
-- create view public.public_sellers as
-- select
--   id, name, shop_name, genre, areas, photos, role, approval_status,
--   takeout_bag, payment_methods, bio, sales_type, vehicle_type,
--   size_length, size_width, size_height, equipment, menu
-- from public.profiles
-- where role = 'seller' and approval_status = 'approved';
-- comment on view public.public_sellers is
--   '出店者の公開情報だけを見せる入口。メール・電話・住所は含めない。公開ページと募集者の画面はここを読む。';
-- revoke all privileges on public.public_sellers from public, anon, authenticated;
-- grant select on public.public_sellers to anon, authenticated;
-- grant select on public.public_sellers to service_role;
-- commit;
