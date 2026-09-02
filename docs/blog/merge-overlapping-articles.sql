-- 同じ検索語を取り合っていた記事を統合する（2026-09-02）
--
-- ★ 先に次の3本のSQLを流してから、こちらを実行すること。
--     docs/blog/kitchen-car-location-guide.sql   （統合先・本文の差し替え）
--     docs/blog/how-to-invite-kitchen-car.sql    （統合先・本文の差し替え）
--     docs/blog/weekday-food-truck-spots.sql     （重複章の削除）
--   順番が逆だと、統合先が古い本文のまま統合元だけが消える。
--
-- 何が起きていたか:
--   検証で、次の3組が同じ検索語を取り合っていると分かった。
--
--   1. choose-profitable-food-truck-location「売上が伸びる出店場所の選び方」
--      … 5つの視点のうち3つ（立地・客層とメニュー・曜日）が、
--        新しく書いた7本にすでに入っていた。
--        残る「試して記録する」を kitchen-car-location-guide に取り込んだ
--
--   2. host-fee-setting-guide2「出店料はどう決める？貸す側の料金設定ガイド」
--      … renting-parking-space（駐車場を貸す）が同じ話を実データつきで扱っている。
--        seo-keywords.md でも D-35 が両方に割り当たったままだった
--
--   3. event-food-truck-guide「イベントにキッチンカーを呼びたい主催者へ」
--      … how-to-invite-kitchen-car「イベントにキッチンカーを呼ぶには？」と
--        読者も内容もほぼ同じ。event 側にしかなかった「当日の運営」
--        （搬入・電源・配置・天候）を how-to-invite に取り込んだ
--
-- どうするか:
--   統合元は下書きに戻す（記事一覧とサイトマップから自動で消える）。
--   URLは next.config.ts の転送で統合先へ送るので、リンクは切れない。
--   本文は消さない。控えは docs/blog/*.previous.md にもある。

-- 実行前の確認
select slug, status, title, length(content) as 本文の文字数
from posts
where slug in (
  'choose-profitable-food-truck-location',
  'host-fee-setting-guide2',
  'event-food-truck-guide',
  'kitchen-car-location-guide',
  'how-to-invite-kitchen-car',
  'renting-parking-space'
)
order by slug;

-- 統合元3本を下書きに戻す
update posts set status = 'draft', updated_at = now()
where slug in (
  'choose-profitable-food-truck-location',
  'host-fee-setting-guide2',
  'event-food-truck-guide'
);

-- 実行後の確認
--   統合元3本が draft、統合先3本が published になっていれば成功。
--   公開中の記事は 17本 → 14本 になる（スーパーの記事を公開すれば15本）。
select slug, status, title, length(content) as 本文の文字数
from posts
where slug in (
  'choose-profitable-food-truck-location',
  'host-fee-setting-guide2',
  'event-food-truck-guide',
  'kitchen-car-location-guide',
  'how-to-invite-kitchen-car',
  'renting-parking-space'
)
order by status, slug;

select count(*) as 公開中の記事 from posts where status = 'published';
