-- Initial tenant seed for LDA Compliance Platform.
-- Run docs/sql/rbac_audit_engines.sql first.

insert into public.companies (name, status)
select 'LOGISTICA DE DATOS', 'active'
where not exists (
  select 1
  from public.companies
  where name = 'LOGISTICA DE DATOS'
);

-- Manual onboarding steps:
--
-- 1. Create the admin user in Supabase Auth.
--    Supabase Dashboard > Authentication > Users > Add user.
--
-- 2. Copy the generated auth.users.id UUID.
--
-- 3. Replace the placeholder below and run the block.
--
-- 4. Assign engine permissions according to the user's role.

do $$
declare
  v_company_id uuid;
  v_user_id uuid := '00000000-0000-0000-0000-000000000000'; -- Replace with auth.users.id
begin
  select id
  into v_company_id
  from public.companies
  where name = 'LOGISTICA DE DATOS'
  order by created_at
  limit 1;

  if v_user_id = '00000000-0000-0000-0000-000000000000' then
    raise exception 'Replace v_user_id with the UUID from Supabase Auth before running this seed.';
  end if;

  insert into public.user_profiles (user_id, company_id, full_name, role)
  values (v_user_id, v_company_id, 'Administrador LDA', 'admin')
  on conflict (user_id) do update
  set
    company_id = excluded.company_id,
    full_name = excluded.full_name,
    role = excluded.role,
    updated_at = now();

  insert into public.user_engine_access (
    user_id,
    company_id,
    engine_id,
    can_read,
    can_create,
    can_execute,
    can_export
  )
  select
    v_user_id,
    v_company_id,
    ae.id,
    true,
    true,
    true,
    true
  from public.audit_engines ae
  where ae.code in (
    'CUSTOMS_COMPLIANCE',
    'STPS_PEMEX_COMPLIANCE',
    'CONTRACTOR_COMPLIANCE'
  )
  on conflict (user_id, company_id, engine_id) do update
  set
    can_read = excluded.can_read,
    can_create = excluded.can_create,
    can_execute = excluded.can_execute,
    can_export = excluded.can_export;
end $$;

-- Role guide:
-- admin   -> can_read=true, can_create=true, can_execute=true, can_export=true
-- auditor -> can_read=true, can_create=true, can_execute=true, can_export=true/false per policy
-- lector  -> can_read=true, can_create=false, can_execute=false, can_export=false/true per policy
