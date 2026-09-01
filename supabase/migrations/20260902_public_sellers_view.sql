-- 【手順A】公開用のビューを作ります。
--
-- 追加するだけなので、いまの動作には一切影響しません。
-- これを実行したら教えてください。次にアプリ側を切り替えます。
--
-- ねらい：
--   profiles には メール・電話・住所 が入っている。
--   公開ページや募集者の画面で必要なのは、店舗名やジャンルなど
--   連絡先を含まない情報だけ。それだけを別の入口（ビュー）に切り出す。

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
  payment_methods   -- 同上
from public.profiles
where role = 'seller'
  and approval_status = 'approved';

comment on view public.public_sellers is
  '出店者の公開情報だけを見せる入口。メール・電話・住所は含めない。公開ページと募集者の画面はここを読む。';

-- 読み取りだけ許可する
grant select on public.public_sellers to anon, authenticated;

-- 確認：連絡先が入っていないこと（email/phone/address が出なければ成功）
select string_agg(column_name, ', ' order by ordinal_position) as ビューの列
from information_schema.columns
where table_schema = 'public' and table_name = 'public_sellers';

-- 確認：件数（承認済みの出店者数と一致するはず）
select count(*) as 公開対象の出店者数 from public.public_sellers;
