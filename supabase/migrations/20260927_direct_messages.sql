-- 運営と募集者の、案件に紐づかないメッセージ（直接のやり取り）。
--
-- なぜ要るか（2026-09-26 の依頼「管理者から募集者に対してチャットできるようにしたい」）:
--   messages はこれまで必ず案件（application_id）に紐づいていて、
--   出店者・募集者は「自分が関わる申込」のやり取りだけ読める作りだった。
--   運営から募集者へ、申込と関係のない連絡（掲載内容の確認、条件の相談、
--   承認待ちの案件について）を送る手段が無く、運営が個人のメールから
--   送っている状態だった。
--
-- どう持たせるか:
--   application_id を null にした行を「直接のやり取り」として使う。
--   ・運営 → 募集者 … sender_id = 運営、receiver_id = 募集者
--   ・募集者 → 運営 … sender_id = 募集者、receiver_id = null（宛先は運営）
--   募集者のスレッドは「自分が送った」か「自分宛」の行を集めたもの。
--   新しい表を作らないので、取り消し（messages の削除）・添付・既読の作りが
--   そのまま使える。
--
-- 権限:
--   既存の view_own_messages / users update own thread messages は
--   application_id が自分の申込に入っていることを求めるので、
--   null の行はどちらにも当たらない（＝読めない）。
--   直接のやり取り用に、送り主と宛先だけが読める・直せる決まりを足す。
--   入れるほうは既存の insert_own_messages（sender_id = auth.uid()）で足りる。
--   運営は is_admin() で全部読めるので、運営向けの追加は要らない。

-- 読む
drop policy if exists "view_direct_messages" on public.messages;
create policy "view_direct_messages" on public.messages
  for select
  using (
    application_id is null
    and (sender_id = auth.uid() or receiver_id = auth.uid())
  );

-- 直す（既読の時刻を入れるため）。
-- 宛先が null の行（募集者 → 運営）は、送り主だけが直せる
drop policy if exists "update_direct_messages" on public.messages;
create policy "update_direct_messages" on public.messages
  for update
  using (
    application_id is null
    and (sender_id = auth.uid() or receiver_id = auth.uid())
  )
  with check (
    application_id is null
    and (sender_id = auth.uid() or receiver_id = auth.uid())
  );

-- 直接のやり取りを引くときの索引。件数は少ないが、
-- 募集者の画面は毎回「自分が関わる直接のやり取り」を読む
create index if not exists messages_direct_idx
  on public.messages (receiver_id, sent_at)
  where application_id is null;

comment on column public.messages.receiver_id is
  '宛先。案件に紐づくやり取りでは使わない。直接のやり取り（application_id が null）で、運営→募集者のときに募集者を入れる。募集者→運営は null';

-- 確認
--   select count(*) from public.messages where application_id is null;
--   → 0 から始まる
