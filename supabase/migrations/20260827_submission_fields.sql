-- 施設へ提出する「出店者情報」に必要な項目を追加する。
--
-- これまで提出用のExcel（店舗名・Instagram・ジャンル・テイクアウト袋・
-- 決済方法・メニュー一覧）は運営が手作業でまとめていた。
-- 出店者が自分で入力し、管理画面・募集者画面からそのままの様式で
-- Excel出力できるようにする。

-- InstagramのURLは既存の sns_links（platform='instagram'）をそのまま使う。
alter table public.profiles
  add column if not exists takeout_bag text,        -- テイクアウトの袋（「無料」「有料：5円」）
  add column if not exists payment_methods jsonb;   -- 利用できる決済（["現金","PayPay"] など）

comment on column public.profiles.takeout_bag is '提出用: テイクアウトの袋（無料／有料：金額）';
comment on column public.profiles.payment_methods is '提出用: 利用できる決済の一覧';

-- 提出用Excelの「詳細」列（例:「2本」「ミルク・ソーダ選べます」）
alter table public.menus
  add column if not exists detail text;

comment on column public.menus.detail is '提出用: メニューの補足（個数・選べる味など）';
