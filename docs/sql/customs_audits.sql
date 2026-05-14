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
  status text default 'completed'
);

create index if not exists idx_customs_audits_operation_code on public.customs_audits(operation_code);
create index if not exists idx_customs_audits_pedimento_number on public.customs_audits(pedimento_number);
create index if not exists idx_customs_audits_importer_name on public.customs_audits(importer_name);
create index if not exists idx_customs_audits_created_at_desc on public.customs_audits(created_at desc);

alter table public.customs_audits enable row level security;

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
