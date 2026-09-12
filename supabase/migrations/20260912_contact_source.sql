-- お問い合わせに「どこ経由で来たか」と「やり取りの履歴」を持たせる。
--
-- なぜ要るか:
--   問い合わせが入っても、どの経路から来た方なのかが分からなかった。
--   検索から来たのか、公式LINEなのか、営業が動いた結果なのかで、
--   次に力を入れる場所も、社内の引き継ぎ先も変わる。
--
--   あわせて「初めてか、すでに関係がある方か」も分けて持つ。
--   過去にやり取りがある方に初回の案内を送ってしまうと失礼になる。
--
-- 値は app/lib/signupSource.ts が唯一の正。
--   found_via        … CONTACT_SOURCES の value
--                      （search / instagram / line / referral /
--                        seen_onsite / paper / other）
--                      登録時の signup_sources.found_via と同じ値にしている。
--                      ダッシュボードで登録と問い合わせを同じ物差しで
--                      数えられるようにするため
--   found_note       … 「その他」を選んだときの記述、または補足
--   contact_history  … CONTACT_HISTORIES の value
--                      （first / past / from_rep）
--   rep_name         … 過去にやり取りがある・担当者から案内を受けた場合の
--                      担当者名。分かる場合のみ（任意）
--
-- 参照・登録は管理者用のAPI（サービスロール）経由のみ。
-- contacts は RLS 有効・ポリシー0のまま（お名前とメールアドレスが入るため）。

alter table public.contacts
  add column if not exists found_via       text,
  add column if not exists found_note      text,
  add column if not exists contact_history text,
  add column if not exists rep_name        text;

-- 経路ごとの件数を数えるため
create index if not exists contacts_found_via_idx on public.contacts (found_via);

comment on column public.contacts.found_via is
  'どこ経由で来たか。値は app/lib/signupSource.ts の CONTACT_SOURCES（signup_sources.found_via と同じ値）';
comment on column public.contacts.contact_history is
  'やり取りの履歴。first（初めて）/ past（過去にやり取り）/ from_rep（担当者から案内）';
comment on column public.contacts.rep_name is
  '弊社の担当者名。past・from_rep のときに任意で入る';

-- 確認
--   select found_via, count(*) from public.contacts group by found_via order by 2 desc;
--   select count(*) as ポリシー数 from pg_policies where tablename = 'contacts';
--   → ポリシー数が 0 なら想定どおり（運営APIからしか読めない）
