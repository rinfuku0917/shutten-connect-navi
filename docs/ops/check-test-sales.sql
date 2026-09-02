-- 消す前の最終確認（2026-09-03）
--
-- Supabase の SQL Editor は最後のクエリの結果しか出さないため、
-- 見たいものを1つの表にまとめてある。まるごと貼って実行してほしい。
--
-- 何も消さない。SELECT だけ。

with ida as (select 'fbc01e9f-a45f-48c7-8f3b-da8cd5f47369'::uuid as id)
select * from (

  -- 売上7件を1件ずつ（誰の・いつ・いくら・残すか消すか）
  select
    1 as 並び,
    case when s.seller_id = (select id from ida) then '★残す' else '消す' end as 扱い,
    coalesce(p.shop_name, p.name, '(名前なし)')      as 対象,
    coalesce(s.sale_date::text, '-')                 as 日付,
    coalesce(pl.title, '(案件なし)')                  as 内容,
    coalesce(s.revenue::text, '-')                   as 金額
  from sales s
  left join profiles p  on p.id  = s.seller_id
  left join places   pl on pl.id = s.place_id

  union all

  -- 請求書を1件ずつ（入金済みが混ざっていないか）
  select
    2,
    case when i.seller_id = (select id from ida) then '★残す' else '消す' end,
    coalesce(p.shop_name, p.name, '(名前なし)'),
    i.period,
    '請求書 ' || i.invoice_no || '（' || coalesce(i.paid_status, '未設定') || '）',
    i.total::text
  from invoices i
  left join profiles p on p.id = i.seller_id

  union all

  -- まとめ
  select 3, '合計', '売上', '-', '残す ' || count(*) filter (where seller_id = (select id from ida))
    || ' / 消す ' || count(*) filter (where seller_id is distinct from (select id from ida)), count(*)::text
  from sales

  union all

  select 4, '合計', '請求書', '-', '残す ' || count(*) filter (where seller_id = (select id from ida))
    || ' / 消す ' || count(*) filter (where seller_id is distinct from (select id from ida)), count(*)::text
  from invoices

  union all

  -- ここが0でなければ、消す前に相談すること
  select 5, '★要注意', '入金済みなのに消える請求書', '-', '件数', count(*)::text
  from invoices
  where seller_id is distinct from (select id from ida) and paid_status = 'paid'

) t
order by 並び, 扱い desc, 日付;
