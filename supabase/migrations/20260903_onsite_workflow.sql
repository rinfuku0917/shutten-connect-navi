-- 公式LINEでやりとりしていた2つを、サイトの中で完結させる。
--
--   ⑴ 現場ごとの出店者情報
--      これまで出店者情報はプロフィールに1組しか持てなかった。
--      （menus は seller_id にぶら下がっていて、案件ごとに分けられない）
--      そのため案件や企業ごとに違う内容を出したいときは、運営が毎回
--      公式LINEで聞き取って手で書き換えていた。
--      application_submissions を足して、案件×出店者の組ごとに持てるようにする。
--
--   ⑵ 当日の進行
--      前日確認・受付完了・営業準備完了を、出店者がマイページから押して記録する。
--      とくに受付完了は、運営が当日いちばん知りたい情報なので、
--      管理画面で未確認のものを目立たせられるよう見た印も持つ。

-- ============================================================
-- ⑴ 現場ごとの出店者情報
-- ============================================================

create table if not exists public.application_submissions (
  id uuid primary key default gen_random_uuid(),
  -- 出店日ごとではなく案件ごとに1組。同じ案件に何日申し込んでも入力は1回で済む
  place_id  uuid not null references public.places(id)   on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,

  -- 提出用Excelに載る項目。プロフィールと同じ並びにしてある
  shop_name       text,   -- 店舗名
  instagram       text,   -- Instagram のURL
  genre           text,   -- ジャンル
  takeout_bag     text,   -- テイクアウトの袋（「無料」「有料：5円」）
  payment_methods jsonb,  -- 利用できる決済 ["現金","PayPay"]
  menus           jsonb,  -- 販売メニュー [{name, detail, price}]
  note            text,   -- 現場への連絡事項（Excelには載せない）

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (place_id, seller_id)
);

comment on table public.application_submissions is
  '案件ごとの出店者情報。未入力の案件はプロフィールの内容を使う';
comment on column public.application_submissions.menus is
  '販売メニュー [{name, detail, price}]。price は数値（円）';

create index if not exists application_submissions_place_idx
  on public.application_submissions (place_id);
create index if not exists application_submissions_seller_idx
  on public.application_submissions (seller_id);

alter table public.application_submissions enable row level security;

-- 出店者は自分の入力だけを読み書きできる
create policy "sellers manage own submissions" on public.application_submissions
  for all using (seller_id = auth.uid()) with check (seller_id = auth.uid());

-- 募集者は自分の案件に届いた入力を読める（提出用Excelを作るため）
create policy "hosts read submissions for own places" on public.application_submissions
  for select using (
    place_id in (select p.id from public.places p where p.host_id = auth.uid())
  );

create policy "admin all submissions" on public.application_submissions
  for all using (public.is_admin());

-- ============================================================
-- ⑵ 当日の進行
-- ============================================================

alter table public.applications
  add column if not exists confirmed_at    timestamptz,  -- 前日確認（出店者が押す）
  add column if not exists checked_in_at   timestamptz,  -- 受付完了（出店者が押す）
  add column if not exists ready_at        timestamptz,  -- 営業準備完了（出店者が押す）
  -- 受付完了を運営が見たかどうか。null のあいだ管理画面で光らせる
  add column if not exists checkin_seen_at timestamptz;

comment on column public.applications.confirmed_at    is '当日の進行: 前日確認を押した時刻';
comment on column public.applications.checked_in_at   is '当日の進行: 受付完了を押した時刻';
comment on column public.applications.ready_at        is '当日の進行: 営業準備完了を押した時刻';
comment on column public.applications.checkin_seen_at is '運営が受付完了を確認した時刻。null のあいだ管理画面で目立たせる';

-- 未確認の受付完了を、当日ぶんだけ速く引けるようにする
create index if not exists applications_checkin_unseen_idx
  on public.applications (apply_date)
  where checked_in_at is not null and checkin_seen_at is null;

-- 進行の記録は /api/onsite（サービスキー）を通す。
-- 出店者に applications の UPDATE を直接許すと status まで書き換えられるため。
