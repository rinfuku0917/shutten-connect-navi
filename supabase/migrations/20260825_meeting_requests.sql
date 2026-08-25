-- 募集者（掲載を検討している施設・企業）からの打ち合わせ希望。
-- 案件を掲載する前に、可能性があるかどうかを営業担当と相談したいという
-- 要望が多いため、希望する方法（Zoom／対面／どちらでも）と日時を受け取る。
--
-- 登録・参照はすべて管理者用のAPI（サービスロール）経由で行うため、
-- RLS を有効にしたうえでポリシーは作らない（＝クライアントからは触れない）。

create table if not exists public.meeting_requests (
  id uuid primary key default gen_random_uuid(),
  host_id uuid,                                  -- ログイン中の募集者（未ログインなら null）
  name text not null,                            -- ご担当者名
  company text,                                  -- 会社・施設名
  email text not null,
  phone text,
  method text not null,                          -- zoom / in_person / both
  preferred_dates text,                          -- 希望日時（自由記述）
  message text,                                  -- 相談内容
  status text not null default 'new',            -- new（未対応）/ in_progress（対応中）/ done（完了）
  admin_memo text,                               -- 運営側のメモ
  created_at timestamptz not null default now()
);

create index if not exists meeting_requests_status_idx on public.meeting_requests (status, created_at desc);

alter table public.meeting_requests enable row level security;

comment on table public.meeting_requests is '募集者からの打ち合わせ希望（参照・登録は管理者APIのみ）';
