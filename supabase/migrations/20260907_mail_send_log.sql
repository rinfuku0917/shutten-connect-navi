-- メール文面の画面から、1件ずつ送ったときの記録。
--
-- なぜ要るか:
--   運営が管理画面から手で送れるようにすると、
--   「送ったのか、送っていないのか」が誰にも分からなくなる。
--   同じ人へ二度送る、送ったつもりで送っていない、
--   どちらも問い合わせにつながる。送ったことは必ず残す。
--
--   自動で送るぶんには、それぞれ専用の記録がある
--   （password_notice_log / sales_reminder_log）。
--   ここは「画面から手で送ったぶん」だけを受け持つ。

create table if not exists public.mail_send_log (
  id          uuid primary key default gen_random_uuid(),
  -- どの文面か（app/lib/mailTemplates.ts の key）
  template_key text not null,
  -- 送り先。会員でないアドレスにも送れるので、profiles への外部キーにはしない
  email       text not null,
  -- 送り先が会員だったときだけ入る
  seller_id   uuid references public.profiles(id) on delete set null,
  -- 実際に送った件名。文面は編集できるので、そのときの内容を残す
  subject     text,
  -- 差し込みに入れた値。あとで「何を入れて送ったか」を追えるようにする
  vars        jsonb,
  status      text not null default 'sent',   -- sent / failed
  error       text,
  sent_by     uuid references public.profiles(id) on delete set null,
  sent_at     timestamptz not null default now()
);

create index if not exists mail_send_log_key_idx   on public.mail_send_log (template_key, sent_at desc);
create index if not exists mail_send_log_email_idx on public.mail_send_log (lower(email), sent_at desc);

-- 誰にも直接は触らせない。
--
-- この表には送り先のメールアドレスと、差し込んだ値（お名前・案件名・金額）が
-- そのまま入る。出店者に読めるポリシーを足すと、行を絞れても
-- 列は絞れないため、他人のアドレスまで見えてしまう。
-- サービスロールを持つ管理APIだけが読み書きする。
alter table public.mail_send_log enable row level security;

-- 確認
--   select count(*) as ポリシー数 from pg_policies where tablename = 'mail_send_log';
--   → 0 なら想定どおり（管理APIだけが触れる）
