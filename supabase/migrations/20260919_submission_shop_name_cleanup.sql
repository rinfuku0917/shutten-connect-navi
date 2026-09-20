-- 案件ごとの提出内容（application_submissions.shop_name）に入ってしまった
-- 本名を消す。
--
-- 【なぜ要るか】
--   出店者が案件ごとの提出内容を初めて開くと、店舗名の初期値が
--     shop_name（屋号） → 無ければ name（本名）
--   の順で埋まっていた（app/dashboard/seller/SiteSubmissionForm.tsx）。
--   そのまま保存すると本名が application_submissions.shop_name に残る。
--   募集者は RLS ポリシー「hosts read submissions for own places」で
--   自分の案件の提出内容を読めるので、募集者の画面と、
--   募集者が出す施設提出Excelの店舗名欄に本名がそのまま載る
--   （app/lib/submissionXlsx.ts は sub.shop_name を最優先で使う）。
--
--   入力欄の初期値は本名で埋めないよう直した（同コミット）。
--   ただし、すでに保存されている行はそのまま残るので、ここで掃除する。
--   2026-09-19 に出店者ご本人から本名の件で申し出があった件の後始末。
--
-- 【どの行を消すか（消しすぎないための絞り込み）】
--   ・その出店者の profiles.shop_name が空であること
--       初期値が本名になったのは「屋号が空のとき」だけ。屋号が登録されている人の
--       提出内容が本名と一致していたら、それはご本人が意図して入れた名前なので触らない
--       （個人名で営業している方が実際にいる）
--   ・提出内容の shop_name が、その人の profiles.name と前後の空白を除いて一致すること
--
-- 【何に置き換えるか】
--   NULL にする。app/lib/submissionXlsx.ts は
--     submissionShopName(sub.shop_name || p.shop_name, …)
--   の順に見るので、NULL にすればプロフィールの屋号（今は空）へ落ち、
--   最後は「(屋号未登録)」と書かれる。募集者にも施設にも本名は渡らない。
--   「(屋号未登録)」という文字列をデータ側に書き込まないのは、
--   あとで屋号を登録したときに自動で直ってほしいため
--   （文字列を入れると、その行だけ古いまま残る）。
--
-- 【流し方】
--   Supabase の SQL エディタは、まとめて流すと最後の1文の結果しか画面に出ない。
--   「流す前の確認」は、本体より先に “その段落だけを選択して” 実行すること。
--
-- 【何度流しても同じ結果になる】
--   一致する行が無くなれば0件更新になるだけ。繰り返し実行してよい。

-- ============================================================
-- 流す前の確認（本体より先に、この段落だけを選択して実行する）
-- ============================================================

-- 何件が対象かを数える。名前そのものは出さない（件数だけ見る）
select count(*) as 掃除する行数
from public.application_submissions s
join public.profiles p on p.id = s.seller_id
where coalesce(btrim(p.shop_name), '') = ''
  and coalesce(btrim(p.name), '') <> ''
  and btrim(s.shop_name) = btrim(p.name);

-- 念のため、上の絞り込みから外れる「似た行」も数えておく。
-- 0 でなければ、屋号を登録済みの人の提出内容が本名と一致している行がある。
-- ご本人が意図して入れた名前の可能性が高いので、機械では消さず、
-- 件数だけ控えて個別に確かめること
select count(*) as 屋号登録済みで本名と一致する行数
from public.application_submissions s
join public.profiles p on p.id = s.seller_id
where coalesce(btrim(p.shop_name), '') <> ''
  and coalesce(btrim(p.name), '') <> ''
  and btrim(s.shop_name) = btrim(p.name);

-- ============================================================
-- 本体
-- ============================================================

begin;

update public.application_submissions s
set shop_name = null,
    updated_at = now()
from public.profiles p
where p.id = s.seller_id
  -- 初期値が本名で埋まったのは「屋号が空の人」だけ
  and coalesce(btrim(p.shop_name), '') = ''
  and coalesce(btrim(p.name), '') <> ''
  and btrim(s.shop_name) = btrim(p.name);

commit;

-- ============================================================
-- 流したあとの確認
-- ============================================================

-- 合格の条件：残り = 0
select count(*) as 残り
from public.application_submissions s
join public.profiles p on p.id = s.seller_id
where coalesce(btrim(p.shop_name), '') = ''
  and coalesce(btrim(p.name), '') <> ''
  and btrim(s.shop_name) = btrim(p.name);

-- ============================================================
-- 元に戻すSQL
-- ============================================================
--
--   戻せない。消した値（本名）はどこにも控えていない。
--   ただし失われるのは「本名が店舗名の欄に入っていた」という状態だけで、
--   本名そのものは profiles.name に残っている。
--   屋号を入れ直したい出店者は、マイページの提出内容から入力できる。
