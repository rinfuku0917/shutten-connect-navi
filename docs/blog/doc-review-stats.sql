-- 書類審査の実績を集計する（記事に載せる一次情報を作るため）
--
-- 記事に「他社が書けない中身」を入れるための材料。
-- seller_documents は個人情報を含むため匿名キーでは読めない。
-- このSQLを SQL Editor で実行し、結果をそのまま貼って返してほしい。
--
-- 出てくるのは件数と割合だけで、出店者の名前やファイルは一切含まない。

-- ① 書類の種類ごとの提出状況
select
  case doc_type
    when 'license_front'       then '運転免許証（表面）'
    when 'license_back'        then '運転免許証（裏面）'
    when 'food_hygiene'        then '食品衛生責任者証'
    when 'liability_insurance' then '損害賠償保険証書'
    when 'business_permit'     then '営業許可証'
    when 'pl_insurance'        then 'PL保険証券'
    when 'inspection_sample'   then '検体（検査結果）'
    when 'other_permit'        then 'その他許可証'
    else doc_type
  end as 書類,
  count(*)                                          as 提出数,
  count(*) filter (where status = 'approved')       as 承認,
  count(*) filter (where status = 'rejected')       as 否認,
  count(*) filter (where status = 'pending')        as 審査中,
  round(100.0 * count(*) filter (where status = 'rejected')
        / nullif(count(*), 0), 1)                   as 否認率
from seller_documents
group by doc_type
order by 提出数 desc;

-- ② 否認の理由（何が足りなくて落ちているか）
--    記事にする際は、ここから「よくある不備」を数パターンにまとめる
select reject_reason as 否認理由, count(*) as 件数
from seller_documents
where status = 'rejected' and reject_reason is not null and btrim(reject_reason) <> ''
group by reject_reason
order by 件数 desc
limit 30;

-- ③ 出店者が何種類そろえているか（必須は6種類）
with per_seller as (
  select seller_id,
         count(*) filter (where status = 'approved') as 承認済みの数
  from seller_documents
  group by seller_id
)
select 承認済みの数, count(*) as 出店者数
from per_seller
group by 承認済みの数
order by 承認済みの数;

-- ④ 提出から審査完了までの日数
select
  count(*)                                                        as 審査済みの件数,
  round(avg(extract(epoch from (reviewed_at - created_at)) / 86400)::numeric, 1) as 平均日数,
  round((percentile_cont(0.5) within group (
    order by extract(epoch from (reviewed_at - created_at)) / 86400))::numeric, 1) as 中央値の日数
from seller_documents
where reviewed_at is not null and created_at is not null;
