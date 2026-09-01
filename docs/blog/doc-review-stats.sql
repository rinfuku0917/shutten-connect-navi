-- 書類審査の実績を集計する（記事に載せる一次情報を作るため）
--
-- 2026-09-02 修正2回目：
--   ・列名を created_at → uploaded_at に直した
--     （seller_documents の実際の列は id / seller_id / doc_type / file_url /
--       status / uploaded_at / reviewed_at / expiry_date / reject_reason）
--   ・Supabase の SQL Editor は最後のクエリの結果しか出さないため、
--     1回の実行で全部見えるように1つの表にまとめた
--
-- 出てくるのは件数と割合だけで、出店者の名前やファイルは一切含まない。

with d as (
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
    status, reject_reason, uploaded_at, reviewed_at, expiry_date, seller_id
  from seller_documents
)
select * from (

  -- ① 書類の種類ごとの提出状況と、期限の状態
  select 1 as 並び, 書類 as 区分,
    count(*)::text                                                   as 件数,
    count(*) filter (where status = 'approved')::text                as 承認,
    count(*) filter (where status = 'rejected')::text                as 否認,
    count(*) filter (where status = 'pending')::text                 as 審査中,
    count(*) filter (where expiry_date < current_date)::text         as 期限切れ
  from d group by 書類

  union all

  -- ② 否認の理由（多い順に10件まで）
  select 2, '否認理由：' || left(reject_reason, 40),
    count(*)::text, '', '', '', ''
  from d
  where status = 'rejected' and reject_reason is not null and btrim(reject_reason) <> ''
  group by reject_reason
  order by 1, 3 desc
) t
limit 40;

-- ここから下は、上の結果を見たあとで必要なら1つずつ実行する。
-- （SQL Editor は最後の結果しか出さないため、まとめて流すと上が見えなくなる）

-- ③ 出店者ごとに、承認済みの書類が何種類あるか（必須は6種類）
-- with per_seller as (
--   select seller_id, count(*) filter (where status = 'approved') as 承認済みの数
--   from seller_documents group by seller_id
-- )
-- select 承認済みの数, count(*) as 出店者数
-- from per_seller group by 承認済みの数 order by 承認済みの数;

-- ④ 提出から審査完了までの日数
-- select
--   count(*) as 審査済みの件数,
--   round(avg(extract(epoch from (reviewed_at - uploaded_at)) / 86400)::numeric, 1) as 平均日数,
--   round((percentile_cont(0.5) within group (
--     order by extract(epoch from (reviewed_at - uploaded_at)) / 86400))::numeric, 1) as 中央値の日数
-- from seller_documents
-- where reviewed_at is not null and uploaded_at is not null;
