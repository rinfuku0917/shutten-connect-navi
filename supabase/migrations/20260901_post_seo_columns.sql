-- 記事をSEO記事の量産に耐える形にする。
--
-- ・target_keyword     … その記事で狙う検索語。docs/seo-keywords.md と対応させる
-- ・related_prefecture … 記事下の「関連する出店場所」で使う都道府県（places.prefecture と同じ表記）
-- ・related_category   … 同じく施設カテゴリ（places.genres の値と同じ表記）
--
-- meta_description は既にあるので追加しない。

alter table posts
  add column if not exists target_keyword text,
  add column if not exists related_prefecture text,
  add column if not exists related_category text;

comment on column posts.target_keyword is 'この記事で狙う検索キーワード。docs/seo-keywords.md の行と対応';
comment on column posts.related_prefecture is '記事下の「関連する出店場所」に出す都道府県。places.prefecture と同じ表記';
comment on column posts.related_category is '記事下の「関連する出店場所」に出す施設カテゴリ。places.genres と同じ表記';

-- 記事一覧の絞り込みに使う4カテゴリへ寄せる。
-- 既存の記事は、いまのカテゴリ名から近いものに割り当てる。
update posts set category = '開業・許可'      where category in ('開業ガイド');
update posts set category = '出店場所の探し方' where category in ('ガイド', '経営ノウハウ', 'オーナー向け');
update posts set category = '募集者向け'      where category in ('主催者向け');
update posts set category = '出店場所の探し方' where category is null;

-- 一覧の絞り込みと、関連案件の引き当てを速くする
create index if not exists posts_category_idx on posts (category);
create index if not exists posts_related_prefecture_idx on posts (related_prefecture);
