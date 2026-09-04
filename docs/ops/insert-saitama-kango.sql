-- 埼玉県立高等看護学院の案件を登録する。
--
-- いただいた内容をそのまま入れている。書き方は既存の学校案件
-- （昭和薬科大学・群馬県美容専門学校）に合わせた。
--
-- 下書き（status='draft'）で入れている。理由:
--   ・写真がまだ無い。写真の無い案件は一覧で見栄えが悪い
--   ・公開ページに出るものなので、画面で見て確かめてから公開したい
--   管理画面の案件管理から開いて、写真を入れて公開に切り替えてください。
--
-- 座標は住所から引いたが、番地（板井1696）は地図に登録が無く、
-- 「板井」の地区の位置になっている。アプリの自動取得と同じ結果。
-- 正確な位置にしたい場合は、管理画面で地図を調整してください。
--
-- 12月23日は水曜日。いただいた文面は「（木）」だったが、
-- 日付が正しいことを確認済み。

insert into public.places (
  title, description, address, prefecture,
  place_type, recruit,
  open_time, close_time,
  fee, price_fixed, price_share_pct, place_fixed_unit,
  company_fixed_amount, company_fixed_unit, company_share_pct,
  share_tax_basis, share_tax_rate,
  latitude, longitude,
  status, host_id, genres, max_slots,
  reminder_days, pinned, urgent, closed,
  posted_at, schedule, details
) values (
  '埼玉県立高等看護学院',
  '学内キッチンカーランチ出店',
  '埼玉県熊谷市板井1696',
  '埼玉県',
  'regular',                 -- 決まった日に繰り返し入る形（単発イベントではない）
  'キッチンカー',
  '12:00', '13:00',          -- 販売時間

  -- 出店料: 売上10%＋税。既存の学校案件と同じく、10%は運営の取り分に入れる
  '売上10%＋税',
  0, 0, 'per_day',
  0, 'per_day', 10,
  'as_entered', 8,

  36.1093457, 139.3111682,

  'draft',                   -- ★ 写真を入れて確認してから published に変える
  null,                      -- 募集者は紐づけない（運営が登録した案件）
  null,
  null,                      -- 募集台数の指定が無かったため空

  7, false, false, false,
  now(),

  -- 出店日6日ぶん。販売時間はすべて 12:00〜13:00
  '[
    {"date":"2026-10-05","start":"12:00","end":"13:00"},
    {"date":"2026-11-02","start":"12:00","end":"13:00"},
    {"date":"2026-11-16","start":"12:00","end":"13:00"},
    {"date":"2026-11-20","start":"12:00","end":"13:00"},
    {"date":"2026-12-07","start":"12:00","end":"13:00"},
    {"date":"2026-12-23","start":"12:00","end":"13:00"}
  ]'::jsonb,

  '{
    "format": "kitchen",
    "deadline": "2026-09-30",
    "loadIn": "11:00",
    "loadOut": "14:00",
    "power": "no",
    "gas": "no",
    "water": "no",
    "trash": "self",
    "eatSpace": "yes",
    "location": "outdoor",
    "heightLimit": "no",
    "heightValue": "",
    "rain": "go",
    "rainNote": "",
    "history": "yes",
    "parking": "",
    "visitors": "",
    "menuWant": "女性が多いため、喜ばれるもの。学生向けに販売単価の安いものをお願いします。",
    "menuNG": "アルコール",
    "menuOther": "無し",
    "brand": "",
    "notes": "トイレの利用が可能です。"
  }'::jsonb
)
returning id, title, status, prefecture, address;

-- 入ったことの確認（日程が6日ぶん入っているか）
select title, status,
       jsonb_array_length(schedule) as 日程の数,
       details->>'deadline' as 募集締切,
       fee as 出店料
from public.places
where title = '埼玉県立高等看護学院';
