-- Demo data for the showcase recording. Run against an empty `showcase` database.
select setseed(0.42);

create table regions (
  id serial primary key,
  name text not null unique
);

create table accounts (
  id serial primary key,
  name text not null,
  plan text not null check (plan in ('Starter', 'Team', 'Scale')),
  region_id int not null references regions (id),
  status text not null check (status in ('active', 'churned')),
  created_at timestamptz not null
);

create table users (
  id serial primary key,
  account_id int not null references accounts (id),
  email text not null unique,
  name text not null,
  last_seen_at timestamptz not null,
  created_at timestamptz not null
);

create table subscriptions (
  id serial primary key,
  account_id int not null references accounts (id),
  amount_cents int not null check (amount_cents >= 0),
  status text not null check (status in ('active', 'past_due', 'canceled')),
  billed_at date not null
);

insert into regions (name) values ('North America'), ('Europe'), ('Asia Pacific');

insert into accounts (name, plan, region_id, status, created_at)
select
  (array['Northwind', 'Halcyon', 'Brightline', 'Orchard', 'Juniper', 'Cobalt',
         'Meridian', 'Lumen', 'Atlas', 'Kestrel', 'Harbor', 'Sable',
         'Tidewater', 'Ember', 'Quarry', 'Fieldstone'])[1 + floor(s.a * 16)::int]
    || ' ' ||
  (array['Labs', 'Health', 'Freight', 'Studio', 'Systems', 'Analytics',
         'Works', 'Supply', 'Capital', 'Robotics', 'Foods', 'Cloud'])[1 + floor(s.b * 12)::int],
  case when s.p < 0.5 then 'Starter' when s.p < 0.85 then 'Team' else 'Scale' end,
  case when s.g < 0.54 then 1 when s.g < 0.85 then 2 else 3 end,
  case when s.c < 0.083 then 'churned' else 'active' end,
  timestamptz '2024-06-01'
    + sqrt(s.t) * (timestamptz '2026-11-19' - timestamptz '2024-06-01')
from (
  select random() as a, random() as b, random() as p, random() as g,
         random() as c, random() as t
  from generate_series(1, 1400)
) as s;

with targets (region_id, month, mrr_k) as (
  values
    (1, 1, 180), (1, 2, 186), (1, 3, 195), (1, 4, 203), (1, 5, 214),
    (1, 6, 222), (1, 7, 234), (1, 8, 246), (1, 9, 258),
    (2, 1, 97), (2, 2, 101), (2, 3, 106), (2, 4, 110), (2, 5, 117),
    (2, 6, 123), (2, 7, 131), (2, 8, 139), (2, 9, 146),
    (3, 1, 31), (3, 2, 34), (3, 3, 38), (3, 4, 42), (3, 5, 47),
    (3, 6, 52), (3, 7, 58), (3, 8, 64), (3, 9, 71)
),
eligible as (
  select a.id, t.region_id, t.month, t.mrr_k,
         count(*) over (partition by t.region_id, t.month) as n
  from targets as t
  join accounts as a
    on a.region_id = t.region_id
   and a.status = 'active'
   and a.created_at < make_date(2026, t.month, 1)
)
insert into subscriptions (account_id, amount_cents, status, billed_at)
select
  id,
  round(mrr_k * 100000.0 / n * (0.6 + random() * 0.8))::int,
  'active',
  make_date(2026, month, 1) + floor(random() * 27)::int
from eligible;

insert into users (account_id, email, name, last_seen_at, created_at)
select
  a.id,
  'user' || a.id || '.' || k || '@example.com',
  (array['Ana', 'Ben', 'Chloe', 'Diego', 'Eva', 'Femi', 'Grace', 'Hiro',
         'Ines', 'Jonas', 'Kai', 'Lena', 'Malik', 'Nora', 'Omar', 'Priya'])[1 + (a.id * 7 + k) % 16],
  case
    when random() < 0.15 then now() - interval '13 months' - random() * interval '200 days'
    else now() - random() * interval '60 days'
  end,
  a.created_at
from accounts as a
cross join lateral generate_series(1, 1 + a.id % 5) as k;
