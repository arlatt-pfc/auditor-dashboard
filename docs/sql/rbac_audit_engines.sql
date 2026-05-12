-- LDA Compliance Platform
-- RBAC multiempresa + audit engines
-- Apply in Supabase SQL editor as an owner/admin. Do not run from frontend code.

create extension if not exists pgcrypto;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tax_id text,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  full_name text not null default '',
  role text not null check (role in ('admin', 'auditor', 'lector')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_engines (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.user_engine_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  engine_id uuid not null references public.audit_engines(id) on delete cascade,
  can_read boolean not null default true,
  can_create boolean not null default false,
  can_execute boolean not null default false,
  can_export boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, company_id, engine_id)
);

alter table if exists public.customs_operations
  add column if not exists company_id uuid references public.companies(id),
  add column if not exists created_by uuid references auth.users(id);

alter table if exists public.customs_audit_batches
  add column if not exists company_id uuid references public.companies(id);

alter table if exists public.customs_findings
  add column if not exists created_by uuid references auth.users(id);

alter table if exists public.customs_documents
  add column if not exists uploaded_by uuid references auth.users(id);

create index if not exists idx_user_profiles_company_id on public.user_profiles(company_id);
create index if not exists idx_user_engine_access_user_company on public.user_engine_access(user_id, company_id);
create index if not exists idx_audit_engines_code on public.audit_engines(code);
create index if not exists idx_customs_operations_company_id on public.customs_operations(company_id);

insert into public.audit_engines (code, name, description)
values
  ('CUSTOMS_COMPLIANCE', 'Customs Compliance', 'Auditoría de importaciones, pedimentos, expedientes aduanales y cuentas de gastos.'),
  ('STPS_PEMEX_COMPLIANCE', 'STPS / PEMEX Compliance', 'Auditoría documental contra requerimientos STPS y PEMEX.'),
  ('CONTRACTOR_COMPLIANCE', 'Contractor Compliance', 'Auditoría documental de contratistas.')
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  status = 'active';

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.user_profiles
  where user_id = auth.uid()
  limit 1
$$;

create or replace function public.current_user_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id
  from public.user_profiles
  where user_id = auth.uid()
  limit 1
$$;

create or replace function public.user_can_access_engine(engine_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_engine_access uea
    join public.audit_engines ae on ae.id = uea.engine_id
    where uea.user_id = auth.uid()
      and uea.company_id = public.current_user_company_id()
      and ae.code = engine_code
      and ae.status = 'active'
      and uea.can_read = true
  )
$$;

create or replace function public.user_can_execute_engine(engine_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_engine_access uea
    join public.audit_engines ae on ae.id = uea.engine_id
    where uea.user_id = auth.uid()
      and uea.company_id = public.current_user_company_id()
      and ae.code = engine_code
      and ae.status = 'active'
      and uea.can_execute = true
      and public.current_user_role() in ('admin', 'auditor')
  )
$$;

create or replace function public.user_can_create_engine(engine_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_engine_access uea
    join public.audit_engines ae on ae.id = uea.engine_id
    where uea.user_id = auth.uid()
      and uea.company_id = public.current_user_company_id()
      and ae.code = engine_code
      and ae.status = 'active'
      and uea.can_create = true
      and public.current_user_role() in ('admin', 'auditor')
  )
$$;

alter table public.companies enable row level security;
alter table public.user_profiles enable row level security;
alter table public.audit_engines enable row level security;
alter table public.user_engine_access enable row level security;
alter table if exists public.customs_operations enable row level security;
alter table if exists public.customs_documents enable row level security;
alter table if exists public.customs_findings enable row level security;
alter table if exists public.customs_reports enable row level security;
alter table if exists public.customs_audit_batches enable row level security;

drop policy if exists companies_select_own on public.companies;
create policy companies_select_own
on public.companies
for select
to authenticated
using (id = public.current_user_company_id());

drop policy if exists companies_admin_update_own on public.companies;
create policy companies_admin_update_own
on public.companies
for update
to authenticated
using (id = public.current_user_company_id() and public.current_user_role() = 'admin')
with check (id = public.current_user_company_id() and public.current_user_role() = 'admin');

drop policy if exists user_profiles_select_company on public.user_profiles;
create policy user_profiles_select_company
on public.user_profiles
for select
to authenticated
using (company_id = public.current_user_company_id());

drop policy if exists user_profiles_admin_manage_company on public.user_profiles;
create policy user_profiles_admin_manage_company
on public.user_profiles
for all
to authenticated
using (company_id = public.current_user_company_id() and public.current_user_role() = 'admin')
with check (company_id = public.current_user_company_id() and public.current_user_role() = 'admin');

drop policy if exists audit_engines_select_active on public.audit_engines;
create policy audit_engines_select_active
on public.audit_engines
for select
to authenticated
using (status = 'active');

drop policy if exists user_engine_access_select_own_or_admin on public.user_engine_access;
create policy user_engine_access_select_own_or_admin
on public.user_engine_access
for select
to authenticated
using (
  company_id = public.current_user_company_id()
  and (user_id = auth.uid() or public.current_user_role() = 'admin')
);

drop policy if exists user_engine_access_admin_manage_company on public.user_engine_access;
create policy user_engine_access_admin_manage_company
on public.user_engine_access
for all
to authenticated
using (company_id = public.current_user_company_id() and public.current_user_role() = 'admin')
with check (company_id = public.current_user_company_id() and public.current_user_role() = 'admin');

drop policy if exists customs_operations_select_company_engine on public.customs_operations;
create policy customs_operations_select_company_engine
on public.customs_operations
for select
to authenticated
using (
  company_id = public.current_user_company_id()
  and public.user_can_access_engine('CUSTOMS_COMPLIANCE')
);

drop policy if exists customs_operations_insert_company_engine on public.customs_operations;
create policy customs_operations_insert_company_engine
on public.customs_operations
for insert
to authenticated
with check (
  company_id = public.current_user_company_id()
  and created_by = auth.uid()
  and public.user_can_create_engine('CUSTOMS_COMPLIANCE')
);

drop policy if exists customs_operations_update_company_engine on public.customs_operations;
create policy customs_operations_update_company_engine
on public.customs_operations
for update
to authenticated
using (
  company_id = public.current_user_company_id()
  and public.user_can_execute_engine('CUSTOMS_COMPLIANCE')
)
with check (
  company_id = public.current_user_company_id()
  and public.user_can_execute_engine('CUSTOMS_COMPLIANCE')
);

drop policy if exists customs_batches_select_company_engine on public.customs_audit_batches;
create policy customs_batches_select_company_engine
on public.customs_audit_batches
for select
to authenticated
using (
  company_id = public.current_user_company_id()
  and public.user_can_access_engine('CUSTOMS_COMPLIANCE')
);

drop policy if exists customs_batches_insert_company_engine on public.customs_audit_batches;
create policy customs_batches_insert_company_engine
on public.customs_audit_batches
for insert
to authenticated
with check (
  company_id = public.current_user_company_id()
  and public.user_can_execute_engine('CUSTOMS_COMPLIANCE')
);

drop policy if exists customs_documents_select_company_engine on public.customs_documents;
create policy customs_documents_select_company_engine
on public.customs_documents
for select
to authenticated
using (
  public.user_can_access_engine('CUSTOMS_COMPLIANCE')
  and exists (
    select 1
    from public.customs_operations co
    where co.id = customs_documents.operation_id
      and co.company_id = public.current_user_company_id()
  )
);

drop policy if exists customs_documents_insert_company_engine on public.customs_documents;
create policy customs_documents_insert_company_engine
on public.customs_documents
for insert
to authenticated
with check (
  uploaded_by = auth.uid()
  and public.user_can_create_engine('CUSTOMS_COMPLIANCE')
  and exists (
    select 1
    from public.customs_operations co
    where co.id = customs_documents.operation_id
      and co.company_id = public.current_user_company_id()
  )
);

drop policy if exists customs_findings_select_company_engine on public.customs_findings;
create policy customs_findings_select_company_engine
on public.customs_findings
for select
to authenticated
using (
  public.user_can_access_engine('CUSTOMS_COMPLIANCE')
  and exists (
    select 1
    from public.customs_operations co
    where co.id = customs_findings.operation_id
      and co.company_id = public.current_user_company_id()
  )
);

drop policy if exists customs_findings_insert_company_engine on public.customs_findings;
create policy customs_findings_insert_company_engine
on public.customs_findings
for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.user_can_execute_engine('CUSTOMS_COMPLIANCE')
  and exists (
    select 1
    from public.customs_operations co
    where co.id = customs_findings.operation_id
      and co.company_id = public.current_user_company_id()
  )
);

drop policy if exists customs_reports_select_company_engine on public.customs_reports;
create policy customs_reports_select_company_engine
on public.customs_reports
for select
to authenticated
using (
  public.user_can_access_engine('CUSTOMS_COMPLIANCE')
  and exists (
    select 1
    from public.customs_operations co
    where co.id = customs_reports.operation_id
      and co.company_id = public.current_user_company_id()
  )
);

-- The bot/VPS integration must send audit_engine_code with every job:
--   CUSTOMS_COMPLIANCE
--   STPS_PEMEX_COMPLIANCE
--   CONTRACTOR_COMPLIANCE
-- Future job tables should include company_id, created_by and audit_engine_code,
-- then enforce equivalent RLS checks with user_can_access_engine/code-specific permissions.
