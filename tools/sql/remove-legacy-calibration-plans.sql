-- One-time retirement of the legacy calibration planning schema.
-- A successful run removes the guarded tables, so any rerun intentionally fails
-- at the explicit table locks instead of accepting a missing or partial state.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Freeze all four legacy tables before counting so no rows can arrive between
-- validation and destructive DDL. Keep this order aligned with the table drops.
lock table
  public.plan_audit_log,
  public.calibration_plan_items,
  public.calibration_plans,
  public.frm_plans
in access exclusive mode;

do $$
declare
  v_frm_count bigint;
  v_legacy_count bigint;
  v_item_count bigint;
  v_audit_count bigint;
  v_function_signatures text[];
  v_policy_names text[];
  v_foreign_keys text[];
begin
  select count(*) into v_frm_count from public.frm_plans;
  select count(*) into v_legacy_count from public.calibration_plans;
  select count(*) into v_item_count from public.calibration_plan_items;
  select count(*) into v_audit_count from public.plan_audit_log;

  if v_frm_count <> 3 then
    raise exception 'legacy calibration plan precondition failed: expected 3 frm_plans rows, found %', v_frm_count;
  end if;
  if v_legacy_count <> 0 or v_item_count <> 0 or v_audit_count <> 0 then
    raise exception 'legacy calibration plan precondition failed: expected empty legacy child/audit tables; found calibration_plans=%, calibration_plan_items=%, plan_audit_log=%',
      v_legacy_count, v_item_count, v_audit_count;
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname <> 'information_schema'
      and n.nspname !~ '^pg_'
      and p.prokind in ('a', 'w') and p.proname like 'frm_plan%'
  ) then
    raise exception 'legacy calibration plan dependency precondition failed: unexpected aggregate or window routine';
  end if;

  select array_agg(
    format('%I.%I(%s)', n.nspname, p.proname, oidvectortypes(p.proargtypes))
    order by n.nspname, p.proname, oidvectortypes(p.proargtypes)
  )
  into v_function_signatures
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname <> 'information_schema'
    and n.nspname !~ '^pg_'
    and p.prokind in ('f', 'p')
    and (
      p.proname like 'frm_plan%'
      or pg_get_functiondef(p.oid) ~ '\m(frm_plans|calibration_plans|calibration_plan_items|plan_audit_log)\M'
    );

  if v_function_signatures is distinct from array[
    'public.frm_plan_acknowledge(uuid, uuid)',
    'public.frm_plan_approve(uuid, uuid)',
    'public.frm_plan_confirm_results(uuid, uuid)',
    'public.frm_plan_guard(uuid, uuid)',
    'public.frm_plan_mark_exported(uuid, uuid)',
    'public.frm_plan_reject(uuid, uuid, text)',
    'public.frm_plan_submit(uuid, uuid)',
    'public.frm_plan_submit_results(uuid, uuid)'
  ]::text[] then
    raise exception 'legacy calibration plan dependency precondition failed: unexpected functions: %',
      coalesce(v_function_signatures::text, '<none>');
  end if;

  if exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where not t.tgisinternal
      and n.nspname = 'public'
      and c.relname in ('frm_plans', 'calibration_plans', 'calibration_plan_items', 'plan_audit_log')
  ) then
    raise exception 'legacy calibration plan dependency precondition failed: unexpected trigger';
  end if;

  select array_agg(
    format('%I.%I.%I', schemaname, tablename, policyname)
    order by schemaname, tablename, policyname
  )
  into v_policy_names
  from pg_policies
  where schemaname = 'public'
    and tablename in ('frm_plans', 'calibration_plans', 'calibration_plan_items', 'plan_audit_log');

  if v_policy_names is distinct from array[
    'public.calibration_plan_items.calibration_plan_items_sel',
    'public.calibration_plan_items.calibration_plan_items_wr',
    'public.calibration_plans.calibration_plans_sel',
    'public.calibration_plans.calibration_plans_wr',
    'public.frm_plans.frm_plans_del',
    'public.frm_plans.frm_plans_ins',
    'public.frm_plans.frm_plans_sel',
    'public.frm_plans.frm_plans_upd',
    'public.plan_audit_log.plan_audit_log_sel',
    'public.plan_audit_log.plan_audit_log_wr'
  ]::text[] then
    raise exception 'legacy calibration plan dependency precondition failed: unexpected policies: %',
      coalesce(v_policy_names::text, '<none>');
  end if;

  if exists (
    select 1
    from pg_depend d
    join pg_rewrite r on r.oid = d.objid and d.classid = 'pg_rewrite'::regclass
    join pg_class v on v.oid = r.ev_class and v.relkind in ('v', 'm')
    join pg_class target on target.oid = d.refobjid
    join pg_namespace target_ns on target_ns.oid = target.relnamespace
    where target_ns.nspname = 'public'
      and target.relname in ('frm_plans', 'calibration_plans', 'calibration_plan_items', 'plan_audit_log')
  ) then
    raise exception 'legacy calibration plan dependency precondition failed: unexpected dependent view';
  end if;

  select array_agg(
    format('%I.%I.%I->%I.%I', n.nspname, c.relname, con.conname, rn.nspname, rc.relname)
    order by n.nspname, c.relname, con.conname, rn.nspname, rc.relname
  )
  into v_foreign_keys
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_class rc on rc.oid = con.confrelid
  join pg_namespace rn on rn.oid = rc.relnamespace
  where con.contype = 'f'
    and (
      (n.nspname = 'public' and c.relname in ('frm_plans', 'calibration_plans', 'calibration_plan_items', 'plan_audit_log'))
      or
      (rn.nspname = 'public' and rc.relname in ('frm_plans', 'calibration_plans', 'calibration_plan_items', 'plan_audit_log'))
    );

  if v_foreign_keys is distinct from array[
    'public.calibration_plan_items.calibration_plan_items_frm_plan_id_fkey->public.frm_plans',
    'public.calibration_plan_items.calibration_plan_items_plan_id_fkey->public.calibration_plans',
    'public.plan_audit_log.plan_audit_log_plan_id_fkey->public.calibration_plans'
  ]::text[] then
    raise exception 'legacy calibration plan dependency precondition failed: unexpected foreign keys: %',
      coalesce(v_foreign_keys::text, '<none>');
  end if;
end;
$$;

drop function if exists public.frm_plan_acknowledge(uuid, uuid);
drop function if exists public.frm_plan_approve(uuid, uuid);
drop function if exists public.frm_plan_confirm_results(uuid, uuid);
drop function if exists public.frm_plan_mark_exported(uuid, uuid);
drop function if exists public.frm_plan_reject(uuid, uuid, text);
drop function if exists public.frm_plan_submit(uuid, uuid);
drop function if exists public.frm_plan_submit_results(uuid, uuid);
drop function if exists public.frm_plan_guard(uuid, uuid);

drop policy calibration_plan_items_sel on public.calibration_plan_items;
drop policy calibration_plan_items_wr on public.calibration_plan_items;
drop policy calibration_plans_sel on public.calibration_plans;
drop policy calibration_plans_wr on public.calibration_plans;
drop policy frm_plans_del on public.frm_plans;
drop policy frm_plans_ins on public.frm_plans;
drop policy frm_plans_sel on public.frm_plans;
drop policy frm_plans_upd on public.frm_plans;
drop policy plan_audit_log_sel on public.plan_audit_log;
drop policy plan_audit_log_wr on public.plan_audit_log;

alter table public.calibration_plan_items
  drop constraint calibration_plan_items_frm_plan_id_fkey;
alter table public.calibration_plan_items
  drop constraint calibration_plan_items_plan_id_fkey;
alter table public.plan_audit_log
  drop constraint plan_audit_log_plan_id_fkey;

drop table public.plan_audit_log;
drop table public.calibration_plan_items;
drop table public.calibration_plans;
drop table public.frm_plans;

commit;
