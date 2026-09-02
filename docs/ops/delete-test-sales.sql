-- テストで入れた売上を消す（2026-09-03）
--
-- 残すのは 井田 麻依子（ふくろうクレープ）さんの売上だけ。
--   seller_id = 'fbc01e9f-a45f-48c7-8f3b-da8cd5f47369'
--
-- ★★ 消す前に、まず【手順1】だけを流して結果を確認してください。★★
--   売上は元に戻せません。誰の・いつの・いくらの記録が消えるのかを
--   目で見てから【手順2】へ進んでください。
--
-- 請求書（invoices）もあわせて扱います。
--   invoices は sale_ids に「どの売上から作ったか」を持っています。
--   売上だけ消すと、請求書が存在しない売上を指したまま残ります。
--   金額の突き合わせができなくなるので、対象の請求書も一緒に消します。


-- ================================================================
-- 【手順1】いま何が入っているかを見る（消しません）
-- ================================================================

-- 1-a. 出店者ごとの売上件数と金額
select
  coalesce(p.shop_name, p.name, '(名前なし)') as 出店者,
  s.seller_id,
  count(*)                                    as 件数,
  min(s.sale_date)                            as 最初の売上日,
  max(s.sale_date)                            as 最後の売上日,
  sum(s.revenue)                              as 売上合計,
  sum(s.total_pay)                            as 出店料合計,
  case when s.seller_id = 'fbc01e9f-a45f-48c7-8f3b-da8cd5f47369'
       then '★残す' else '消す' end            as 扱い
from sales s
left join profiles p on p.id = s.seller_id
group by s.seller_id, p.shop_name, p.name
order by 扱い, 件数 desc;

-- 1-b. 消える売上の明細（30件まで）
select
  coalesce(p.shop_name, p.name, '(名前なし)') as 出店者,
  s.sale_date as 売上日, pl.title as 案件, s.revenue as 売上, s.total_pay as 出店料
from sales s
left join profiles p on p.id = s.seller_id
left join places pl on pl.id = s.place_id
where s.seller_id is distinct from 'fbc01e9f-a45f-48c7-8f3b-da8cd5f47369'
order by s.sale_date desc
limit 30;

-- 1-c. 消える請求書
select
  i.invoice_no as 請求書番号,
  coalesce(p.shop_name, p.name, '(名前なし)') as 出店者,
  i.period as 対象月, i.total as 税込合計, i.paid_status as 入金状況
from invoices i
left join profiles p on p.id = i.seller_id
where i.seller_id is distinct from 'fbc01e9f-a45f-48c7-8f3b-da8cd5f47369'
order by i.period desc;

-- 1-d. 入金済みの請求書が混ざっていないか（混ざっていたら要注意）
select count(*) as 入金済みなのに消える請求書
from invoices
where seller_id is distinct from 'fbc01e9f-a45f-48c7-8f3b-da8cd5f47369'
  and paid_status = 'paid';

-- 1-e. 安全確認。井田さんの売上が「残る」側に入っているか
--      残す件数が0だったら、絶対に手順2へ進まないでください。
select
  count(*) filter (where seller_id = 'fbc01e9f-a45f-48c7-8f3b-da8cd5f47369') as 残す_井田さん,
  count(*) filter (where seller_id is distinct from 'fbc01e9f-a45f-48c7-8f3b-da8cd5f47369') as 消す,
  count(*) filter (where seller_id is null) as うち出店者が空の行,
  count(*) as 全部
from sales;


-- ================================================================
-- 【手順2】消す
--
-- 手順1の結果を確認してから、ここから下だけを選んで実行してください。
-- 請求書 → 売上 の順で消します（請求書が売上を参照しているため）。
-- ================================================================

-- 2-a. 請求書を消す
-- delete from invoices
-- where seller_id is distinct from 'fbc01e9f-a45f-48c7-8f3b-da8cd5f47369';

-- 2-b. 売上を消す
-- delete from sales
-- where seller_id is distinct from 'fbc01e9f-a45f-48c7-8f3b-da8cd5f47369';


-- ================================================================
-- 【手順3】結果の確認
-- ================================================================

-- select
--   (select count(*) from sales)    as 残った売上,
--   (select count(*) from invoices) as 残った請求書,
--   (select count(*) from sales
--      where seller_id = 'fbc01e9f-a45f-48c7-8f3b-da8cd5f47369') as うち井田さんの売上;
