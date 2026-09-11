-- 完全削除の控えに、あとから必要になるものを残せるようにする。
--
-- なぜ要るか:
--   取り消した出店は、取り消したその場で行ごと消す方針になった
--   （app/api/applications/cancel-approved/route.ts）。
--   ところが控え（purge_log）は summary という自由文が1列だけで、
--   次の2つができない。
--
--   1. キャンセル料を請求できない。
--      /cancel-policy は「出店が確定（承認）した後は、理由・時期を問わず、
--      いかなる場合もキャンセル料が発生します」と定めている。
--      請求するには、誰の・どの案件の・いつの出店だったかが必要。
--      自由文に混ぜて書くと、あとから拾い出せない。
--
--   2. 繰り返す出店者を数えられない。
--      同ポリシーは「事前のご連絡なく出店されなかった場合は、キャンセル料に加え、
--      以後の応募制限またはアカウント停止の対象となることがあります」と定めている。
--      「何回目か」を数えるには、出店者ごとに引ける列が要る。
--
--   さらに、やり取り（messages）は出店の行を消すときに一緒に消える。
--   同ポリシーは連絡を「必ずメッセージ機能を通じて」おこなうよう定めているので、
--   事前の連絡があったのか無かったのかは、その会話にしか残っていない。
--   ポリシーを実行するための証跡そのものなので、消す前に detail へ写す。

alter table public.purge_log
  -- 出店者ごとに引けるようにする（請求と、繰り返しの数え上げ）
  add column if not exists seller_id   uuid references public.profiles(id) on delete set null,
  add column if not exists place_id    uuid,
  add column if not exists apply_date  date,
  add column if not exists cancelled_at timestamptz,
  -- 消す直前の中身を丸ごと写す。
  -- { format, fee, messages:[{at,from,body,file}], onsite:{...}, cancelReason }
  -- 形が増えても移行が要らないよう jsonb にしている
  add column if not exists detail      jsonb;

create index if not exists purge_log_seller_idx on public.purge_log (seller_id, deleted_at desc);

-- 同じものを二度書かない（取り消しの再送・画面の二重押し対策）。
-- これがあると writePurgeLog を upsert にできる
create unique index if not exists purge_log_target_uniq on public.purge_log (kind, target_id);

comment on column public.purge_log.seller_id is '消した出店の出店者。キャンセル料の請求と、繰り返しの数え上げに使う';
comment on column public.purge_log.detail is '消す直前の中身（形態・金額・やり取り・当日の記録・取り消し理由）';

-- 確認
--   select count(*) as 控えの件数 from public.purge_log;
--   select count(*) as ポリシー数 from pg_policies where tablename = 'purge_log';
--   → ポリシー数が 0 なら想定どおり（運営APIからしか読めない）
--
--   出店者ごとの取り消し回数:
--     select seller_id, count(*) from public.purge_log
--     where kind = 'application' group by seller_id order by 2 desc;
