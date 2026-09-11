-- 運営がメッセージを見たかどうかを、当事者の既読とは別に持つ。
--
-- なぜ要るか:
--   やり取りは申込1件＝スレッド1本で、出店者・募集者・運営の3者が
--   同じ行に書き込む。既読の記録（read_at）は1行に1つしかないため、
--   運営がスレッドを開くと「出店者が送ったもの」と「募集者が送ったもの」の
--   両方が既読になっていた。
--
--   その結果、募集者がまだ読んでいないのに未読の印が消える。
--   当日の連絡を見落とす形になるため、運営の既読は別の列で持つ。
--
--   read_at は当事者（出店者・募集者）のものとして残し、
--   運営が開いたときは admin_seen_at だけを埋める。

alter table public.messages
  add column if not exists admin_seen_at timestamptz;

comment on column public.messages.admin_seen_at is
  '運営がこのメッセージを見た時刻。当事者の既読（read_at）とは別に持つ';

-- 運営の未読を数えるため
create index if not exists messages_admin_unseen_idx
  on public.messages (application_id)
  where admin_seen_at is null;

-- 確認
--   select column_name from information_schema.columns
--    where table_name = 'messages' and column_name = 'admin_seen_at';
--   → 1件返れば想定どおり
