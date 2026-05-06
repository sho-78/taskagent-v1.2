-- ============================================================================
-- TaskAgent v0.5 — Initial schema
-- ============================================================================
-- This migration creates the full data model described in REQUIREMENTS_v0.5
-- chapter 6, including:
--   - 5-level hierarchy (Organization > Department > Project > Task > Subtask)
--   - Cross-org collaboration (CrossOrgInvitation, OrgRelation)
--   - Notification system (NotificationConfig, NotificationLog, LineLink)
--   - KPI snapshot table for fast dashboards
--   - Workflow builder entities (v1.5 — created early to avoid migration churn)
--   - PlatformAdmin separation for operations team
--   - Row Level Security policies for tenant isolation
-- ============================================================================

-- Extensions ------------------------------------------------------------------
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Enums -----------------------------------------------------------------------
create type org_status as enum ('active', 'suspended', 'trial');
create type member_role as enum ('admin', 'member');
create type membership_role as enum ('owner', 'admin', 'member', 'viewer');
create type membership_scope as enum ('org', 'department', 'project');
create type task_status as enum ('todo', 'in_progress', 'done', 'cancelled');
create type task_priority as enum ('low', 'medium', 'high', 'urgent');
create type task_source as enum ('manual', 'ai', 'import', 'workflow');
create type project_status as enum ('active', 'archived', 'on_hold');
create type cross_org_status as enum ('pending', 'accepted', 'revoked', 'expired');
create type ai_session_kind as enum ('decompose', 'prioritize', 'summarize', 'workflow');
create type notification_channel as enum ('email', 'line', 'inapp');
create type notification_event_type as enum (
  'task_assigned',
  'task_due_soon',
  'task_overdue',
  'task_completed',
  'task_mentioned',
  'workflow_failed',
  'invitation_received',
  'kpi_weekly_summary'
);
create type platform_admin_role as enum ('super_admin', 'staff');
create type kpi_scope_type as enum ('user', 'department', 'project', 'org');
create type kpi_period as enum ('daily', 'weekly', 'monthly');
create type workflow_status as enum ('draft', 'active', 'paused');
create type workflow_run_status as enum ('running', 'success', 'failed', 'cancelled');
create type workflow_node_type as enum ('trigger', 'condition', 'ai', 'action', 'wait');

-- Core: Organization & Platform ----------------------------------------------
create table organization (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  plan text not null default 'beta',
  status org_status not null default 'trial',
  provisioned_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table platform_admin (
  id uuid primary key default uuid_generate_v4(),
  email text not null unique,
  role platform_admin_role not null default 'staff',
  display_name text,
  last_login_at timestamptz,
  created_at timestamptz not null default now()
);

-- Hierarchy: Department > Project > Task > Subtask ----------------------------
create table department (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organization(id) on delete cascade,
  parent_department_id uuid references department(id) on delete set null,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_department_org on department(org_id);
create index idx_department_parent on department(parent_department_id);

create table project (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organization(id) on delete cascade,
  department_id uuid references department(id) on delete set null,
  name text not null,
  description text,
  status project_status not null default 'active',
  color text default '#2563EB',
  owner_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_project_org on project(org_id);
create index idx_project_department on project(department_id);

-- App user (separate from auth.users provided by Supabase Auth) --------------
create table app_user (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references organization(id) on delete cascade,
  email text not null,
  display_name text,
  role member_role not null default 'member',
  line_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_app_user_org on app_user(org_id);
create unique index idx_app_user_line on app_user(line_user_id) where line_user_id is not null;

alter table project add constraint fk_project_owner
  foreign key (owner_id) references app_user(id) on delete set null;

-- Membership: many-to-many between users and scopes (org/dept/project) -------
create table membership (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references app_user(id) on delete cascade,
  scope_type membership_scope not null,
  scope_id uuid not null,
  role membership_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (user_id, scope_type, scope_id)
);
create index idx_membership_user on membership(user_id);
create index idx_membership_scope on membership(scope_type, scope_id);

-- Task & Subtask (recursive via parent_task_id) ------------------------------
create table task (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organization(id) on delete cascade,
  project_id uuid references project(id) on delete set null,
  parent_task_id uuid references task(id) on delete cascade,
  title text not null,
  body text,
  status task_status not null default 'todo',
  priority task_priority not null default 'medium',
  due_at timestamptz,
  assignee_id uuid references app_user(id) on delete set null,
  est_minutes int,
  actual_minutes int,
  source task_source not null default 'manual',
  ai_confidence numeric(3,2),
  completed_at timestamptz,
  created_by uuid references app_user(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_task_org on task(org_id);
create index idx_task_project on task(project_id);
create index idx_task_parent on task(parent_task_id);
create index idx_task_assignee on task(assignee_id);
create index idx_task_status_due on task(status, due_at);

-- Tag (n..n with task) -------------------------------------------------------
create table tag (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organization(id) on delete cascade,
  name text not null,
  color text default '#6B7280',
  created_at timestamptz not null default now(),
  unique (org_id, name)
);
create table task_tag (
  task_id uuid not null references task(id) on delete cascade,
  tag_id uuid not null references tag(id) on delete cascade,
  primary key (task_id, tag_id)
);

-- Activity (audit + KPI source) ----------------------------------------------
create table activity (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organization(id) on delete cascade,
  task_id uuid references task(id) on delete cascade,
  user_id uuid references app_user(id) on delete set null,
  action text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);
create index idx_activity_org_time on activity(org_id, created_at desc);
create index idx_activity_task on activity(task_id);

-- Invitations ---------------------------------------------------------------
create table invitation (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organization(id) on delete cascade,
  email text not null,
  role member_role not null default 'member',
  token text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_by uuid references app_user(id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_invitation_email on invitation(email);

-- Cross-org collaboration ---------------------------------------------------
create table cross_org_invitation (
  id uuid primary key default uuid_generate_v4(),
  host_org_id uuid not null references organization(id) on delete cascade,
  guest_org_email text not null,
  project_id uuid references project(id) on delete cascade,
  permissions jsonb not null default '{"read": true, "write": false}'::jsonb,
  status cross_org_status not null default 'pending',
  token text not null unique,
  expires_at timestamptz not null,
  responded_at timestamptz,
  created_by uuid references app_user(id) on delete set null,
  created_at timestamptz not null default now()
);

create table org_relation (
  id uuid primary key default uuid_generate_v4(),
  host_org_id uuid not null references organization(id) on delete cascade,
  guest_org_id uuid not null references organization(id) on delete cascade,
  project_id uuid references project(id) on delete cascade,
  permissions jsonb not null default '{"read": true, "write": false}'::jsonb,
  established_at timestamptz not null default now(),
  is_active boolean not null default true,
  unique (host_org_id, guest_org_id, project_id)
);
create index idx_org_relation_host on org_relation(host_org_id) where is_active;
create index idx_org_relation_guest on org_relation(guest_org_id) where is_active;

-- AI usage tracking ---------------------------------------------------------
create table ai_session (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organization(id) on delete cascade,
  user_id uuid references app_user(id) on delete set null,
  kind ai_session_kind not null,
  prompt_tokens int,
  completion_tokens int,
  total_tokens int,
  cost_usd numeric(10,4),
  prompt text,
  response text,
  created_at timestamptz not null default now()
);
create index idx_ai_session_org_time on ai_session(org_id, created_at desc);

-- Notification system -------------------------------------------------------
create table notification_config (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references app_user(id) on delete cascade,
  event_type notification_event_type not null,
  channel notification_channel not null,
  enabled boolean not null default true,
  schedule jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, event_type, channel)
);

create table notification_log (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organization(id) on delete cascade,
  user_id uuid not null references app_user(id) on delete cascade,
  event_type notification_event_type not null,
  channel notification_channel not null,
  payload jsonb,
  status text not null default 'queued',
  error_message text,
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_notif_log_user_time on notification_log(user_id, created_at desc);

create table line_link (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references app_user(id) on delete cascade,
  line_user_id text not null,
  display_name text,
  status text not null default 'active',
  linked_at timestamptz not null default now(),
  unique (line_user_id)
);

-- KPI snapshot (pre-aggregated for fast dashboards) -------------------------
create table kpi_snapshot (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organization(id) on delete cascade,
  scope_type kpi_scope_type not null,
  scope_id uuid not null,
  period kpi_period not null,
  date date not null,
  metrics jsonb not null,
  created_at timestamptz not null default now(),
  unique (org_id, scope_type, scope_id, period, date)
);
create index idx_kpi_lookup on kpi_snapshot(org_id, scope_type, scope_id, period, date desc);

-- Workflow builder entities (v1.5 — created early to avoid migration churn) -
create table workflow (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organization(id) on delete cascade,
  name text not null,
  description text,
  status workflow_status not null default 'draft',
  created_by uuid references app_user(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_workflow_org on workflow(org_id);

create table workflow_node (
  id uuid primary key default uuid_generate_v4(),
  workflow_id uuid not null references workflow(id) on delete cascade,
  type workflow_node_type not null,
  config jsonb not null default '{}'::jsonb,
  position_x numeric not null default 0,
  position_y numeric not null default 0,
  created_at timestamptz not null default now()
);
create index idx_wfnode_workflow on workflow_node(workflow_id);

create table workflow_edge (
  id uuid primary key default uuid_generate_v4(),
  workflow_id uuid not null references workflow(id) on delete cascade,
  from_node_id uuid not null references workflow_node(id) on delete cascade,
  to_node_id uuid not null references workflow_node(id) on delete cascade,
  branch_label text,
  created_at timestamptz not null default now()
);
create index idx_wfedge_workflow on workflow_edge(workflow_id);

create table workflow_run (
  id uuid primary key default uuid_generate_v4(),
  workflow_id uuid not null references workflow(id) on delete cascade,
  status workflow_run_status not null default 'running',
  trigger_payload jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index idx_wfrun_workflow_time on workflow_run(workflow_id, started_at desc);

create table workflow_run_log (
  id uuid primary key default uuid_generate_v4(),
  run_id uuid not null references workflow_run(id) on delete cascade,
  node_id uuid not null references workflow_node(id) on delete cascade,
  status text not null,
  input_payload jsonb,
  output_payload jsonb,
  duration_ms int,
  executed_at timestamptz not null default now()
);
create index idx_wfrunlog_run on workflow_run_log(run_id, executed_at);

-- ============================================================================
-- Auto-update updated_at trigger
-- ============================================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'organization', 'department', 'project', 'app_user',
      'task', 'notification_config', 'workflow'
    ])
  loop
    execute format(
      'create trigger trg_%I_updated_at before update on %I
       for each row execute function set_updated_at()', t, t
    );
  end loop;
end $$;

-- ============================================================================
-- Helper functions for RLS
-- ============================================================================
create or replace function current_user_org_id()
returns uuid
language sql stable security definer
as $$
  select org_id from app_user where id = auth.uid()
$$;

create or replace function is_platform_admin()
returns boolean
language sql stable security definer
as $$
  select exists (
    select 1 from platform_admin where email = auth.jwt() ->> 'email'
  )
$$;

create or replace function is_org_admin(target_org_id uuid)
returns boolean
language sql stable security definer
as $$
  select exists (
    select 1 from app_user
    where id = auth.uid() and org_id = target_org_id and role = 'admin'
  )
$$;

-- For cross-org access checks: returns true if current user belongs to host_org
-- of an active relation that includes target_org_id
create or replace function has_cross_org_access(target_org_id uuid, target_project_id uuid default null)
returns boolean
language sql stable security definer
as $$
  select exists (
    select 1 from org_relation r
    where r.is_active
      and (
        (r.host_org_id = current_user_org_id() and r.guest_org_id = target_org_id)
        or (r.guest_org_id = current_user_org_id() and r.host_org_id = target_org_id)
      )
      and (target_project_id is null or r.project_id = target_project_id)
  )
$$;

-- ============================================================================
-- Row Level Security policies
-- ============================================================================
-- Enable RLS on all tenant tables
alter table organization enable row level security;
alter table app_user enable row level security;
alter table department enable row level security;
alter table project enable row level security;
alter table task enable row level security;
alter table tag enable row level security;
alter table task_tag enable row level security;
alter table activity enable row level security;
alter table invitation enable row level security;
alter table membership enable row level security;
alter table cross_org_invitation enable row level security;
alter table org_relation enable row level security;
alter table ai_session enable row level security;
alter table notification_config enable row level security;
alter table notification_log enable row level security;
alter table line_link enable row level security;
alter table kpi_snapshot enable row level security;
alter table workflow enable row level security;
alter table workflow_node enable row level security;
alter table workflow_edge enable row level security;
alter table workflow_run enable row level security;
alter table workflow_run_log enable row level security;
alter table platform_admin enable row level security;

-- Generic policy template: users see only their own org rows
-- (Cross-org access added selectively for shared resources)

-- organization
create policy "org self read" on organization for select
  using (id = current_user_org_id() or is_platform_admin());
create policy "org admin update" on organization for update
  using (is_org_admin(id) or is_platform_admin());

-- app_user
create policy "user self org read" on app_user for select
  using (org_id = current_user_org_id() or is_platform_admin());
create policy "user self update" on app_user for update
  using (id = auth.uid());
create policy "user admin manage" on app_user for all
  using (is_org_admin(org_id) or is_platform_admin());

-- department / project — own org only
create policy "department org access" on department for all
  using (org_id = current_user_org_id() or is_platform_admin());
create policy "project org access" on project for select
  using (
    org_id = current_user_org_id()
    or has_cross_org_access(org_id, id)
    or is_platform_admin()
  );
create policy "project org write" on project for all
  using (org_id = current_user_org_id() or is_platform_admin());

-- task — own org or shared via cross-org project
create policy "task read access" on task for select
  using (
    org_id = current_user_org_id()
    or (project_id is not null and has_cross_org_access(org_id, project_id))
    or is_platform_admin()
  );
create policy "task write access" on task for all
  using (
    org_id = current_user_org_id()
    or (project_id is not null and has_cross_org_access(org_id, project_id))
    or is_platform_admin()
  );

-- tag / task_tag / activity / invitation / membership — own org
create policy "tag org access" on tag for all
  using (org_id = current_user_org_id() or is_platform_admin());
create policy "task_tag access" on task_tag for all
  using (
    exists (
      select 1 from task t
      where t.id = task_tag.task_id
        and (t.org_id = current_user_org_id() or is_platform_admin())
    )
  );
create policy "activity org access" on activity for all
  using (org_id = current_user_org_id() or is_platform_admin());
create policy "invitation org access" on invitation for all
  using (org_id = current_user_org_id() or is_platform_admin());
create policy "membership self read" on membership for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from app_user u
      where u.id = membership.user_id and u.org_id = current_user_org_id()
    )
    or is_platform_admin()
  );
create policy "membership admin manage" on membership for all
  using (
    exists (
      select 1 from app_user u
      where u.id = membership.user_id
        and is_org_admin(u.org_id)
    ) or is_platform_admin()
  );

-- cross_org_invitation / org_relation — both host and guest orgs can read
create policy "cross_org_inv read" on cross_org_invitation for select
  using (
    host_org_id = current_user_org_id()
    or is_platform_admin()
  );
create policy "cross_org_inv host manage" on cross_org_invitation for all
  using (host_org_id = current_user_org_id() or is_platform_admin());
create policy "org_relation read" on org_relation for select
  using (
    host_org_id = current_user_org_id()
    or guest_org_id = current_user_org_id()
    or is_platform_admin()
  );
create policy "org_relation host manage" on org_relation for all
  using (host_org_id = current_user_org_id() or is_platform_admin());

-- ai_session, notification_*, line_link, kpi_snapshot — own scope
create policy "ai_session org access" on ai_session for all
  using (org_id = current_user_org_id() or is_platform_admin());
create policy "notif_config self" on notification_config for all
  using (user_id = auth.uid());
create policy "notif_log self read" on notification_log for select
  using (user_id = auth.uid() or org_id = current_user_org_id() or is_platform_admin());
create policy "line_link self" on line_link for all
  using (user_id = auth.uid());
create policy "kpi org access" on kpi_snapshot for select
  using (org_id = current_user_org_id() or is_platform_admin());

-- workflow — own org
create policy "workflow org access" on workflow for all
  using (org_id = current_user_org_id() or is_platform_admin());
create policy "wfnode access" on workflow_node for all
  using (
    exists (
      select 1 from workflow w
      where w.id = workflow_node.workflow_id
        and (w.org_id = current_user_org_id() or is_platform_admin())
    )
  );
create policy "wfedge access" on workflow_edge for all
  using (
    exists (
      select 1 from workflow w
      where w.id = workflow_edge.workflow_id
        and (w.org_id = current_user_org_id() or is_platform_admin())
    )
  );
create policy "wfrun access" on workflow_run for all
  using (
    exists (
      select 1 from workflow w
      where w.id = workflow_run.workflow_id
        and (w.org_id = current_user_org_id() or is_platform_admin())
    )
  );
create policy "wfrunlog access" on workflow_run_log for all
  using (
    exists (
      select 1 from workflow_run r
      join workflow w on w.id = r.workflow_id
      where r.id = workflow_run_log.run_id
        and (w.org_id = current_user_org_id() or is_platform_admin())
    )
  );

-- platform_admin — only platform admins can read/manage
create policy "platform_admin self" on platform_admin for select
  using (is_platform_admin());
create policy "platform_admin super manage" on platform_admin for all
  using (
    exists (
      select 1 from platform_admin
      where email = auth.jwt() ->> 'email' and role = 'super_admin'
    )
  );
