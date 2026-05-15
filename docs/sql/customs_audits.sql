-- LDA Compliance Platform
-- Customs audit result persistence
-- Apply in Supabase SQL editor as an owner/admin.

create extension if not exists pgcrypto;

create table if not exists public.customs_audits (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  created_by uuid references auth.users(id),
  company_id uuid,
  operation_code text not null,
  pedimento_number text,
  importer_name text,
  broker_name text,
  customs_office text,
  compliance_percent numeric,
  risk_level text,
  executive_dictamen text,
  findings jsonb default '[]'::jsonb,
  loaded_documents jsonb default '[]'::jsonb,
  missing_documents jsonb default '[]'::jsonb,
  pedimento_data jsonb default '{}'::jsonb,
  result_json jsonb default '{}'::jsonb,
  pdf_storage_path text,
  audit_group_id uuid,
  audit_version int default 1,
  parent_audit_id uuid references public.customs_audits(id),
  superseded_by uuid references public.customs_audits(id),
  is_latest boolean default true,
  rerun_reason text,
  documents_added jsonb default '[]'::jsonb,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  delete_reason text,
  status text default 'completed'
);

create table if not exists public.customs_audit_logs (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid null references public.customs_audits(id),
  operation_code text,
  stage text,
  status text,
  message text,
  duration_ms integer null,
  metadata_json jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table public.customs_audits
  add column if not exists audit_group_id uuid,
  add column if not exists audit_version int default 1,
  add column if not exists parent_audit_id uuid references public.customs_audits(id),
  add column if not exists superseded_by uuid references public.customs_audits(id),
  add column if not exists is_latest boolean default true,
  add column if not exists rerun_reason text,
  add column if not exists documents_added jsonb default '[]'::jsonb,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id),
  add column if not exists delete_reason text;

create index if not exists idx_customs_audits_operation_code on public.customs_audits(operation_code);
create index if not exists idx_customs_audits_pedimento_number on public.customs_audits(pedimento_number);
create index if not exists idx_customs_audits_importer_name on public.customs_audits(importer_name);
create index if not exists idx_customs_audits_created_at_desc on public.customs_audits(created_at desc);
create index if not exists idx_customs_audits_audit_group_id on public.customs_audits(audit_group_id);
create index if not exists idx_customs_audits_latest on public.customs_audits(audit_group_id, is_latest);
create index if not exists idx_customs_audits_deleted_at on public.customs_audits(deleted_at);
create index if not exists idx_customs_audit_logs_audit_id on public.customs_audit_logs(audit_id);
create index if not exists idx_customs_audit_logs_operation_code on public.customs_audit_logs(operation_code);
create index if not exists idx_customs_audit_logs_created_at_desc on public.customs_audit_logs(created_at desc);

alter table public.customs_audits enable row level security;
alter table public.customs_audit_logs enable row level security;

drop policy if exists customs_audits_select_company_engine on public.customs_audits;
create policy customs_audits_select_company_engine
on public.customs_audits
for select
to authenticated
using (
  company_id = public.current_user_company_id()
  and public.user_can_access_engine('CUSTOMS_COMPLIANCE')
);

drop policy if exists customs_audits_insert_company_engine on public.customs_audits;
create policy customs_audits_insert_company_engine
on public.customs_audits
for insert
to authenticated
with check (
  company_id = public.current_user_company_id()
  and created_by = auth.uid()
  and public.user_can_execute_engine('CUSTOMS_COMPLIANCE')
);

drop policy if exists customs_audits_update_company_engine on public.customs_audits;
create policy customs_audits_update_company_engine
on public.customs_audits
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

drop policy if exists customs_audit_logs_select_company_engine on public.customs_audit_logs;
create policy customs_audit_logs_select_company_engine
on public.customs_audit_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.customs_audits audit
    where audit.id = customs_audit_logs.audit_id
      and audit.company_id = public.current_user_company_id()
      and public.user_can_access_engine('CUSTOMS_COMPLIANCE')
  )
);

drop policy if exists customs_audit_logs_insert_company_engine on public.customs_audit_logs;
create policy customs_audit_logs_insert_company_engine
on public.customs_audit_logs
for insert
to authenticated
with check (
  exists (
    select 1
    from public.customs_audits audit
    where audit.id = customs_audit_logs.audit_id
      and audit.company_id = public.current_user_company_id()
      and public.user_can_execute_engine('CUSTOMS_COMPLIANCE')
  )
);
