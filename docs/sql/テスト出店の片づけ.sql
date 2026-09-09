-- テストで作った出店が取り消せない・消せないときの調べ方と片づけ方。
--
-- 管理画面から片づけられるのがふだんの形です（出店管理 → 日付 → その出店 →
-- 「この出店を取り消す」）。画面で止まる理由が分からないとき、
-- または画面から片づけきれないときに、これを使ってください。
--
-- 使い方: Supabase の SQL Editor に貼り、【1】から順に実行します。
--         【3】以降は消す操作です。実行する前に必ず【1】の結果を見てください。


-- ============================================================
-- 【1】その出店に何が残っているかを調べる（読むだけ・安全）
-- ============================================================
-- 屋号と出店日を書き換えてください。
with 対象 as (
  select a.id, a.seller_id, a.place_id, a.apply_date, a.status,
         p.title as 案件名,
         coalesce(pr.shop_name, pr.name) as 屋号
  from public.applications a
  left join public.places p   on p.id = a.place_id
  left join public.profiles pr on pr.id = a.seller_id
  where coalesce(pr.shop_name, pr.name) like '%ベイビーカステラ%'   -- ← 屋号
    and a.apply_date = '2026-09-08'                                  -- ← 出店日
)
select
  t.id as 出店ID,
  t.屋号, t.案件名, t.apply_date as 出店日, t.status as 状態,
  (select count(*) from public.sales s where s.application_id = t.id) as 売上報告の件数,
  (select count(*) from public.invoices i
     where i.application_id = t.id and i.voided_at is null)          as 有効な請求書,
  (select count(*) from public.invoices i
     where i.seller_id = t.seller_id
       and i.period = to_char(t.apply_date, 'YYYY-MM')
       and i.voided_at is null)                                      as 同じ月の有効な請求書,
  (select count(*) from public.messages m where m.application_id = t.id) as メッセージ,
  -- 当日の進行。ひとつでも入っていると、ふだんの取消しでは止まります
  (a.confirmed_at is not null or a.checked_in_at is not null
   or a.ready_at is not null or a.opened_at is not null
   or a.closed_at is not null or a.left_at is not null)              as 当日の記録あり
from 対象 t
join public.applications a on a.id = t.id;

-- 読み方
--   状態 = approved       … まだ取り消していません。画面の「この出店を取り消す」から
--   状態 = cancelled      … 取り消し済み。画面の「完全に削除」で消せます
--   売上報告の件数 > 0    … 先に売上管理でその報告を削除してください
--   有効な請求書 > 0      … 先に売上管理でその請求書を取り消してください
--   当日の記録あり = true … 画面の「当日の記録も消して取り消す」で片づきます


-- ============================================================
-- 【2】この出店者のテスト用の売上・請求書を一覧で見る（読むだけ・安全）
-- ============================================================
select '売上報告' as 種類, s.id::text as ID, s.sale_date::text as 日付,
       s.revenue::text as 金額, '' as 備考
from public.sales s
join public.profiles pr on pr.id = s.seller_id
where coalesce(pr.shop_name, pr.name) like '%ベイビーカステラ%'       -- ← 屋号
union all
select '請求書', i.invoice_no, i.issued_on::text, i.total::text,
       case when i.voided_at is null then '有効' else '取り消し済み' end
from public.invoices i
join public.profiles pr on pr.id = i.seller_id
where coalesce(pr.shop_name, pr.name) like '%ベイビーカステラ%'       -- ← 屋号
order by 1, 3 desc;


-- ============================================================
-- 【3】ここから先は消す操作です
-- ============================================================
-- 【1】の結果を見てから、必要な行だけコメントを外して実行してください。
-- 出店IDは【1】の「出店ID」をそのまま貼ります。
--
-- ※ 本番の出店には使わないでください。テストで作ったものだけが対象です。

-- 3-1. 売上報告を消す（テストで報告したもの）
-- delete from public.sales where application_id = 'ここに出店IDを貼る';

-- 3-2. 請求書を消す（テストで発行したもの。入金確認済みは残す）
-- delete from public.invoices
--  where application_id = 'ここに出店IDを貼る'
--    and paid_status <> 'paid';

-- 3-3. 当日の進行の記録を消して、出店を取り消し済みにする
-- update public.applications
--    set status = 'cancelled',
--        cancelled_at = now(),
--        cancel_reason = 'テストデータの片づけ（SQL）',
--        confirmed_at = null, checked_in_at = null, ready_at = null,
--        opened_at = null, closed_at = null, left_at = null, checkin_seen_at = null
--  where id = 'ここに出店IDを貼る';

-- 3-4. 取り消し済みの出店を、一覧から完全に消す
--      （やり取りが残っていると消せないので、先に messages を消します）
-- delete from public.messages where application_id = 'ここに出店IDを貼る';
-- delete from public.applications
--  where id = 'ここに出店IDを貼る' and status = 'cancelled';


-- ============================================================
-- 【4】片づいたか確かめる
-- ============================================================
-- 【1】をもう一度実行してください。行が返らなければ消えています。
