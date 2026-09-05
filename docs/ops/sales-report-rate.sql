-- 売上報告がどれだけ出ているかを数える。
--
-- 「報告が出てこない」という問題の大きさと、いまの催促メールが
-- 効いているのかどうかを見るためのもの。読み取りだけで、何も変えない。
--
-- Supabase の SQL Editor は最後の結果しか出さないので、1本ずつ流すこと。


-- ① 全体の提出率
--
-- 対象は「承認済み・出店日が過ぎている・日付が入っている」申込。
-- 出店日当日はまだ営業中のことがあるため、翌日以降を対象にする。
select
  count(*)                                                as 出店が終わった件数,
  count(*) filter (where s.application_id is not null)    as 報告あり,
  count(*) filter (where s.application_id is null)        as 報告なし,
  round(100.0 * count(*) filter (where s.application_id is not null)
        / nullif(count(*), 0), 1)                         as 提出率
from public.applications a
left join (select distinct application_id from public.sales) s
       on s.application_id = a.id
where a.status = 'approved'
  and a.apply_date is not null
  and a.apply_date < (now() at time zone 'Asia/Tokyo')::date;


-- ② 月ごとの推移（最近12か月）
--
-- 提出率が下がってきているのか、ずっとこうなのかを見る。
select
  to_char(a.apply_date, 'YYYY-MM')                        as 出店月,
  count(*)                                                as 出店件数,
  count(*) filter (where s.application_id is not null)    as 報告あり,
  round(100.0 * count(*) filter (where s.application_id is not null)
        / nullif(count(*), 0), 1)                         as 提出率
from public.applications a
left join (select distinct application_id from public.sales) s
       on s.application_id = a.id
where a.status = 'approved'
  and a.apply_date is not null
  and a.apply_date < (now() at time zone 'Asia/Tokyo')::date
  and a.apply_date >= (now() at time zone 'Asia/Tokyo')::date - interval '12 months'
group by 1
order by 1 desc;


-- ③ 催促メールは効いているか  ★これがいちばん知りたいこと
--
-- 催促を送った申込と、送っていない申込で、提出率がどれだけ違うか。
-- 送ったほうが高ければ催促は効いている。変わらなければ効いていない。
--
-- 注意: sales_reminded_at は「報告済みだったので送信対象から外した」場合にも
-- 入る作り（route.ts の done の処理）。そのため単純比較はできない。
-- ここでは「催促を送った時点より後に報告されたか」で見る。
select
  case
    when a.sales_reminded_at is null then '催促を送っていない'
    else '催促を送った'
  end                                                     as 区分,
  count(*)                                                as 件数,
  count(*) filter (where s.first_report is not null)      as 報告あり,
  round(100.0 * count(*) filter (where s.first_report is not null)
        / nullif(count(*), 0), 1)                         as 提出率,
  count(*) filter (where a.sales_reminded_at is not null
                     and s.first_report > a.sales_reminded_at)
                                                          as 催促のあとに報告した件数
from public.applications a
left join (select application_id, min(created_at) as first_report
           from public.sales group by application_id) s
       on s.application_id = a.id
where a.status = 'approved'
  and a.apply_date is not null
  and a.apply_date < (now() at time zone 'Asia/Tokyo')::date
group by 1;


-- ④ 誰が出していないのか
--
-- 特定の出店者に偏っているのか、広く薄く出ていないのかを見る。
-- 偏っているなら、その方たちに直接ご連絡するのが早い。
select
  coalesce(nullif(p.shop_name, ''), p.name)               as 出店者,
  p.email                                                 as メール,
  count(*)                                                as 未報告の件数,
  min(a.apply_date)                                       as いちばん古い未報告,
  max(a.apply_date)                                       as いちばん新しい未報告
from public.applications a
join public.profiles p on p.id = a.seller_id
left join (select distinct application_id from public.sales) s
       on s.application_id = a.id
where a.status = 'approved'
  and a.apply_date is not null
  and a.apply_date < (now() at time zone 'Asia/Tokyo')::date
  and s.application_id is null
group by 1, 2
order by 3 desc
limit 40;


-- ⑤ 報告までにどれくらいかかっているか
--
-- 出店日の翌日にすぐ出すのか、何日も経ってから出すのか。
-- 催促を送るタイミングを決めるのに使う。
select
  case
    when d <= 1  then '出店の翌日まで'
    when d <= 3  then '2〜3日'
    when d <= 7  then '4〜7日'
    when d <= 14 then '8〜14日'
    when d <= 30 then '15〜30日'
    else '31日以上'
  end                                                     as 報告までの日数,
  count(*)                                                as 件数
from (
  select (min(s.created_at) at time zone 'Asia/Tokyo')::date - a.apply_date as d
  from public.applications a
  join public.sales s on s.application_id = a.id
  where a.status = 'approved' and a.apply_date is not null
  group by a.id, a.apply_date
) t
where d >= 0
group by 1
order by min(d);
