-- public スキーマの既定権限（default privileges）から、anon / authenticated の
-- 書き込みを外す。すでに付いてしまっている分も、対象を絞って落とす。
--
-- ============================================================
-- ★本番で流した結果（2026-09-22）
-- ============================================================
--   ② … 成功（postgres ぶん）
--   ②' … 失敗「42501 permission denied to change default privileges」。
--        SQL Editor は postgres として動き、supabase_admin のメンバーではないため。
--        巻き戻っただけで何も変わっていない
--   ③-1・③-2・③-4 … 成功
--   ④ … 既定権限に残る書き込み 8（すべて supabase_admin の anon×4・authenticated×4）
--        サーバー専用の表に残る書き込み 0 / service_role が書ける表 14 /
--        関数を実行できる組 12（流す前と同じ）/ anon の places 追加 false /
--        ログイン中の places 追加 true / anon の reviews 投稿 true / 更新 false /
--        anon の公開一覧の読み取り true
--   実証：anon キーで signup_sources・contacts・posts・line_debug・case_files へ
--        POST すると、すべて 42501 permission denied for table になった。
--        公開の読み取り（public_sellers・places・posts・reviews）は 200 のまま
--
--   残る穴：supabase_admin が作る表（ダッシュボードの Table Editor など）には、
--   今も anon の全権が付く。表は SQL Editor か移行ファイルで作ること
--   （AGENTS.md「Supabase の権限」に決まりとして書いた）。
--
-- ============================================================
-- 何が起きていたか
-- ============================================================
--   2026-09-19、公開用ビュー public_sellers に対して
--     ・anon キーで PATCH（UPDATE）が 204 で通る
--     ・anon キーで POST（INSERT）が profiles 本体まで届く
--       （エラーが「null value in column "id" of relation "profiles"」だった）
--   という状態が見つかった。
--   ビューを作った移行ファイル（20260902 / 20260904_public_sellers_profile.sql）には
--   `grant select` しか書いていない。誰も書き込みを渡していないのに書けていた。
--
--   原因は public スキーマの既定権限。pg_default_acl に
--   「この役割が public に作る表・ビューには、この権限を付ける」という設定が入っており、
--   そこに anon / authenticated（または PUBLIC 経由）の書き込みが含まれている。
--   create table / create view のたびに、黙って付く。
--
--   20260919_public_sellers_no_name.sql では、ビュー1つぶんだけ
--   revoke all → grant select で戻した。根っこは直していない。
--   つまり今後 public に作る表・ビューには、また同じ書き込みが付く。
--   ここでその根っこを外す。
--
-- ============================================================
-- なぜこの順で流すか
-- ============================================================
--   ②（これから作るもの）を先に、③（すでに付いている分）を後にする。
--   逆にすると、③で落としたあとに作った表へまた付いてしまい、
--   「落としたはずが付いている」という分かりにくい状態が生まれる。
--
--   ③は一括で revoke しない。ブラウザ（anon キー＋RLS）から正しく書いている表が
--   あるため、まとめて落とすと画面が壊れる。落として良いものだけを名指しで書く。
--
-- ============================================================
-- 流す前に確かめること
-- ============================================================
--   1. ①をすべて流し、結果を控える（あとで見比べる）。
--      ★①-1 の「既定の権限」列と、①-2 の「いまのACL」列の生の値は、
--        このファイルで唯一の復元元。⑤の戻しは「元と同じ形」には戻さないので、
--        この2つを控えていないと、元の状態が分からなくなる。
--   2. ①-1 に出てくる「作る役割」を見る。②の `for role` は、そこに出た役割ごとに
--      流す必要がある。既定権限は「誰が作ったか」で分かれて記録されるため、
--      postgres の分を外しても supabase_admin の分は残る。
--      自分が入っていない役割の既定権限は変えられない（権限エラーになる）。
--      その場合は変えられた分だけで止め、残りは記録しておく。
--   3. ①-1 に「スキーマ」が『(全スキーマ)』の行が出たら、②の4文から
--      `in schema public` を外した版も、同じ役割ぶん流す。
--      Postgres はスキーマ指定の既定権限と全スキーマの既定権限を足し算するので、
--      全スキーマの行に anon / authenticated の insert が入っていると、
--      ②（public 限定）を流しても public に作る表へ書き込みが付き続ける。
--   4. ①-2 に出た表・ビューを、③の一覧と見比べる。
--      どちらの一覧にも無いものは 2026-09-21 より後に増えたもの。
--      ブラウザから書いているかどうかを確かめてから決めること（勝手に落とさない）。
--   5. ②以降、public に作る表・ビューを、ログイン後の画面（authenticated）から
--      書くときは、その移行ファイルの中で
--        grant insert, update, delete on public.表名 to authenticated;
--      を明示すること。このリポジトリの移行ファイルは create table だけを書き、
--      grant を1行も書かない習慣になっている（20260824_invoices.sql /
--      20260825_meeting_requests.sql / 20260903_onsite_workflow.sql /
--      20260905〜20260911 の各ファイル）。application_submissions のように
--      RLS のポリシーだけ書いて grant を省くと、ポリシーは正しいのに
--      42501 permission denied で insert が黙って落ちる。
--      いまの authenticated の書き込みは、既定権限だけが根拠になっている。
--   6. ②で関数の EXECUTE も外す。これ以降、anon / authenticated の権限で
--      評価される関数には `grant execute on function ... to anon, authenticated;`
--      を明示すること（下の②の注を読む。RPC だけの話ではない）。
--      いま動いている関数は ①-3 に出る（既存の権限は②では変わらない）。
--
--   Supabase の SQL Editor は、まとめて流すと最後の1文の結果しか画面に出ない。
--   ①は1文ずつ、②③は番号の段落ごとに選択して実行する。
--
-- ============================================================
-- このファイルに入れていないこと
-- ============================================================
--   ★ public_sellers の security_invoker 化は入れていない。
--     いまのビューは security_invoker が付いていないので、profiles の RLS
--     （20260902_profiles_lock_down.sql で「自分の行と運営だけ」に絞った）を
--     素通りして読めている。公開の出店者一覧が出ているのはそのおかげ。
--     security_invoker を付けると、読む人の権限で profiles を読みにいくため、
--     profiles 側に「承認済み出店者の公開列だけ anon が読める」SELECT ポリシーが
--     無いと、公開一覧（/sellers・トップの出店者枠）が丸ごと空になる。
--     判断材料：
--       ・いま anon は profiles を直接は読めない（20260902 で revoke select 済み）
--       ・付けるなら「ポリシーを足す」→「security_invoker を付ける」の順で、
--         同じトランザクションに入れる。逆順・別々に流すと一覧が空になる時間ができる
--       ・急ぐ話ではない。ビューは公開して良い列だけになっている（本名は 20260919 で削除）
--     この2つを混ぜると、権限の整理が失敗したのか公開一覧が壊れたのかが
--     切り分けられなくなるため、別の移行で扱う。
--
--   連番（sequence）の既定権限は触っていない。anon が連番を進められても
--   実害が思いつかず、落とすと insert が通らなくなる組み合わせがあるため。
--   気になるなら ①-1 の '連番' の行を見て、別途判断する。


-- ============================================================
-- ① 流す前の確認（1文ずつ、その行だけを選択して実行する）
-- ============================================================

-- ①-1 いまの既定権限。
--      ここに anon / authenticated / PUBLIC への insert・update・delete が
--      入っているのが原因。「作る役割」は②の for role に使い、
--      「スキーマ」が『(全スキーマ)』の行があれば上の手順3に従う。
--      ★「既定の権限」列の生の値を控えておくこと（⑤の復元元）。
--      ★2026-09-22 に本番で流した結果：6行。
--        postgres / public / 表・ビュー … anon=arwdDxtm（＝全権。これが原因）
--        postgres / public / 連番 … anon=rwU
--        postgres / public / 関数 … anon=X
--        supabase_admin / public / 上と同じ3行
--        「(全スキーマ)」の行は無し → ②は in schema public のままでよい
--        役割が2つ出たので、②のあとに②'（supabase_admin ぶん）も流す
--      行が1つも出ないなら、表の2文（②の前半）は空振りになる。
--      ただし関数の2文（②の後半）は、pg_default_acl に行が無くても効く
--      （Postgres は素の状態でも関数の EXECUTE を PUBLIC に渡している。
--       ②の注を読む）。つまり行が出なくても②はそのまま流す。
select
  a.defaclrole::regrole::text                                              as 作る役割,
  coalesce(nullif(a.defaclnamespace, 0)::regnamespace::text, '(全スキーマ)') as スキーマ,
  case a.defaclobjtype
    when 'r' then '表・ビュー'
    when 'S' then '連番'
    when 'f' then '関数'
    when 'T' then '型'
    when 'n' then 'スキーマ'
    else a.defaclobjtype::text
  end                                                                      as 対象,
  a.defaclacl::text                                                        as 既定の権限
from pg_default_acl a
order by 1, 2, 3;

-- ①-2 いま anon / authenticated / service_role に書き込みが付いている表・ビュー。
--      information_schema ではなく has_table_privilege で見る
--      （PUBLIC 経由の付与は information_schema.role_table_grants に出ないため）。
--      ここに出た名前を、下の③の一覧と見比べること。
--
--      ★service_role も出すのは、③-1 で PUBLIC からも落とすため。
--        service_role は PUBLIC を継承するので、書き込みが PUBLIC 経由で
--        付いていた場合、PUBLIC を落とすと service_role からも消える
--        （migrations には service_role への表の書き込みの grant が1本も無い。
--         あるのは 20260919_public_sellers_no_name.sql:148 の grant select と
--         20260905_password_notice_log.sql:143-144 の execute だけ）。
--      ★「いまのACL」列を見て、`=arwdDxt/` で始まる項があるかを確かめる。
--        それが PUBLIC への付与。あれば③-1 の一組（revoke ＋ service_role への
--        grant し直し）が効いてくる。
--      ★この列の生の値も控えておくこと（⑤の復元元）。
select
  c.relname                                   as 名前,
  case c.relkind
    when 'r' then '表'
    when 'p' then '分割表'
    when 'v' then 'ビュー'
    when 'm' then 'マテビュー'
    else c.relkind::text
  end                                         as 種類,
  r.rolname                                   as 相手,
  concat_ws(', ',
    case when has_table_privilege(r.oid, c.oid, 'insert')   then 'INSERT'   end,
    case when has_table_privilege(r.oid, c.oid, 'update')   then 'UPDATE'   end,
    case when has_table_privilege(r.oid, c.oid, 'delete')   then 'DELETE'   end,
    case when has_table_privilege(r.oid, c.oid, 'truncate') then 'TRUNCATE' end
  )                                           as 書き込み権限,
  c.relacl::text                              as いまのACL
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
cross join pg_roles r
where n.nspname = 'public'
  and c.relkind in ('r', 'p', 'v', 'm')
  and r.rolname in ('anon', 'authenticated', 'service_role')
  and (has_table_privilege(r.oid, c.oid, 'insert')
    or has_table_privilege(r.oid, c.oid, 'update')
    or has_table_privilege(r.oid, c.oid, 'delete')
    or has_table_privilege(r.oid, c.oid, 'truncate'))
order by c.relname, r.rolname;

-- ①-3 いま anon / authenticated が実行できる public の関数。
--      ②は「これから作る関数」にしか効かないので、ここに出ているものは
--      ②のあとも呼べる。行数を控えて、④で同じ数のままかを確かめる。
--
--      ★is_admin() がここに出るはず。RLS のポリシー
--        （20260623_rls_hardening.sql:13-24, 27-36, 40-41, 64-74）から
--        呼ばれているので、これが消えるとログイン済みの利用者の SELECT まで
--        permission denied for function で落ちる。
select
  p.proname                                    as 関数,
  pg_get_function_identity_arguments(p.oid)    as 引数,
  r.rolname                                    as 相手
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join pg_roles r
where n.nspname = 'public'
  and r.rolname in ('anon', 'authenticated')
  and has_function_privilege(r.oid, p.oid, 'execute')
order by p.proname, r.rolname;

-- ①-4 ③で流す候補を、いまのDBの状態から作って見せる（実行はしない）。
--      ③に名前を書き忘れているものが無いかの確認用。
--      出てきた文をそのまま流さないこと。落として良いかは1つずつ判断する。
--      相手は anon / authenticated だけ（service_role の書き込みは落とさない）
select format(
    'revoke insert, update, delete, truncate on public.%I from %I;',
    c.relname, r.rolname
  ) as 流す候補
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
cross join pg_roles r
where n.nspname = 'public'
  and c.relkind in ('r', 'p', 'v', 'm')
  and r.rolname in ('anon', 'authenticated')
  and (has_table_privilege(r.oid, c.oid, 'insert')
    or has_table_privilege(r.oid, c.oid, 'update')
    or has_table_privilege(r.oid, c.oid, 'delete')
    or has_table_privilege(r.oid, c.oid, 'truncate'))
order by c.relname, r.rolname;

-- ①-5 ③-1 で扱う14表について、いま service_role が書けるか。
--      ③-1 は PUBLIC からも落とすので、流す前後で同じ（すべて true）に
--      なっていることを確かめる。流す前に false の表があれば、
--      そこは app/api/* が書けていないということなので、先に理由を調べる
select
  c.relname                                                as 名前,
  has_table_privilege('service_role', c.oid, 'insert')     as 追加,
  has_table_privilege('service_role', c.oid, 'update')     as 更新,
  has_table_privilege('service_role', c.oid, 'delete')     as 削除
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
  and c.relname in ('contacts','meeting_requests','signup_sources','invoices','posts',
                    'onsite_notes','notify_recipients','mail_templates','mail_send_log',
                    'password_notice_log','sales_reminder_log','purge_log',
                    'imported_sellers','line_debug')
order by c.relname;


-- ============================================================
-- ② これから作る表・ビュー・関数に、書き込みが付かないようにする
--    （この段落だけを選択して実行）
-- ============================================================
--
-- ここで変わるのは「これから作るもの」だけ。すでにある表・ビュー・関数の
-- 権限は1つも変わらない（それは③でやる）。
--
-- `for role postgres` … ①-1 の「作る役割」に合わせる。移行ファイルと
--   SQL Editor はどちらも postgres として動くので、ふだん作るものはこれで覆える。
--   ①-1 に別の役割（supabase_admin など）が出ていたら、その役割ぶんも
--   同じ文を for role を変えて流す。入っていない役割は変えられないので、
--   権限エラーが出たらそこで止めて記録しておく。
--
-- `in schema public` … ①-1 に『(全スキーマ)』の行が出ていたら、
--   この4文から `in schema public` を外した版も流す（上の手順3）。
--   足し算されるので、public 限定だけでは締まらない。
--
-- `from PUBLIC` も入れる。既定権限の付与先が anon 直付けではなく PUBLIC 経由だと、
--   anon / authenticated は PUBLIC を継承するだけなので、名指しでは外れない。
--   （IN SCHEMA public のほうはスキーマ名、FROM PUBLIC のほうは役割。別物）
--
-- SELECT は落とさない。公開ページは anon キーで表とビューを読んでいる。

begin;

-- 表・ビュー（relkind = 'r','p','v','m' はまとめて TABLES 扱い）
alter default privileges for role postgres in schema public
  revoke insert, update, delete, truncate on tables from PUBLIC;
alter default privileges for role postgres in schema public
  revoke insert, update, delete, truncate on tables from anon, authenticated;

-- 関数。
-- ★ここは効き方が強い。Postgres は素の状態でも「関数の EXECUTE を PUBLIC に渡す」
--   という既定を持っており、anon / authenticated はそれを継承する。
--   つまりこの2文のあと、新しく作る関数は anon / authenticated では実行できない。
--
--   EXECUTE が要るのは RPC だけではない。関数が anon / authenticated の権限で
--   評価される場所すべてで必要になる。
--     ・ブラウザからの RPC（.rpc(...)）
--     ・RLS のポリシーの中で呼ぶ関数 … このDBでは public.is_admin() が
--       applications / messages / places / profiles / seller_documents / sales の
--       ポリシーから呼ばれている（20260623_rls_hardening.sql）
--     ・ビューの定義・CHECK 制約の式の中で呼ぶ関数
--   ②のあとに、ポリシー用の関数を drop + create で作り直す移行を書くと
--   （create or replace は既存のACLを保つが、drop は消す）、grant execute を
--   書き忘れた時点でログイン済み利用者の SELECT まで
--   permission denied for function で落ちる。
--
--   これから作るときは、その移行ファイルの中で
--     grant execute on function public.関数名(引数) to anon, authenticated;
--   を明示すること。20260905_password_notice_log.sql が同じ考え方で
--   revoke を書いているので、書き方はそちらに合わせる。
--
--   いまある関数には影響しない（①-3 に出るものはそのまま呼べる）。
--   トリガー関数（20260904_apply_window_gate.sql の check_apply_window など）は
--   作成時しか EXECUTE を見ないので、これも影響しない。
alter default privileges for role postgres in schema public
  revoke execute on functions from PUBLIC;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;

commit;


-- ============================================================
-- ②' 同じことを supabase_admin にも流す
--    （この段落だけを選択して実行。権限エラーなら、そこで止めてよい）
-- ============================================================
--
-- 2026-09-22 に本番で ①-1 を流した結果、public の既定権限を持つ役割は
-- postgres と supabase_admin の2つだった（どちらも anon=arwdDxtm ＝全権）。
-- 「(全スキーマ)」の行は無かったので、in schema public のままでよい。
--
-- 移行ファイルと SQL Editor は postgres として動くので、ふだん作る表は②で覆える。
-- supabase_admin のぶんは、ダッシュボードのテーブルエディタなど
-- Supabase 側の仕組みが作った表に効く。
--
-- ★SQL Editor は postgres として動くため、postgres が supabase_admin の
--   メンバーでなければ `must be member of role "supabase_admin"` で失敗する。
--   失敗してもトランザクションごと巻き戻るだけで、何も変わらない。
--   そのときは「ダッシュボードから表を作ったときだけ anon の書き込みが付く」
--   という穴が残る。塞ぐなら、表を作ったあとに③と同じ revoke を流すこと。

begin;

alter default privileges for role supabase_admin in schema public
  revoke insert, update, delete, truncate on tables from PUBLIC;
alter default privileges for role supabase_admin in schema public
  revoke insert, update, delete, truncate on tables from anon, authenticated;
alter default privileges for role supabase_admin in schema public
  revoke execute on functions from PUBLIC;
alter default privileges for role supabase_admin in schema public
  revoke execute on functions from anon, authenticated;

commit;


-- ============================================================
-- ③-1 すでに付いている分を落とす：サーバー側のAPIだけが書く表
--      （この段落だけを選択して実行）
-- ============================================================
--
-- ここに並べたのは「ブラウザからは書き込まない」と確かめた表。
-- 書いているのは app/api/* のサービスロール（RLSを通らない）だけなので、
-- anon / authenticated の書き込み権限を落としても画面は変わらない。
--
--   contacts            … /api/contact（お問い合わせ）
--   meeting_requests    … /api/meeting-request（打ち合わせ希望）
--   signup_sources      … app/lib/notifyNewSeller.ts（何を見て知ったか）
--   invoices            … /api/admin/invoice, /api/invoice-payment
--   posts               … /api/posts（ブログ記事）
--   onsite_notes        … /api/admin/onsite-notes
--   notify_recipients   … /api/admin/notify-recipients
--   mail_templates      … /api/admin/mail-templates
--   mail_send_log       … /api/admin/mail-templates/send
--   password_notice_log … /api/admin/password-notice
--   sales_reminder_log  … /api/admin/sales-remind, /api/cron/sales-reminder
--   purge_log           … app/lib/purgeLog.ts（削除の控え）
--   imported_sellers    … /api/admin/import-sellers（画面からは検索で読むだけ）
--   line_debug          … /api/line/webhook
--
-- SELECT は落とさない。posts と imported_sellers はブラウザから読んでいる。
--
-- ★service_role への grant し直しを同じトランザクションに入れてある。
--   この revoke は PUBLIC からも落とすが、service_role は PUBLIC を継承するので、
--   書き込みが PUBLIC 経由で付いていた場合は service_role からも消える
--   （＝サイトのAPIが全部止まる）。直付けか PUBLIC 経由かは①-2 の
--   「いまのACL」でしか判別できず、判別を間違えると本番が落ちるので、
--   どちらでも正しくなるように「落として、明示的に付け直す」形にした。
--   すでに直付けで持っている場合、この grant は同じ権限を明示するだけで害はない。
--
-- revoke に if exists は無いので、その表がまだ作られていない環境では
-- その行でエラーになり、トランザクションごと巻き戻る（何も変わらない）。
-- エラーに出た表の行を消して、もう一度この段落を流すこと。
-- どの表がどの移行で作られるかは supabase/migrations/ の名前で分かる。

begin;

revoke insert, update, delete, truncate on public.contacts            from PUBLIC, anon, authenticated;
revoke insert, update, delete, truncate on public.meeting_requests    from PUBLIC, anon, authenticated;
revoke insert, update, delete, truncate on public.signup_sources      from PUBLIC, anon, authenticated;
revoke insert, update, delete, truncate on public.invoices            from PUBLIC, anon, authenticated;
revoke insert, update, delete, truncate on public.posts               from PUBLIC, anon, authenticated;
revoke insert, update, delete, truncate on public.onsite_notes        from PUBLIC, anon, authenticated;
revoke insert, update, delete, truncate on public.notify_recipients   from PUBLIC, anon, authenticated;
revoke insert, update, delete, truncate on public.mail_templates      from PUBLIC, anon, authenticated;
revoke insert, update, delete, truncate on public.mail_send_log       from PUBLIC, anon, authenticated;
revoke insert, update, delete, truncate on public.password_notice_log from PUBLIC, anon, authenticated;
revoke insert, update, delete, truncate on public.sales_reminder_log  from PUBLIC, anon, authenticated;
revoke insert, update, delete, truncate on public.purge_log           from PUBLIC, anon, authenticated;
revoke insert, update, delete, truncate on public.imported_sellers    from PUBLIC, anon, authenticated;
revoke insert, update, delete, truncate on public.line_debug          from PUBLIC, anon, authenticated;

-- PUBLIC 経由だった分を service_role に付け直す（上の★の理由）。
-- truncate は入れない。app/api/* は1行も truncate しないため
grant insert, update, delete on public.contacts            to service_role;
grant insert, update, delete on public.meeting_requests    to service_role;
grant insert, update, delete on public.signup_sources      to service_role;
grant insert, update, delete on public.invoices            to service_role;
grant insert, update, delete on public.posts               to service_role;
grant insert, update, delete on public.onsite_notes        to service_role;
grant insert, update, delete on public.notify_recipients   to service_role;
grant insert, update, delete on public.mail_templates      to service_role;
grant insert, update, delete on public.mail_send_log       to service_role;
grant insert, update, delete on public.password_notice_log to service_role;
grant insert, update, delete on public.sales_reminder_log  to service_role;
grant insert, update, delete on public.purge_log           to service_role;
grant insert, update, delete on public.imported_sellers    to service_role;
grant insert, update, delete on public.line_debug          to service_role;

commit;


-- ============================================================
-- ③-2 すでに付いている分を落とす：ログイン中の人だけが書く表から、anon を外す
--      （この段落だけを選択して実行）
-- ============================================================
--
-- ここに並べた表は、ブラウザから書き込んでいる。ただし書くのは必ず
-- ログイン後の画面（authenticated）で、ログアウト状態（anon）で書く導線は無い。
-- だから anon の書き込みだけを落とす。authenticated は残す。
-- PUBLIC は触らない（触ると authenticated と service_role を巻き込む）。
--
--   profiles                … 出店者・募集者が自分のプロフィールを更新（app/dashboard/*）
--                             ※ INSERT はブラウザからしない（登録時は認証側で作られる）
--   places                  … 募集者が案件を作る・直す・消す
--   applications            … 出店者が申し込む、募集者が承認する
--   application_submissions … 提出物の下書き（出店者）
--   messages                … 既読の更新・取り消し（送信は /api/messages/send）
--   sales                   … 売上報告（出店者）
--   seller_documents        … 書類の提出（出店者）
--   menus / sns_links       … 出店者のメニュー・SNS
--
-- ★ reviews は INSERT だけ残す。公開の出店者ページ
--   （app/sellers/[id]/SellerDetailClient.tsx:177）から未ログインで INSERT して
--   いるので、anon の INSERT を落とすとレビュー投稿が壊れる。
--   ただし更新・削除は公開側から一度もしていない（運営の公開切り替えは
--   app/admin/page.tsx:1724 のログイン済み UPDATE）。残す理由が無いので落とす。
--   残したままだと、冒頭の「anon キーの PATCH が 204 で通る」とまったく同じ穴。
--   reviews を作る移行ファイルは supabase/migrations/ に無く、RLS が有効かどうかも
--   リポジトリからは分からないので、権限側で塞いでおく価値がある。

revoke insert, update, delete, truncate on public.profiles                from anon;
revoke insert, update, delete, truncate on public.places                  from anon;
revoke insert, update, delete, truncate on public.applications            from anon;
revoke insert, update, delete, truncate on public.application_submissions from anon;
revoke insert, update, delete, truncate on public.messages                from anon;
revoke insert, update, delete, truncate on public.sales                   from anon;
revoke insert, update, delete, truncate on public.seller_documents        from anon;
revoke insert, update, delete, truncate on public.menus                   from anon;
revoke insert, update, delete, truncate on public.sns_links               from anon;
-- reviews は insert だけ残す（上の★）
revoke update, delete, truncate on public.reviews from anon;

-- PUBLIC 経由で付いている場合は上の revoke では外れない。
-- ①-2 で anon にまだ書き込みが残っていたら、下も流す。
-- ただし PUBLIC を落とすと authenticated と service_role からも外れるので、
-- そのあと付け直すところまでを一組で流すこと。
--
-- begin;
-- revoke insert, update, delete, truncate on public.profiles                from PUBLIC;
-- revoke insert, update, delete, truncate on public.places                  from PUBLIC;
-- revoke insert, update, delete, truncate on public.applications            from PUBLIC;
-- revoke insert, update, delete, truncate on public.application_submissions from PUBLIC;
-- revoke insert, update, delete, truncate on public.messages                from PUBLIC;
-- revoke insert, update, delete, truncate on public.sales                   from PUBLIC;
-- revoke insert, update, delete, truncate on public.seller_documents        from PUBLIC;
-- revoke insert, update, delete, truncate on public.menus                   from PUBLIC;
-- revoke insert, update, delete, truncate on public.sns_links               from PUBLIC;
-- revoke update, delete, truncate         on public.reviews                 from PUBLIC;
-- grant update                 on public.profiles                to authenticated;
-- grant insert, update, delete on public.places                  to authenticated;
-- grant insert, update, delete on public.applications            to authenticated;
-- grant insert, update, delete on public.application_submissions to authenticated;
-- grant insert, update, delete on public.messages                to authenticated;
-- grant insert, update, delete on public.sales                   to authenticated;
-- grant insert, update, delete on public.seller_documents        to authenticated;
-- grant insert, delete         on public.menus                   to authenticated;
-- grant insert, delete         on public.sns_links               to authenticated;
-- grant update                 on public.reviews                 to authenticated;
-- -- app/api/* は service_role で全部の表を書く。PUBLIC を落としたら付け直す
-- grant insert, update, delete on public.profiles                to service_role;
-- grant insert, update, delete on public.places                  to service_role;
-- grant insert, update, delete on public.applications            to service_role;
-- grant insert, update, delete on public.application_submissions to service_role;
-- grant insert, update, delete on public.messages                to service_role;
-- grant insert, update, delete on public.sales                   to service_role;
-- grant insert, update, delete on public.seller_documents        to service_role;
-- grant insert, update, delete on public.menus                   to service_role;
-- grant insert, update, delete on public.sns_links               to service_role;
-- grant insert, update, delete on public.reviews                 to service_role;
-- commit;


-- ============================================================
-- ③-3 落とさないもの（落とすと壊れる。記録として残す）
-- ============================================================
--
--   reviews / anon の INSERT
--     公開の出店者ページから、ログインなしでレビューを投稿できる作りになっている
--     （status='pending' で入り、運営が公開を切り替える）。
--     anon の INSERT を落とすと投稿が 42501 で失敗する。
--     ここを締めるなら「APIを1本作って、そこから入れる」形に変えるのが先。
--     ※ anon の UPDATE / DELETE / TRUNCATE は③-2 で落とす（残す理由が無い）。
--
--   すべての表・ビューの SELECT
--     公開ページ（案件一覧・出店者一覧・ブログ）は anon キーで読んでいる。
--     読み取りの絞り込みは RLS とビューの列で行う方針なので、権限では落とさない。
--
--   public_sellers
--     20260919_public_sellers_no_name.sql で revoke all → grant select 済み。
--     ②を流したあとは、作り直しても書き込みが付かなくなる。
--
--   service_role の権限
--     app/api/* がこの役割で動いている。ここを落とすとサイトが止まる。
--     ③-1 は PUBLIC からも落とすので、同じ段落で service_role に付け直している。


-- ============================================================
-- ③-4 コードから使われていない4表から落とす
--      （この段落だけを選択して実行）
-- ============================================================
--
-- 2026-09-22 に本番で「anon が insert できるのに、③-1・③-2 のどちらの一覧にも
-- 無い表」を数えたところ、次の4つが出た。いずれも RLS は有効。
--
--   case_files        ポリシー0本
--   file_attachments  ポリシー3本
--   notification_logs ポリシー0本
--   referrer_rates    ポリシー0本
--
-- 4つとも app / components / scripts / supabase / docs のどこからも参照されていない
-- （2026-09-22 に grep で確認。参照0件）。使っていないので落としても画面は変わらない。
--
-- ポリシーが0本の3つは、RLS が有効なので実際には書けない（RLS は既定で全部拒否）。
-- 実害は無いが、権限が付いたままだと「RLS を外した瞬間に書ける」状態が残る。
-- file_attachments はポリシーが3本あるので、RLS を通れば書ける可能性がある。
--
-- 将来この表を使うときは、その移行ファイルの中で必要な権限を明示すること
-- （冒頭の手順5と同じ）。

begin;

revoke insert, update, delete, truncate on public.case_files        from PUBLIC, anon, authenticated;
revoke insert, update, delete, truncate on public.file_attachments  from PUBLIC, anon, authenticated;
revoke insert, update, delete, truncate on public.notification_logs from PUBLIC, anon, authenticated;
revoke insert, update, delete, truncate on public.referrer_rates    from PUBLIC, anon, authenticated;

-- PUBLIC 経由だった分を付け直す（③-1 と同じ理由）
grant insert, update, delete on public.case_files        to service_role;
grant insert, update, delete on public.file_attachments  to service_role;
grant insert, update, delete on public.notification_logs to service_role;
grant insert, update, delete on public.referrer_rates    to service_role;

commit;


-- ============================================================
-- ④ 流したあとの確認（この段落だけを選択して実行。1文なのでまとめて出る）
-- ============================================================
--
-- 合格の条件：
--   既定権限に残る書き込み … 0件（表・ビュー。全スキーマの行も数えている）
--   既定権限に残る関数の実行 … 0件（②の後半2文が効いたかどうか）
--   サーバー専用の表に残る書き込み … 0件（anon / authenticated）
--   service_roleが書ける表の数 … 14（③-1 の14表すべて。①-5 と同じ）
--   関数を実行できる組 … ①-3 の行数と同じ（is_admin が消えていないこと）
--   ログイン中が書く表 … anon は false、authenticated は true
--   anon_reviews投稿 … true（公開ページからのレビュー投稿が通ること）
--   anon_reviews更新 … false（③-2 で落とした分）
--   anon_公開一覧読取 … true（/sellers・トップの出店者枠が出ること）
--   ③-4 の4表（case_files / file_attachments / notification_logs / referrer_rates）は
--   「サーバー専用の表に残る書き込み」には数えていない。下の1文で別に確かめる:
--     select c.relname, has_table_privilege('anon', c.oid, 'insert') as anon追加
--       from pg_class c join pg_namespace n on n.oid = c.relnamespace
--      where n.nspname = 'public'
--        and c.relname in ('case_files','file_attachments','notification_logs','referrer_rates');
--   → 4行すべて false になっていること
select
  (select count(*)
     from pg_default_acl a,
          aclexplode(a.defaclacl) x
    where (a.defaclnamespace = 0
        or coalesce(nullif(a.defaclnamespace, 0)::regnamespace::text, '') = 'public')
      and a.defaclobjtype = 'r'
      -- grantee = 0 は PUBLIC（anon / authenticated が継承する相手）
      and (x.grantee = 0 or pg_get_userbyid(x.grantee) in ('anon', 'authenticated'))
      and x.privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'))        as 既定権限に残る書き込み,
  (select count(*)
     from pg_default_acl a,
          aclexplode(a.defaclacl) x
    where (a.defaclnamespace = 0
        or coalesce(nullif(a.defaclnamespace, 0)::regnamespace::text, '') = 'public')
      and a.defaclobjtype = 'f'
      and (x.grantee = 0 or pg_get_userbyid(x.grantee) in ('anon', 'authenticated'))
      and x.privilege_type = 'EXECUTE')                                          as 既定権限に残る関数の実行,
  (select count(*) from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     cross join pg_roles r
    where n.nspname = 'public'
      and c.relkind in ('r', 'p', 'v', 'm')
      and r.rolname in ('anon', 'authenticated')
      and c.relname in ('contacts','meeting_requests','signup_sources','invoices','posts',
                        'onsite_notes','notify_recipients','mail_templates','mail_send_log',
                        'password_notice_log','sales_reminder_log','purge_log',
                        'imported_sellers','line_debug')
      and (has_table_privilege(r.oid, c.oid, 'insert')
        or has_table_privilege(r.oid, c.oid, 'update')
        or has_table_privilege(r.oid, c.oid, 'delete')))                         as サーバー専用の表に残る書き込み,
  (select count(*) from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relname in ('contacts','meeting_requests','signup_sources','invoices','posts',
                        'onsite_notes','notify_recipients','mail_templates','mail_send_log',
                        'password_notice_log','sales_reminder_log','purge_log',
                        'imported_sellers','line_debug')
      and has_table_privilege('service_role', c.oid, 'insert')
      and has_table_privilege('service_role', c.oid, 'update')
      and has_table_privilege('service_role', c.oid, 'delete'))                  as service_roleが書ける表の数,
  (select count(*) from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     cross join pg_roles r
    where n.nspname = 'public'
      and r.rolname in ('anon', 'authenticated')
      and has_function_privilege(r.oid, p.oid, 'execute'))                       as 関数を実行できる組,
  has_table_privilege('anon',          'public.profiles', 'update')              as anon_profiles更新,
  has_table_privilege('authenticated', 'public.profiles', 'update')              as ログイン_profiles更新,
  has_table_privilege('anon',          'public.places',   'insert')              as anon_places追加,
  has_table_privilege('authenticated', 'public.places',   'insert')              as ログイン_places追加,
  has_table_privilege('anon',          'public.reviews',  'insert')              as anon_reviews投稿,
  has_table_privilege('anon',          'public.reviews',  'update')              as anon_reviews更新,
  has_table_privilege('anon',          'public.public_sellers', 'select')         as anon_公開一覧読取,
  has_table_privilege('service_role',  'public.public_sellers', 'select')         as service_role読取;

-- 確認（ブラウザから。SQLではなくターミナルで）
--   公開ページが読めること
--     curl "$URL/rest/v1/public_sellers?select=id&limit=1" -H "apikey: $ANON_KEY"
--   サーバー専用の表に書けないこと（42501 permission denied が返れば成功）
--     curl -X POST "$URL/rest/v1/signup_sources" \
--       -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
--       -H "Content-Type: application/json" -d '{"role":"seller"}'
--   レビュー投稿が通ること（画面から。/sellers/<承認済み出店者のID> で送信）
--   ログイン後の画面が書けること（案件の作成・売上報告・書類の提出を1つずつ）


-- ============================================================
-- ⑤ 元に戻すSQL（画面が壊れたときだけ。書き込み権限がまた広がる）
-- ============================================================
--
-- ★これは「元とまったく同じ形」には戻さない。既定権限やACLが
--   直付けだったか PUBLIC 経由だったかは、revoke したあとでは分からないため。
--   元の形が要るときは、①-1 の「既定の権限」と①-2 の「いまのACL」で
--   控えた生の値を見て手で組み立てること（控えていないと復元できない）。
--
-- ②を戻す（これから作るものに、また書き込みが付くようになる）。
-- 落とした相手（PUBLIC / anon / authenticated）に付け直す
--
-- begin;
-- alter default privileges for role postgres in schema public
--   grant insert, update, delete, truncate on tables to PUBLIC;
-- alter default privileges for role postgres in schema public
--   grant insert, update, delete, truncate on tables to anon, authenticated;
-- alter default privileges for role postgres in schema public
--   grant execute on functions to PUBLIC;
-- alter default privileges for role postgres in schema public
--   grant execute on functions to anon, authenticated;
-- commit;
--
-- ③-1 を戻す（サーバー専用の表に、また anon の書き込みが付く）。
-- service_role には③-1 で明示的に付けてあるので、ここでは触らない
--
-- begin;
-- grant insert, update, delete, truncate on public.contacts            to PUBLIC, anon, authenticated;
-- grant insert, update, delete, truncate on public.meeting_requests    to PUBLIC, anon, authenticated;
-- grant insert, update, delete, truncate on public.signup_sources      to PUBLIC, anon, authenticated;
-- grant insert, update, delete, truncate on public.invoices            to PUBLIC, anon, authenticated;
-- grant insert, update, delete, truncate on public.posts               to PUBLIC, anon, authenticated;
-- grant insert, update, delete, truncate on public.onsite_notes        to PUBLIC, anon, authenticated;
-- grant insert, update, delete, truncate on public.notify_recipients   to PUBLIC, anon, authenticated;
-- grant insert, update, delete, truncate on public.mail_templates      to PUBLIC, anon, authenticated;
-- grant insert, update, delete, truncate on public.mail_send_log       to PUBLIC, anon, authenticated;
-- grant insert, update, delete, truncate on public.password_notice_log to PUBLIC, anon, authenticated;
-- grant insert, update, delete, truncate on public.sales_reminder_log  to PUBLIC, anon, authenticated;
-- grant insert, update, delete, truncate on public.purge_log           to PUBLIC, anon, authenticated;
-- grant insert, update, delete, truncate on public.imported_sellers    to PUBLIC, anon, authenticated;
-- grant insert, update, delete, truncate on public.line_debug          to PUBLIC, anon, authenticated;
-- commit;
--
-- ③-2 を戻す（ログイン中が書く表に、また anon の書き込みが付く）
--
-- begin;
-- grant insert, update, delete, truncate on public.profiles                to anon;
-- grant insert, update, delete, truncate on public.places                  to anon;
-- grant insert, update, delete, truncate on public.applications            to anon;
-- grant insert, update, delete, truncate on public.application_submissions to anon;
-- grant insert, update, delete, truncate on public.messages                to anon;
-- grant insert, update, delete, truncate on public.sales                   to anon;
-- grant insert, update, delete, truncate on public.seller_documents        to anon;
-- grant insert, update, delete, truncate on public.menus                   to anon;
-- grant insert, update, delete, truncate on public.sns_links               to anon;
-- grant update, delete, truncate          on public.reviews                to anon;
-- commit;
