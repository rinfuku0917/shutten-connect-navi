-- 案件ごとの「何ヶ月先まで申し込めるか」を系列ごとに入れる。
--
--   1ヶ月  イオン / サンユーストアー / スーパーあさの / さがみや
--   3ヶ月  Olympic / MEGAドン・キホーテ
--   それ以外は空のまま（＝上限なし）。必要になったら管理画面で個別に入れる。
--
-- 先に 20260904_apply_window.sql を流しておくこと。
--
-- 何度流しても同じ結果になる（上書きするだけ）。
-- 系列の店舗が増えたら、また流せば新しい店舗にも入る。


-- ────────────────────────────────────────────
-- ① まず対象を目で見る。ここでは何も変えない
-- ────────────────────────────────────────────
-- 意図しない案件が混ざっていないか確かめてから ② に進む。
-- たとえば「イオン」は店名の一部として広く使われるため、
-- 関係のない案件を拾っていないかをここで見る。

select
  case
    when title ilike '%Olympic%' or title like '%オリンピック%'
      or title like '%ドン・キホーテ%' or title like '%ドンキホーテ%' then '3ヶ月'
    when title like '%イオン%' or title like '%サンユー%'
      or title like '%あさの%'   or title like '%さがみや%' or title like '%サガミヤ%' then '1ヶ月'
  end                                as 入れる上限,
  title                              as 案件名,
  prefecture                         as 都道府県,
  apply_within_months                as いまの設定,
  case when closed then '募集終了' else '公開中' end as 状態
from public.places
where title ilike '%Olympic%' or title like '%オリンピック%'
   or title like '%ドン・キホーテ%' or title like '%ドンキホーテ%'
   or title like '%イオン%' or title like '%サンユー%'
   or title like '%あさの%'  or title like '%さがみや%' or title like '%サガミヤ%'
order by 入れる上限, title;


-- ────────────────────────────────────────────
-- ② 上限を入れる
-- ────────────────────────────────────────────
-- 3ヶ月を先に入れる。
-- 「MEGAドン・キホーテ 高井戸店（旧Olympic 高井戸店）」のように
-- 両方の名前が入った案件があるが、どちらも3ヶ月なので結果は変わらない。

update public.places
   set apply_within_months = 3
 where title ilike '%Olympic%'
    or title like '%オリンピック%'
    or title like '%ドン・キホーテ%'
    or title like '%ドンキホーテ%';

update public.places
   set apply_within_months = 1
 where (title like '%イオン%'
     or title like '%サンユー%'
     or title like '%あさの%'
     or title like '%さがみや%'
     or title like '%サガミヤ%')
   -- 3ヶ月を入れた案件を上書きしない（名前が重なる案件への保険）
   and apply_within_months is distinct from 3;


-- ────────────────────────────────────────────
-- ③ 入ったことを確かめる
-- ────────────────────────────────────────────

select
  coalesce(apply_within_months::text || 'ヶ月', '上限なし') as 上限,
  count(*)                                                  as 件数,
  count(*) filter (where not closed)                        as うち公開中
from public.places
group by apply_within_months
order by apply_within_months nulls last;

-- 系列ごとの内訳。想定は
--   1ヶ月  イオン23 / サンユー15 / あさの1 / さがみや1  = 40件
--   3ヶ月  Olympic16 / MEGAドンキ1                      = 17件
-- ※ 2026-09-02 時点の公開案件での数。増えていれば件数は変わる

select apply_within_months as 上限, title as 案件名
from public.places
where apply_within_months is not null
order by apply_within_months, title;
