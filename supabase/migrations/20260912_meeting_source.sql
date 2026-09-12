-- 相談の申し込みにも「どこ経由で来たか」と「やり取りの履歴」を持たせる。
--
-- なぜ要るか:
--   お問い合わせフォーム（contacts）には 20260912_contact_source.sql で入れたが、
--   「まずは相談する」の窓口には入っていなかった。
--   相談はお問い合わせより成約に近いので、こちらのほうが経路を知る価値が高い。
--   初めての方か、すでに関係がある方かも、引き継ぎ先が変わるので分けて持つ。
--
-- 値は app/lib/signupSource.ts が唯一の正。contacts と同じ値にしている
--   found_via        … CONTACT_SOURCES の value
--                      （search / instagram / line / referral /
--                        seen_onsite / paper / other）
--   found_note       … 「その他」を選んだときの記述
--   contact_history  … CONTACT_HISTORIES の value
--                      （first / past / from_rep）
--   rep_name         … 担当者名。past・from_rep のときに任意で入る
--
--   お問い合わせ（contacts）・会員登録（signup_sources）・相談（meeting_requests）
--   の3つで同じ値にしてあるので、ダッシュボードで足し合わせて数えられる。

alter table public.meeting_requests
  add column if not exists found_via       text,
  add column if not exists found_note      text,
  add column if not exists contact_history text,
  add column if not exists rep_name        text;

create index if not exists meeting_requests_found_via_idx
  on public.meeting_requests (found_via);

comment on column public.meeting_requests.found_via is
  'どこ経由で来たか。値は app/lib/signupSource.ts の CONTACT_SOURCES（contacts.found_via と同じ値）';
comment on column public.meeting_requests.contact_history is
  'やり取りの履歴。first（初めて）/ past（過去にやり取り）/ from_rep（担当者から案内）';
comment on column public.meeting_requests.rep_name is
  '弊社の担当者名。past・from_rep のときに任意で入る';

-- 確認
--   select found_via, count(*) from public.meeting_requests group by found_via order by 2 desc;
--
--   お問い合わせと相談をまとめて数える:
--     select found_via, count(*) from (
--       select found_via from public.contacts
--       union all select found_via from public.meeting_requests
--     ) t where found_via is not null group by found_via order by 2 desc;
