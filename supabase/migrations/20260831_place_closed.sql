-- 案件の「募集終了」を扱えるようにする。
--
-- 終了した案件を非公開にすると一覧から消えてしまうが、
-- 実績として見せたいので、掲載したまま「終了」と分かる状態にする。
-- 終了した案件にはエントリーできない。

alter table places
  add column if not exists closed boolean not null default false,
  add column if not exists closed_at timestamptz;

comment on column places.closed is '募集終了。掲載は残したまま、応募だけ止める';
comment on column places.closed_at is '募集終了にした日時';

-- 一覧は「募集中を先、終了を後」に並べるため
create index if not exists places_closed_idx on places (closed);
