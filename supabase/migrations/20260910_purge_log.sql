-- 運営が完全に消した記録の控え。
--
-- なぜ要るか:
--   出店の取消しも請求書の取消しも、行を残す作りにしている。
--   キャンセル料の根拠が消えると困るためで、ふだんはそれで正しい。
--   ただしテストで作った出店や二重に発行した請求書が一覧に残り続けると、
--   本物の記録が埋もれていく。運営だけが「取り消し済みのもの」を
--   完全に消せるようにした。
--
--   消した行そのものは戻らないが、「いつ・誰が・何を消したか」は残す。
--   あとで「あの請求書はどこへ行ったのか」を追えるようにするため。
--
-- 参照・登録は管理者用のAPI（サービスロール）経由のみ。
-- RLS を有効にしてポリシーは作らない。

create table if not exists public.purge_log (
  id         uuid primary key default gen_random_uuid(),
  -- 何を消したか: 'application'（出店）/ 'invoice'（請求書）
  kind       text not null,
  -- 消した行のID。もう存在しないので、外部キーにはしない
  target_id  uuid not null,
  -- 画面に出す用の短い説明（案件名・日付・請求書番号など）
  summary    text,
  deleted_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz not null default now()
);

create index if not exists purge_log_deleted_idx on public.purge_log (deleted_at desc);

alter table public.purge_log enable row level security;

comment on table public.purge_log is '運営が完全に消した記録の控え（参照・登録は管理者APIのみ）';

-- 確認
--   select count(*) as ポリシー数 from pg_policies where tablename = 'purge_log';
--   → 0 なら想定どおり
