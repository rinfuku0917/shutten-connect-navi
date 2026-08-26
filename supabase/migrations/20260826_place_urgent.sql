-- 案件を手動で「急募」にできるようにする。
-- これまでは開催日が7日以内の案件だけが自動で急募になっていたが、
-- 開催が先でも早く埋めたい案件があるため、募集者が自分で指定できるようにする。
--
-- チェックしなくても、開催7日前になれば今までどおり自動で急募になる。

alter table public.places
  add column if not exists urgent boolean not null default false;

comment on column public.places.urgent is '募集者が手動で指定した急募フラグ（自動判定とは別）';
