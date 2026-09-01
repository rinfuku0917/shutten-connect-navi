-- 書類審査の実績を集計する（記事に載せる一次情報を作るため）
--
-- 2026-09-02 修正：列名を created_at → uploaded_at に直した。
--   seller_documents の実際の列は
--   id / seller_id / doc_type / file_url / status / uploaded_at / reviewed_at
--   / expiry_date / reject_reason
--   有効期限（expiry_date）があるので、期限切れの集計も足した。
--
-- SQL Editor では、途中で1つ失敗すると全部止まる。
-- まとめて実行して落ちたら、①〜⑤を1つずつ流してほしい。
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
--    記事では、ここから「よくある不備」を数パターンにまとめる
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
  count(*) as 審査済みの件数,
  round(avg(extract(epoch from (reviewed_at - uploaded_at)) / 86400)::numeric, 1) as 平均日数,
  round((percentile_cont(0.5) within group (
    order by extract(epoch from (reviewed_at - uploaded_at)) / 86400))::numeric, 1) as 中央値の日数
from seller_documents
where reviewed_at is not null and uploaded_at is not null;

-- ⑤ 有効期限の状況（期限切れの書類がどれだけあるか）
--    「書類はそろえて終わりではない」と書くための裏づけ
select
  case doc_type
    when 'business_permit'     then '営業許可証'
    when 'pl_insurance'        then 'PL保険証券'
    when 'liability_insurance' then '損害賠償保険証書'
    when 'food_hygiene'        then '食品衛生責任者証'
    when 'inspection_sample'   then '検体（検査結果）'
    else doc_type
  end as 書類,
  count(*)                                                as 件数,
  count(*) filter (where expiry_date is null)             as 期限の登録なし,
  count(*) filter (where expiry_date < current_date)      as 期限切れ,
  count(*) filter (where expiry_date >= current_date
                     and expiry_date < current_date + 90) as あと90日以内に切れる
from seller_documents
group by doc_type
order by 件数 desc;
