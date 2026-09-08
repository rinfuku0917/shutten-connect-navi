-- 公開ページ（/contact）から届くお問い合わせ。
--
-- なぜ要るか:
--   これまでお問い合わせは info@connect-navi.com へメールを送るだけで、
--   どこにも残していなかった。そのため
--     ・担当者は自分のメールに転送を設定しないと気づけない
--     ・メールが埋もれると、問い合わせがあったこと自体が分からない
--     ・誰が対応したのか、対応が済んだのかを追えない
--   という状態だった。管理画面で見られるようにして、記録を正本にする。
--
--   メールはこれまでどおり送る。ただし「届いたことを知らせるもの」であって、
--   中身の正本はこの表になる。メールの送信に失敗しても、行は残る。
--
-- 参照・登録はすべて管理者用のAPI（サービスロール）経由で行うため、
-- RLS を有効にしたうえでポリシーは作らない（＝ブラウザからは触れない）。
-- お名前・メールアドレス・相談内容が入るので、行を絞れても列は絞れない。

create table if not exists public.contacts (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null,
  message    text not null,
  -- new（未対応）/ in_progress（対応中）/ done（完了）
  status     text not null default 'new',
  admin_memo text,
  -- 対応した運営の担当者
  handled_by uuid references public.profiles(id) on delete set null,
  handled_at timestamptz,
  -- 通知メールが送れたかどうか。送れていない問い合わせを見分けるため
  mail_sent  boolean not null default false,
  mail_error text,
  created_at timestamptz not null default now()
);

create index if not exists contacts_status_idx on public.contacts (status, created_at desc);
create index if not exists contacts_created_idx on public.contacts (created_at desc);

alter table public.contacts enable row level security;

comment on table public.contacts is 'お問い合わせ（参照・登録は管理者APIのみ）';

-- 確認
--   select count(*) as ポリシー数 from pg_policies where tablename = 'contacts';
--   → 0 なら想定どおり（管理APIだけが触れる）
