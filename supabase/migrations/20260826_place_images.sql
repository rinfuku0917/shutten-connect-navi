-- 案件の写真を複数枚もてるようにする。
-- 区画やスペースの割り当てを写真で説明したい案件（スーパーの店頭など）があり、
-- 1枚では足りないため。
--
-- image_url は今までどおり「1枚目（サムネイル用）」として残す。
-- 一覧ページやカードは image_url を見ているので、これを消すと表示が崩れる。
-- images には1枚目を含むすべてのURLを、表示したい順で入れる。

alter table public.places
  add column if not exists images jsonb not null default '[]'::jsonb;

-- 既存の案件は、いま登録されている1枚を images にも入れておく
update public.places
   set images = jsonb_build_array(image_url)
 where images = '[]'::jsonb
   and image_url is not null
   and image_url <> '';

comment on column public.places.images is '案件の写真URL（最大4枚・先頭がサムネイル）';
