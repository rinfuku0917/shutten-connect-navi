-- 運営あて通知メールの宛先。
--
-- なぜ要るか:
--   お問い合わせ・新規登録・入金報告・出店の取消しの通知は、
--   すべて info@connect-navi.com に固定で送られていた。コードに直接
--   書かれていたため、担当者が自分のアドレスでも受け取りたいときは
--   「メールサーバー側で転送を設定してください」と言うしかなかった。
--   その転送は製品の外の話で、こちらからは手が出せず、
--   設定できないまま届かない状態が続いていた。
--
--   ここに宛先を足せば、その人に直接届く。転送は要らなくなる。
--
--   info@connect-navi.com は常に宛先に入る（この表に何も無くても届く）。
--   コード側で必ず足しているので、消してしまって誰にも届かない、
--   ということが起きない。
--
-- 参照・更新は管理者用のAPI（サービスロール）経由のみ。
-- メールアドレスが入るので、RLS を有効にしてポリシーは作らない。

create table if not exists public.notify_recipients (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  -- 誰あてか分かるように（例: 川上）。空でもよい
  label      text,
  -- 受け取る通知の種類。false にすると、その種類だけ届かなくなる
  on_contact boolean not null default true,  -- お問い合わせ
  on_member  boolean not null default true,  -- 新しい登録
  on_payment boolean not null default true,  -- 入金の報告
  on_cancel  boolean not null default true,  -- 出店の取消し
  -- まとめて止めたいとき（退職・長期不在など）に false にする
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- 同じアドレスを二重に登録しない。大文字小文字は区別しない
create unique index if not exists notify_recipients_email_uniq
  on public.notify_recipients (lower(email));

alter table public.notify_recipients enable row level security;

comment on table public.notify_recipients is '運営あて通知メールの追加の宛先（参照・更新は管理者APIのみ）';

-- 確認
--   select count(*) as ポリシー数 from pg_policies where tablename = 'notify_recipients';
--   → 0 なら想定どおり
