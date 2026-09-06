-- ログイン状態がどれだけ持っているかを測る。
--
-- 「パスワードを忘れる」の背景に「すぐログアウトされるので何度も入力させられる」が
-- あるのではないか、という見立てを確かめるためのもの。読み取りだけ。
--
-- Supabase の SQL Editor は最後の結果しか出さないので、1本ずつ流すこと。


-- ① セッションはどれだけ生きているか  ★これが本命
--
-- created_at … ログインした時刻
-- updated_at … 最後に使われた時刻（自動更新のたびに新しくなる）
-- 差が「そのセッションが実際に使われ続けた期間」。
--
-- 見るところ:
--   中央値が数時間 → すぐ切れている。設定を延ばす価値がある
--   中央値が数日〜数週間 → セッションは持っている。原因は別
select
  count(*)                                                          as セッション数,
  round(avg (extract(epoch from (updated_at - created_at)) / 3600)::numeric, 1) as 平均_時間,
  round((percentile_cont(0.5) within group (
          order by extract(epoch from (updated_at - created_at)) / 3600))::numeric, 1) as 中央値_時間,
  round((percentile_cont(0.9) within group (
          order by extract(epoch from (updated_at - created_at)) / 3600))::numeric, 1) as 上位1割_時間,
  -- 数字で始まる名前は引用符で囲む（囲まないと数値として読まれてエラーになる）
  count(*) filter (where updated_at - created_at <  interval '1 hour') as "1時間未満",
  count(*) filter (where updated_at - created_at >= interval '7 days') as "7日以上"
from auth.sessions;


-- ② 強制的に切る設定が入っていないか
--
-- not_after に値が入っていると、その時刻でセッションが切れる
-- （Supabase の「Time-box user sessions」を設定するとここに入る）。
-- 全部 null なら、時間での強制切断は設定されていない。
select
  count(*)                                as セッション数,
  count(not_after)                        as 期限が設定されているもの,
  min(not_after)                          as いちばん早い期限,
  max(not_after)                          as いちばん遅い期限
from auth.sessions;


-- ③ 同じ人が何回ログインし直しているか  ★これも効く
--
-- セッションが多い人ほど「入り直させられている」。
-- 1〜2なら正常。5以上が並ぶなら、切れている疑いが濃い。
select
  coalesce(nullif(p.shop_name, ''), p.name)                as 出店者,
  count(*)                                                 as ログインし直した回数,
  min(s.created_at)::date                                  as 最初,
  max(s.created_at)::date                                  as 最後,
  round(avg(extract(epoch from (s.updated_at - s.created_at)) / 3600)::numeric, 1) as 平均で何時間もったか
from auth.sessions s
join public.profiles p on p.id = s.user_id
where p.role = 'seller'
group by 1
having count(*) >= 2
order by 2 desc
limit 25;


-- ④ どの端末・ブラウザから入っているか
--
-- LINE のアプリ内ブラウザは、通常のブラウザとは別の保存領域を使う。
-- LINE から開いた日と Safari から開いた日で、別々にログインが要る。
-- これが「毎回ログインさせられる」の正体である可能性がある。
--
-- Line / FBAV / Instagram が多ければ、その線が濃い。
select
  case
    when s.user_agent ilike '%Line%'      then 'LINE のアプリ内'
    when s.user_agent ilike '%FBAV%'
      or s.user_agent ilike '%FBAN%'      then 'Facebook のアプリ内'
    when s.user_agent ilike '%Instagram%' then 'Instagram のアプリ内'
    when s.user_agent ilike '%CriOS%'     then 'iPhone の Chrome'
    when s.user_agent ilike '%Android%'   then 'Android のブラウザ'
    when s.user_agent ilike '%iPhone%'    then 'iPhone の Safari'
    when s.user_agent ilike '%Macintosh%' then 'パソコン（Mac）'
    when s.user_agent ilike '%Windows%'   then 'パソコン（Windows）'
    else coalesce(left(s.user_agent, 40), '(記録なし)')
  end                                                       as 入り口,
  count(*)                                                  as セッション数,
  round(avg(extract(epoch from (s.updated_at - s.created_at)) / 3600)::numeric, 1) as 平均で何時間もったか
from auth.sessions s
group by 1
order by 2 desc;
