-- Sample seed data for local development.
-- Run after migrations: `supabase db reset` will run migrations + this seed.

-- A sample organization
insert into organization (id, name, plan, status)
values ('11111111-1111-1111-1111-111111111111', 'サンプル株式会社', 'beta', 'active')
on conflict (id) do nothing;

-- A sample department
insert into department (id, org_id, name)
values (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  '営業部'
) on conflict (id) do nothing;

-- A sample project
insert into project (id, org_id, department_id, name, status)
values (
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  'Q2 セミナー企画',
  'active'
) on conflict (id) do nothing;
