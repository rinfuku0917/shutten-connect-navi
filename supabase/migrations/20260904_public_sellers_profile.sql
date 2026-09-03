-- 出店者が入力したプロフィールを、公開ページでも出せるようにする。
--
-- 出店者はマイページで17項目を入力でき、入力した内容は本人の画面に
-- そのまま表示し返される。ところが公開ページ（/sellers と /sellers/[id]）が
-- 出していたのは 写真・店舗名・ジャンル・活動エリア・メニュー名・価格 だけで、
-- 紹介文も車両サイズも設備も、誰にも見えていなかった。
-- 本人の画面には出るので、公開されていないことに気づけない作りだった。
--
-- 足すのはどれも連絡先ではない。メール・電話・住所は今までどおり入れない。

create or replace view public.public_sellers as
select
  id,
  name,             -- 屋号が未登録のときの表示に使う
  shop_name,
  genre,
  areas,
  photos,
  role,
  approval_status,
  takeout_bag,      -- 提出用Excelで使う（連絡先ではない）
  payment_methods,  -- 同上
  -- ここから追加。いずれも出店者が自分で書いた紹介のための項目
  bio,              -- 紹介文・特徴
  sales_type,       -- 販売形態（キッチンカー／テント・ブースなど）
  vehicle_type,     -- 車種
  size_length,      -- 車両サイズ（mm）
  size_width,
  size_height,
  equipment,        -- 設備
  menu              -- メニューの自由記述
from public.profiles
where role = 'seller'
  and approval_status = 'approved';

comment on view public.public_sellers is
  '出店者の公開情報だけを見せる入口。メール・電話・住所は含めない。公開ページと募集者の画面はここを読む。';

grant select on public.public_sellers to anon, authenticated;

-- 確認：連絡先が入っていないこと（email / phone / address が出なければ成功）
select string_agg(column_name, ', ' order by ordinal_position) as ビューの列
from information_schema.columns
where table_schema = 'public' and table_name = 'public_sellers';
