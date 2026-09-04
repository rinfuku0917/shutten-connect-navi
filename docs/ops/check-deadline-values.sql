-- 応募締切（places.details->>'deadline'）に実際に何が入っているかを確かめる。
--
-- 20260904_apply_window_gate.sql で、締切を過ぎた申込をデータベース側で弾くようにした。
-- そのトリガーは「日付として読めない値は制限しない」作りにしてある。
-- 読めない値がどれくらいあるのか、この変更で申し込めなくなる案件が無いかを、
-- 移行を流す前に見ておく。
--
-- 読み取りだけ。データは何も変えない。
-- Supabase の SQL Editor に貼って、1つずつ流す。
--
-- このファイルの中では、text を date に変換する処理は
-- 「形が合っていることを確かめた後」でしか走らせていない。
-- details は自由な JSON なので、いきなり変換するとおかしな値ひとつで
-- 確認用のクエリ自体が落ちてしまうため。


-- 1) 締切の値を、形ごとに数える
--
-- ここでは変換を一切していないので、何が入っていても落ちない。
select
  case
    when nullif(btrim(coalesce(p.details->>'deadline', '')), '') is null
      then '未設定（null または空文字）'
    when p.details->>'deadline' ~ '^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$'
      then 'YYYY-MM-DD の形'
    else '日付の形になっていない'
  end as 締切の形,
  count(*) as 件数
from public.places p
group by 1
order by 2 desc;


-- 2) 日付の形になっていない値を、そのまま並べて見る
--
-- ここに出たものはトリガーが制限しない（＝今までどおり申し込める）。
-- 「2026年3月末」「未定」のような、人には読めるが日付ではない書き方が
-- 混ざっていないか確かめる。多いようなら、締切の運用そのものを見直す。
select
  p.id,
  p.title,
  coalesce(p.closed, false) as 募集終了,
  p.details->>'deadline' as 締切の生の値
from public.places p
where nullif(btrim(coalesce(p.details->>'deadline', '')), '') is not null
  and p.details->>'deadline' !~ '^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$'
order by p.title;


-- 3) 形は合っているのに、実在しない日になっているもの
--
-- 2026-02-30 のような値。これもトリガーは制限しない。
-- as materialized で先に絞り込んでから変換しているので、
-- 形が合わない値が to_date に渡ることはない。
with shaped as materialized (
  select p.id, p.title, p.details->>'deadline' as deadline_text
  from public.places p
  where p.details->>'deadline' ~ '^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$'
)
select
  s.id,
  s.title,
  s.deadline_text as 締切の生の値
from shaped s
where to_char(to_date(s.deadline_text, 'YYYY-MM-DD'), 'YYYY-MM-DD') <> s.deadline_text
order by s.title;


-- 4) この変更で、いま申し込めなくなる案件を先に把握する
--
-- 公開中で募集も終わっていないのに、締切だけが過ぎている案件。
-- 数が多いようなら、募集者に締切を直してもらうか、
-- 募集終了にしてもらうかを決めてから移行を流す。
with shaped as materialized (
  select p.id, p.title, p.details->>'deadline' as deadline_text
  from public.places p
  where coalesce(p.closed, false) = false
    and p.details->>'deadline' ~ '^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$'
)
select
  s.id,
  s.title,
  s.deadline_text::date as 応募締切,
  (now() at time zone 'Asia/Tokyo')::date - s.deadline_text::date as 何日過ぎているか
from shaped s
where s.deadline_text::date < (now() at time zone 'Asia/Tokyo')::date
order by 応募締切 desc;


-- 5) 募集終了の案件に、まだ審査中の申込が残っていないか
--
-- 今回の変更で新しい申込は入らなくなるが、すでに入っているものは残る。
-- 宙に浮いたままの申込があれば、運営から返事をする必要がある。
select
  p.title as 案件,
  count(*) as 審査中の申込
from public.applications a
join public.places p on p.id = a.place_id
where coalesce(p.closed, false) = true
  and a.status = 'pending'
group by p.title
order by 2 desc;
