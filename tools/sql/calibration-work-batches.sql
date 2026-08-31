-- Calibration work batches: schema, locking, document metadata, audit, and RPCs.
-- Prerequisite: public.app_validate_token(text) returns username and role.

create extension if not exists pgcrypto;

create table if not exists public.calibration_work_batches (
  id uuid primary key default gen_random_uuid(),
  batch_no text not null unique,
  title text not null check (btrim(title) <> ''),
  unit_code text not null check (btrim(unit_code) <> ''),
  instrument_type text not null check (btrim(instrument_type) <> ''),
  status text not null default 'draft'
    check (status in ('draft','awaiting_acknowledgement_pdf','awaiting_calibration','partially_completed','awaiting_closure_pdf','completed','cancelled')),
  created_by text not null,
  created_at timestamptz not null default now(),
  confirmed_by text,
  confirmed_at timestamptz,
  completed_by text,
  completed_at timestamptz,
  cancelled_by text,
  cancelled_at timestamptz,
  cancel_reason text,
  updated_at timestamptz not null default now()
);

create table if not exists public.calibration_work_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.calibration_work_batches(id) on delete cascade,
  instrument_id bigint not null references public.instruments(id) on delete restrict,
  planned_date date not null,
  result_status text not null default 'in_progress'
    check (result_status in ('in_progress','completed','skipped')),
  cert_no text,
  calibration_date date,
  overdue_reason text,
  skip_reason text,
  completed_by text,
  completed_at timestamptz,
  is_active boolean not null default true,
  removed_by text,
  removed_at timestamptz,
  removal_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (batch_id, instrument_id),
  unique (batch_id, id, instrument_id)
);

alter table public.calibration_work_items add column if not exists is_active boolean not null default true;
alter table public.calibration_work_items add column if not exists removed_by text;
alter table public.calibration_work_items add column if not exists removed_at timestamptz;
alter table public.calibration_work_items add column if not exists removal_reason text;
create unique index if not exists calibration_work_items_lock_tuple_uidx
  on public.calibration_work_items(batch_id, id, instrument_id);

create table if not exists public.calibration_work_instrument_locks (
  instrument_id bigint primary key references public.instruments(id) on delete restrict,
  batch_id uuid not null references public.calibration_work_batches(id) on delete cascade,
  item_id uuid not null unique,
  locked_at timestamptz not null default now(),
  constraint calibration_work_instrument_locks_tuple_fkey
  foreign key (batch_id, item_id, instrument_id)
    references public.calibration_work_items(batch_id, id, instrument_id) on delete cascade
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.calibration_work_instrument_locks'::regclass
      and conname = 'calibration_work_instrument_locks_tuple_fkey'
  ) then
    alter table public.calibration_work_instrument_locks
      add constraint calibration_work_instrument_locks_tuple_fkey
      foreign key (batch_id, item_id, instrument_id)
      references public.calibration_work_items(batch_id, id, instrument_id) on delete cascade;
  end if;
end;
$$;

create table if not exists public.calibration_work_documents (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.calibration_work_batches(id) on delete cascade,
  item_id uuid references public.calibration_work_items(id) on delete restrict,
  document_kind text not null
    check (document_kind in ('acknowledgement','closure','certificate','overdue')),
  storage_path text not null unique check (btrim(storage_path) <> ''),
  version_number integer not null check (version_number > 0),
  is_current boolean not null default true,
  original_filename text not null check (btrim(original_filename) <> ''),
  mime_type text not null check (mime_type = 'application/pdf'),
  file_size bigint not null check (file_size > 0 and file_size <= 52428800),
  sha256 text not null check (sha256 ~ '^[0-9A-Fa-f]{64}$'),
  uploaded_by text not null,
  uploaded_at timestamptz not null default now(),
  replacement_reason text,
  unique (batch_id, item_id, document_kind, version_number)
);

create unique index if not exists calibration_work_documents_current_uidx
  on public.calibration_work_documents
    (batch_id, coalesce(item_id, '00000000-0000-0000-0000-000000000000'::uuid), document_kind)
  where is_current;

create unique index if not exists calibration_work_documents_version_uidx
  on public.calibration_work_documents
    (batch_id, coalesce(item_id, '00000000-0000-0000-0000-000000000000'::uuid), document_kind, version_number);

create table if not exists public.calibration_work_audit (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.calibration_work_batches(id) on delete cascade,
  item_id uuid references public.calibration_work_items(id) on delete set null,
  action text not null check (btrim(action) <> ''),
  actor text not null,
  occurred_at timestamptz not null default now(),
  before_data jsonb,
  after_data jsonb,
  reason text
);

create index if not exists calibration_work_items_batch_idx
  on public.calibration_work_items(batch_id);
create index if not exists calibration_work_documents_batch_idx
  on public.calibration_work_documents(batch_id, item_id, document_kind, version_number desc);
create index if not exists calibration_work_audit_batch_idx
  on public.calibration_work_audit(batch_id, occurred_at desc);

create or replace function public.cw_actor(p_token text, p_write boolean default false)
returns table(username text, role text)
language plpgsql security definer set search_path = public
as $$
begin
  return query
  select u.username, u.role
  from public.app_validate_token(p_token) u
  where not p_write or u.role in ('admin','editor');
  if not found then raise exception 'permission denied'; end if;
end;
$$;

create or replace function public.cw_request_token()
returns text
language sql stable security definer set search_path = public
as $$
  select coalesce(
    nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-app-token',
    ''
  );
$$;

create or replace function public.cw_next_batch_no()
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_year text := to_char(timezone('Asia/Bangkok', now()), 'YYYY');
  v_next integer;
begin
  perform pg_advisory_xact_lock(hashtext('calibration-work-batches:' || v_year));
  select coalesce(max(substring(batch_no from '([0-9]+)$')::integer), 0) + 1
    into v_next
  from public.calibration_work_batches
  where batch_no like 'PLAN-' || v_year || '-%';
  return 'PLAN-' || v_year || '-' || lpad(v_next::text, 4, '0');
end;
$$;

create or replace function public.cw_refresh_batch_status(p_batch_id uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_batch public.calibration_work_batches%rowtype;
  v_total integer;
  v_resolved integer;
  v_has_ack boolean;
  v_status text;
begin
  select * into strict v_batch
  from public.calibration_work_batches
  where id = p_batch_id
  for update;

  if v_batch.status in ('completed','cancelled') then
    return v_batch.status;
  end if;

  select count(*), count(*) filter (where result_status in ('completed','skipped'))
    into v_total, v_resolved
  from public.calibration_work_items
  where batch_id = p_batch_id and is_active;

  select exists (
    select 1 from public.calibration_work_documents
    where batch_id = p_batch_id and item_id is null
      and document_kind = 'acknowledgement' and is_current
  ) into v_has_ack;
  v_status := case
    when v_batch.confirmed_at is null then 'draft'
    when not v_has_ack then 'awaiting_acknowledgement_pdf'
    when v_total > 0 and v_total = v_resolved then 'awaiting_closure_pdf'
    when v_resolved > 0 then 'partially_completed'
    else 'awaiting_calibration'
  end;

  update public.calibration_work_batches
  set status = v_status, updated_at = now()
  where id = p_batch_id;
  return v_status;
end;
$$;

create or replace function public.cw_create_batch(
  p_token text,
  p_title text,
  p_unit_code text,
  p_instrument_type text,
  p_items jsonb
)
returns public.calibration_work_batches
language plpgsql security definer set search_path = public
as $$
declare
  v_actor record;
  v_batch public.calibration_work_batches%rowtype;
  v_json jsonb;
  v_instrument public.instruments%rowtype;
  v_item_id uuid;
begin
  select * into v_actor from public.cw_actor(p_token, true);
  if nullif(btrim(p_title), '') is null
     or nullif(btrim(p_unit_code), '') is null
     or nullif(btrim(p_instrument_type), '') is null then
    raise exception 'title, unit code, and instrument type are required';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'at least one item is required';
  end if;
  if (select count(*) from jsonb_array_elements(p_items)) <>
     (select count(distinct value ->> 'instrument_id') from jsonb_array_elements(p_items)) then
    raise exception 'duplicate instrument';
  end if;

  for v_json in select value from jsonb_array_elements(p_items)
  loop
    if coalesce(v_json ->> 'instrument_id', '') !~ '^[0-9]+$'
       or coalesce(v_json ->> 'planned_date', '') !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'each item requires instrument_id and ISO planned_date';
    end if;
    perform (v_json ->> 'planned_date')::date;
    select * into v_instrument
    from public.instruments
    where id = (v_json ->> 'instrument_id')::bigint
      and department = p_unit_code
      and instrument_type = p_instrument_type;
    if not found then
      raise exception 'instrument does not match batch group';
    end if;
  end loop;

  insert into public.calibration_work_batches
    (batch_no, title, unit_code, instrument_type, created_by)
  values
    (public.cw_next_batch_no(), btrim(p_title), btrim(p_unit_code), btrim(p_instrument_type), v_actor.username)
  returning * into v_batch;

  for v_json in select value from jsonb_array_elements(p_items)
  loop
    insert into public.calibration_work_items(batch_id, instrument_id, planned_date)
    values (v_batch.id, (v_json ->> 'instrument_id')::bigint, (v_json ->> 'planned_date')::date)
    returning id into v_item_id;
    insert into public.calibration_work_instrument_locks(instrument_id, batch_id, item_id)
    values ((v_json ->> 'instrument_id')::bigint, v_batch.id, v_item_id);
  end loop;

  insert into public.calibration_work_audit(batch_id, action, actor, before_data, after_data)
  values (v_batch.id, 'create_batch', v_actor.username, null, to_jsonb(v_batch));
  return v_batch;
end;
$$;

create or replace function public.cw_update_batch_draft(
  p_token text,
  p_batch_id uuid,
  p_title text,
  p_unit_code text,
  p_instrument_type text,
  p_expected_updated_at timestamptz
)
returns public.calibration_work_batches
language plpgsql security definer set search_path = public
as $$
declare
  v_actor record;
  v_before public.calibration_work_batches%rowtype;
  v_after public.calibration_work_batches%rowtype;
begin
  select * into v_actor from public.cw_actor(p_token, true);
  select * into strict v_before from public.calibration_work_batches
  where id = p_batch_id for update;
  if p_expected_updated_at is null or v_before.updated_at <> p_expected_updated_at then
    raise exception 'stale batch edit';
  end if;
  if v_before.status <> 'draft' then raise exception 'only draft metadata can be edited'; end if;
  if nullif(btrim(p_title), '') is null
     or nullif(btrim(p_unit_code), '') is null
     or nullif(btrim(p_instrument_type), '') is null then
    raise exception 'title, unit code, and instrument type are required';
  end if;
  if exists (
    select 1
    from public.calibration_work_items wi
    join public.instruments i on i.id = wi.instrument_id
    where wi.batch_id = p_batch_id and wi.is_active
      and (i.department <> p_unit_code or i.instrument_type <> p_instrument_type)
  ) then raise exception 'active instruments do not match the new batch group'; end if;

  update public.calibration_work_batches
  set title = btrim(p_title), unit_code = btrim(p_unit_code),
      instrument_type = btrim(p_instrument_type), updated_at = now()
  where id = p_batch_id returning * into v_after;
  insert into public.calibration_work_audit(batch_id, action, actor, before_data, after_data)
  values (p_batch_id, 'update_batch_metadata', v_actor.username,
          to_jsonb(v_before), to_jsonb(v_after));
  return v_after;
end;
$$;

create or replace function public.cw_confirm_batch(p_token text, p_batch_id uuid)
returns public.calibration_work_batches
language plpgsql security definer set search_path = public
as $$
declare
  v_actor record;
  v_before public.calibration_work_batches%rowtype;
  v_after public.calibration_work_batches%rowtype;
begin
  select * into v_actor from public.cw_actor(p_token, true);
  select * into strict v_before from public.calibration_work_batches
  where id = p_batch_id for update;
  if v_before.status <> 'draft' then raise exception 'batch is not draft'; end if;
  if not exists (select 1 from public.calibration_work_items where batch_id = p_batch_id and is_active) then
    raise exception 'batch has no items';
  end if;
  update public.calibration_work_batches
  set status = 'awaiting_acknowledgement_pdf', confirmed_by = v_actor.username,
      confirmed_at = now(), updated_at = now()
  where id = p_batch_id returning * into v_after;
  insert into public.calibration_work_audit(batch_id, action, actor, before_data, after_data)
  values (p_batch_id, 'confirm_batch', v_actor.username, to_jsonb(v_before), to_jsonb(v_after));
  return v_after;
end;
$$;

drop function if exists public.cw_mutate_items(text, uuid, jsonb, text);
create or replace function public.cw_mutate_items(
  p_token text,
  p_batch_id uuid,
  p_items jsonb,
  p_expected_updated_at timestamptz,
  p_reason text default null
)
returns public.calibration_work_batches
language plpgsql security definer set search_path = public
as $$
declare
  v_actor record;
  v_batch public.calibration_work_batches%rowtype;
  v_json jsonb;
  v_instrument public.instruments%rowtype;
  v_item_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_had_ack boolean;
  v_ack_before public.calibration_work_documents%rowtype;
  v_ack_after public.calibration_work_documents%rowtype;
  v_closure_before public.calibration_work_documents%rowtype;
  v_closure_after public.calibration_work_documents%rowtype;
  v_removed_before jsonb;
  v_removed_after jsonb;
begin
  select * into v_actor from public.cw_actor(p_token, true);
  select * into strict v_batch from public.calibration_work_batches
  where id = p_batch_id for update;
  if p_expected_updated_at is null or v_batch.updated_at <> p_expected_updated_at then
    raise exception 'stale batch edit';
  end if;
  if v_batch.status in ('completed','cancelled') then raise exception 'batch is closed'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'at least one item is required';
  end if;
  if (select count(*) from jsonb_array_elements(p_items)) <>
     (select count(distinct value ->> 'instrument_id') from jsonb_array_elements(p_items)) then
    raise exception 'duplicate instrument';
  end if;

  for v_json in select value from jsonb_array_elements(p_items)
  loop
    if coalesce(v_json ->> 'instrument_id', '') !~ '^[0-9]+$'
       or coalesce(v_json ->> 'planned_date', '') !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'each item requires instrument_id and ISO planned_date';
    end if;
    perform (v_json ->> 'planned_date')::date;
    select * into v_instrument from public.instruments
    where id = (v_json ->> 'instrument_id')::bigint
      and department = v_batch.unit_code
      and instrument_type = v_batch.instrument_type;
    if not found then raise exception 'instrument does not match batch group'; end if;
  end loop;

  select coalesce(jsonb_agg(to_jsonb(i) order by i.created_at), '[]'::jsonb)
    into v_before from public.calibration_work_items i
    where i.batch_id = p_batch_id and i.is_active;
  select exists (
    select 1 from public.calibration_work_documents
    where batch_id = p_batch_id and item_id is null and document_kind = 'acknowledgement'
  ) into v_had_ack;
  if v_had_ack and nullif(btrim(p_reason), '') is null then
    raise exception 'reason is required after acknowledgement';
  end if;
  if exists (
    select 1 from public.calibration_work_items i
    where i.batch_id = p_batch_id and i.is_active
      and exists (
        select 1 from jsonb_array_elements(p_items) requested(x)
        where (requested.x ->> 'instrument_id')::bigint = i.instrument_id
          and i.planned_date is distinct from (requested.x ->> 'planned_date')::date
      )
      and (
        i.result_status <> 'in_progress' or i.cert_no is not null or i.calibration_date is not null
        or i.overdue_reason is not null or i.skip_reason is not null
        or exists (
          select 1 from public.calibration_work_documents d
          where d.item_id = i.id and d.is_current
            and d.document_kind in ('certificate','overdue')
        )
      )
  ) then
    raise exception 'reset item result before changing planned date';
  end if;
  if exists (
    select 1 from public.calibration_work_items i
    where i.batch_id = p_batch_id and i.is_active
      and not exists (
        select 1 from jsonb_array_elements(p_items) x
        where (x ->> 'instrument_id')::bigint = i.instrument_id
      )
      and (
        i.result_status <> 'in_progress' or i.cert_no is not null or i.calibration_date is not null
        or i.overdue_reason is not null or i.skip_reason is not null
        or exists (
          select 1 from public.calibration_work_documents d
          where d.item_id = i.id and d.is_current
            and d.document_kind in ('certificate','overdue')
        )
      )
  ) then
    raise exception 'reset item result before removal';
  end if;

  delete from public.calibration_work_instrument_locks where batch_id = p_batch_id;
  select coalesce(jsonb_agg(to_jsonb(i) order by i.created_at), '[]'::jsonb)
    into v_removed_before
  from public.calibration_work_items i
  where i.batch_id = p_batch_id and i.is_active
    and not exists (
      select 1 from jsonb_array_elements(p_items) x
      where (x ->> 'instrument_id')::bigint = i.instrument_id
    );
  update public.calibration_work_items i
  set is_active = false, removed_by = v_actor.username, removed_at = now(),
      removal_reason = nullif(btrim(p_reason), ''), updated_at = now()
  where i.batch_id = p_batch_id and i.is_active
    and not exists (
      select 1 from jsonb_array_elements(p_items) x
      where (x ->> 'instrument_id')::bigint = i.instrument_id
    );
  if v_removed_before <> '[]'::jsonb then
    select coalesce(jsonb_agg(to_jsonb(i) order by i.created_at), '[]'::jsonb)
      into v_removed_after
    from public.calibration_work_items i
    where i.batch_id = p_batch_id and not i.is_active
      and i.removed_at = (select max(removed_at) from public.calibration_work_items where batch_id = p_batch_id);
    insert into public.calibration_work_audit(batch_id, action, actor, before_data, after_data, reason)
    values (p_batch_id, 'remove_items', v_actor.username, v_removed_before,
            v_removed_after, nullif(btrim(p_reason), ''));
  end if;

  for v_json in select value from jsonb_array_elements(p_items)
  loop
    insert into public.calibration_work_items(batch_id, instrument_id, planned_date)
    values (p_batch_id, (v_json ->> 'instrument_id')::bigint, (v_json ->> 'planned_date')::date)
    on conflict (batch_id, instrument_id) do update
      set planned_date = excluded.planned_date, is_active = true,
          removed_by = null, removed_at = null, removal_reason = null, updated_at = now()
    returning id into v_item_id;
    insert into public.calibration_work_instrument_locks(instrument_id, batch_id, item_id)
    values ((v_json ->> 'instrument_id')::bigint, p_batch_id, v_item_id);
  end loop;

  if v_had_ack then
    select * into v_ack_before from public.calibration_work_documents
    where batch_id = p_batch_id and item_id is null
      and document_kind = 'acknowledgement' and is_current for update;
    update public.calibration_work_documents
    set is_current = false
    where batch_id = p_batch_id and item_id is null
      and document_kind = 'acknowledgement' and is_current
    returning * into v_ack_after;
    if v_ack_before.id is not null then
      insert into public.calibration_work_audit
        (batch_id, action, actor, before_data, after_data, reason)
      values
        (p_batch_id, 'invalidate_acknowledgement_document', v_actor.username,
         to_jsonb(v_ack_before), to_jsonb(v_ack_after), btrim(p_reason));
    end if;
  end if;
  select * into v_closure_before from public.calibration_work_documents
  where batch_id = p_batch_id and item_id is null
    and document_kind = 'closure' and is_current for update;
  if v_closure_before.id is not null then
    update public.calibration_work_documents
    set is_current = false
    where id = v_closure_before.id
    returning * into v_closure_after;
    insert into public.calibration_work_audit
      (batch_id, action, actor, before_data, after_data, reason)
    values
      (p_batch_id, 'invalidate_closure_document', v_actor.username,
       to_jsonb(v_closure_before), to_jsonb(v_closure_after), nullif(btrim(p_reason), ''));
  end if;
  update public.calibration_work_batches
  set status = case when confirmed_at is null then 'draft' else 'awaiting_acknowledgement_pdf' end,
      updated_at = now()
  where id = p_batch_id;
  select coalesce(jsonb_agg(to_jsonb(i) order by i.created_at), '[]'::jsonb)
    into v_after from public.calibration_work_items i
    where i.batch_id = p_batch_id and i.is_active;
  if not exists (
    select 1 from public.calibration_work_items
    where batch_id = p_batch_id and is_active
  ) then raise exception 'batch must retain at least one active item'; end if;
  insert into public.calibration_work_audit(batch_id, action, actor, before_data, after_data, reason)
  values (p_batch_id, 'mutate_items', v_actor.username, v_before, v_after, nullif(btrim(p_reason), ''));
  select * into v_batch from public.calibration_work_batches where id = p_batch_id;
  return v_batch;
end;
$$;

create or replace function public.cw_register_document(
  p_token text,
  p_batch_id uuid,
  p_item_id uuid,
  p_document_kind text,
  p_storage_path text,
  p_original_filename text,
  p_mime_type text,
  p_file_size bigint,
  p_sha256 text,
  p_replacement_reason text default null
)
returns public.calibration_work_documents
language plpgsql security definer set search_path = public
as $$
declare
  v_actor record;
  v_batch public.calibration_work_batches%rowtype;
  v_batch_after public.calibration_work_batches%rowtype;
  v_document public.calibration_work_documents%rowtype;
  v_before public.calibration_work_documents%rowtype;
  v_version integer;
  v_total integer;
  v_resolved integer;
  v_expected_path text;
  v_storage_mime text;
  v_storage_size bigint;
  v_storage_created_at timestamptz;
begin
  select * into v_actor from public.cw_actor(p_token, true);
  select * into strict v_batch from public.calibration_work_batches
  where id = p_batch_id for update;
  if p_document_kind not in ('acknowledgement','closure','certificate','overdue') then
    raise exception 'invalid document kind';
  end if;
  if p_original_filename !~* '\.pdf$' or p_sha256 !~ '^[0-9A-Fa-f]{64}$' then
    raise exception 'invalid PDF metadata';
  end if;
  if (p_document_kind in ('acknowledgement','closure') and p_item_id is not null)
     or (p_document_kind in ('certificate','overdue') and p_item_id is null) then
    raise exception 'invalid document scope';
  end if;
  if p_item_id is not null then
    perform 1 from public.calibration_work_items
    where id = p_item_id and batch_id = p_batch_id and is_active
    for update;
    if not found then raise exception 'active item does not belong to batch'; end if;
  end if;
  if v_batch.status = 'cancelled' then raise exception 'batch is cancelled'; end if;
  if p_document_kind = 'acknowledgement' and v_batch.status in ('draft','completed') then
    raise exception 'acknowledgement is not allowed in this state';
  end if;
  if p_document_kind in ('certificate','overdue') then
    if v_batch.status = 'completed' or not exists (
      select 1 from public.calibration_work_documents
      where batch_id = p_batch_id and item_id is null
        and document_kind = 'acknowledgement' and is_current
    ) then raise exception 'current acknowledgement is required'; end if;
  end if;
  if p_document_kind = 'closure' then
    select count(*), count(*) filter (where result_status in ('completed','skipped'))
      into v_total, v_resolved from public.calibration_work_items
      where batch_id = p_batch_id and is_active;
    if v_total = 0 or v_total <> v_resolved then raise exception 'all items must be resolved'; end if;
    if v_batch.status not in ('awaiting_closure_pdf','completed') then
      raise exception 'closure is not allowed in this state';
    end if;
  end if;

  select * into v_before from public.calibration_work_documents
  where batch_id = p_batch_id and item_id is not distinct from p_item_id
    and document_kind = p_document_kind and is_current
  for update;
  if found and nullif(btrim(p_replacement_reason), '') is null then
    raise exception 'replacement reason is required';
  end if;
  if p_document_kind = 'closure' and v_batch.status = 'completed' and v_before.id is null then
    raise exception 'completed batch requires current closure evidence for replacement';
  end if;
  select coalesce(max(version_number), 0) + 1 into v_version
  from public.calibration_work_documents
  where batch_id = p_batch_id and item_id is not distinct from p_item_id
    and document_kind = p_document_kind;
  v_expected_path := case
    when p_item_id is null then
      p_batch_id::text || '/batch/' || p_document_kind || '/v' || lpad(v_version::text, 4, '0') || '.pdf'
    else
      p_batch_id::text || '/items/' || p_item_id::text || '/' || p_document_kind ||
      '/v' || lpad(v_version::text, 4, '0') || '.pdf'
  end;
  if p_storage_path <> v_expected_path then
    raise exception 'storage path does not match batch, item, kind, and version';
  end if;
  if exists (
    select 1 from public.calibration_work_documents where storage_path = p_storage_path
  ) then raise exception 'storage path is already referenced'; end if;
  select lower(o.metadata ->> 'mimetype'), (o.metadata ->> 'size')::bigint, o.created_at
    into v_storage_mime, v_storage_size, v_storage_created_at
  from storage.objects o
  where o.bucket_id = 'calibration-work-batches'
    and o.name = p_storage_path
  for key share;
  if not found then raise exception 'uploaded Storage object not found'; end if;
  if v_storage_mime is distinct from 'application/pdf'
     or v_storage_size is null or v_storage_size <= 0 or v_storage_size > 52428800 then
    raise exception 'Storage object is not an allowed PDF';
  end if;
  if p_document_kind in ('acknowledgement','closure')
     and (v_storage_created_at is null or v_storage_created_at < v_batch.updated_at) then
    raise exception 'uploaded evidence predates the current batch version';
  end if;
  update public.calibration_work_documents set is_current = false
  where batch_id = p_batch_id and item_id is not distinct from p_item_id
    and document_kind = p_document_kind and is_current;
  insert into public.calibration_work_documents
    (batch_id, item_id, document_kind, storage_path, version_number, is_current,
     original_filename, mime_type, file_size, sha256, uploaded_by, replacement_reason)
  values
    (p_batch_id, p_item_id, p_document_kind, p_storage_path, v_version, true,
     p_original_filename, v_storage_mime, v_storage_size, lower(p_sha256), v_actor.username,
     nullif(btrim(p_replacement_reason), ''))
  returning * into v_document;

  if p_document_kind <> 'closure' then
    perform public.cw_refresh_batch_status(p_batch_id);
  elsif v_batch.status = 'awaiting_closure_pdf' then
    update public.calibration_work_batches
    set status = 'completed', completed_by = v_actor.username,
        completed_at = now(), updated_at = now()
    where id = p_batch_id returning * into v_batch_after;
    delete from public.calibration_work_instrument_locks where batch_id = p_batch_id;
    insert into public.calibration_work_audit(batch_id, action, actor, before_data, after_data)
    values (p_batch_id, 'complete_batch', v_actor.username,
            to_jsonb(v_batch), to_jsonb(v_batch_after));
  elsif v_batch.status = 'completed' then
    update public.calibration_work_batches set updated_at = now() where id = p_batch_id;
  end if;
  insert into public.calibration_work_audit
    (batch_id, item_id, action, actor, before_data, after_data, reason)
  values
    (p_batch_id, p_item_id, 'register_' || p_document_kind || '_document', v_actor.username,
     case when v_before.id is null then null else to_jsonb(v_before) end,
     to_jsonb(v_document), nullif(btrim(p_replacement_reason), ''));
  return v_document;
end;
$$;

create or replace function public.cw_save_item_draft(
  p_token text,
  p_item_id uuid,
  p_cert_no text,
  p_calibration_date date,
  p_overdue_reason text default null
)
returns public.calibration_work_items
language plpgsql security definer set search_path = public
as $$
declare
  v_actor record;
  v_before public.calibration_work_items%rowtype;
  v_after public.calibration_work_items%rowtype;
  v_batch public.calibration_work_batches%rowtype;
  v_batch_id uuid;
begin
  select * into v_actor from public.cw_actor(p_token, true);
  select batch_id into strict v_batch_id from public.calibration_work_items where id = p_item_id;
  select * into strict v_batch from public.calibration_work_batches where id = v_batch_id for update;
  select * into strict v_before from public.calibration_work_items where id = p_item_id for update;
  if not v_before.is_active or v_before.result_status <> 'in_progress'
     or v_batch.status in ('draft','awaiting_acknowledgement_pdf','completed','cancelled')
     or not exists (
       select 1 from public.calibration_work_documents
       where batch_id = v_before.batch_id and item_id is null
         and document_kind = 'acknowledgement' and is_current
     ) then raise exception 'item result is not editable'; end if;
  update public.calibration_work_items
  set cert_no = nullif(btrim(p_cert_no), ''), calibration_date = p_calibration_date,
      overdue_reason = nullif(btrim(p_overdue_reason), ''), updated_at = now()
  where id = p_item_id returning * into v_after;
  perform public.cw_refresh_batch_status(v_before.batch_id);
  insert into public.calibration_work_audit(batch_id, item_id, action, actor, before_data, after_data)
  values (v_after.batch_id, p_item_id, 'save_item_draft', v_actor.username,
          to_jsonb(v_before), to_jsonb(v_after));
  return v_after;
end;
$$;

create or replace function public.cw_complete_item(p_token text, p_item_id uuid)
returns public.calibration_work_items
language plpgsql security definer set search_path = public
as $$
declare
  v_actor record;
  v_item public.calibration_work_items%rowtype;
  v_after public.calibration_work_items%rowtype;
  v_batch public.calibration_work_batches%rowtype;
  v_batch_id uuid;
  v_instrument_before jsonb;
  v_instrument_after jsonb;
begin
  select * into v_actor from public.cw_actor(p_token, true);
  select batch_id into strict v_batch_id from public.calibration_work_items where id = p_item_id;
  select * into strict v_batch from public.calibration_work_batches where id = v_batch_id for update;
  select * into strict v_item from public.calibration_work_items where id = p_item_id for update;
  if not v_item.is_active or v_item.result_status <> 'in_progress'
     or v_batch.status in ('draft','awaiting_acknowledgement_pdf','completed','cancelled') then
    raise exception 'item cannot be completed';
  end if;
  if nullif(btrim(v_item.cert_no), '') is null or v_item.calibration_date is null then
    raise exception 'certificate number and calibration date are required';
  end if;
  if not exists (
    select 1 from public.calibration_work_documents
    where batch_id = v_item.batch_id and item_id = v_item.id
      and document_kind = 'certificate' and is_current
  ) then raise exception 'current certificate document is required'; end if;
  if v_item.calibration_date > v_item.planned_date and (
    nullif(btrim(v_item.overdue_reason), '') is null or not exists (
      select 1 from public.calibration_work_documents
      where batch_id = v_item.batch_id and item_id = v_item.id
        and document_kind = 'overdue' and is_current
    )
  ) then raise exception 'overdue reason and current overdue document are required'; end if;

  select jsonb_build_object('cert_no', cert_no, 'cal_date', cal_date)
    into v_instrument_before
  from public.instruments where id = v_item.instrument_id for update;
  if not found then raise exception 'instrument not found'; end if;
  -- Preserve instruments.due_date: this workflow owns only the certificate and calibration date.
  update public.instruments
  set cert_no = v_item.cert_no,
      cal_date = v_item.calibration_date
  where id = v_item.instrument_id;
  select jsonb_build_object('cert_no', cert_no, 'cal_date', cal_date)
    into v_instrument_after
  from public.instruments where id = v_item.instrument_id;
  insert into public.calibration_work_audit
    (batch_id, item_id, action, actor, before_data, after_data)
  values
    (v_item.batch_id, p_item_id, 'update_instrument_result', v_actor.username,
     v_instrument_before, v_instrument_after);
  update public.calibration_work_items
  set result_status = 'completed', completed_by = v_actor.username,
      completed_at = now(), skip_reason = null, updated_at = now()
  where id = p_item_id returning * into v_after;
  perform public.cw_refresh_batch_status(v_item.batch_id);
  insert into public.calibration_work_audit(batch_id, item_id, action, actor, before_data, after_data)
  values (v_item.batch_id, p_item_id, 'complete_item', v_actor.username,
          to_jsonb(v_item), to_jsonb(v_after));
  return v_after;
end;
$$;

create or replace function public.cw_skip_item(p_token text, p_item_id uuid, p_reason text)
returns public.calibration_work_items
language plpgsql security definer set search_path = public
as $$
declare
  v_actor record;
  v_before public.calibration_work_items%rowtype;
  v_after public.calibration_work_items%rowtype;
  v_batch public.calibration_work_batches%rowtype;
  v_batch_id uuid;
begin
  select * into v_actor from public.cw_actor(p_token, true);
  if nullif(btrim(p_reason), '') is null then raise exception 'skip reason is required'; end if;
  select batch_id into strict v_batch_id from public.calibration_work_items where id = p_item_id;
  select * into strict v_batch from public.calibration_work_batches where id = v_batch_id for update;
  select * into strict v_before from public.calibration_work_items where id = p_item_id for update;
  if not v_before.is_active or v_before.result_status <> 'in_progress'
     or v_batch.status in ('draft','awaiting_acknowledgement_pdf','completed','cancelled') then
    raise exception 'item cannot be skipped';
  end if;
  update public.calibration_work_items
  set result_status = 'skipped', skip_reason = btrim(p_reason),
      completed_by = v_actor.username, completed_at = now(), updated_at = now()
  where id = p_item_id returning * into v_after;
  perform public.cw_refresh_batch_status(v_before.batch_id);
  insert into public.calibration_work_audit(batch_id, item_id, action, actor, before_data, after_data, reason)
  values (v_before.batch_id, p_item_id, 'skip_item', v_actor.username,
          to_jsonb(v_before), to_jsonb(v_after), btrim(p_reason));
  return v_after;
end;
$$;

create or replace function public.cw_reset_item_result(p_token text, p_item_id uuid, p_reason text)
returns public.calibration_work_items
language plpgsql security definer set search_path = public
as $$
declare
  v_actor record;
  v_before public.calibration_work_items%rowtype;
  v_after public.calibration_work_items%rowtype;
  v_batch public.calibration_work_batches%rowtype;
  v_batch_id uuid;
  v_docs_before jsonb;
  v_docs_after jsonb;
  v_closure_before public.calibration_work_documents%rowtype;
  v_closure_after public.calibration_work_documents%rowtype;
  v_has_resettable boolean;
begin
  select * into v_actor from public.cw_actor(p_token, true);
  if nullif(btrim(p_reason), '') is null then raise exception 'reset reason is required'; end if;
  select batch_id into strict v_batch_id from public.calibration_work_items where id = p_item_id;
  select * into strict v_batch from public.calibration_work_batches where id = v_batch_id for update;
  select * into strict v_before from public.calibration_work_items where id = p_item_id for update;
  if not v_before.is_active or v_batch.status in ('completed','cancelled') then
    raise exception 'item cannot be reset';
  end if;
  v_has_resettable := v_before.result_status in ('completed','skipped')
    or (
      v_before.result_status = 'in_progress'
      and (
        v_before.cert_no is not null or v_before.calibration_date is not null
        or v_before.overdue_reason is not null or v_before.skip_reason is not null
        or exists (
          select 1 from public.calibration_work_documents d
          where d.item_id = p_item_id and d.is_current
            and d.document_kind in ('certificate','overdue')
        )
      )
    );
  if not v_has_resettable then raise exception 'nothing to reset'; end if;
  select * into v_closure_before from public.calibration_work_documents
  where batch_id = v_before.batch_id and item_id is null
    and document_kind = 'closure' and is_current for update;
  if v_closure_before.id is not null then
    update public.calibration_work_documents
    set is_current = false
    where id = v_closure_before.id
    returning * into v_closure_after;
    insert into public.calibration_work_audit
      (batch_id, item_id, action, actor, before_data, after_data, reason)
    values
      (v_before.batch_id, p_item_id, 'invalidate_closure_document', v_actor.username,
       to_jsonb(v_closure_before), to_jsonb(v_closure_after), btrim(p_reason));
  end if;
  select coalesce(jsonb_agg(to_jsonb(d) order by d.uploaded_at), '[]'::jsonb)
    into v_docs_before
  from public.calibration_work_documents d
  where d.item_id = p_item_id and d.document_kind in ('certificate','overdue') and d.is_current;
  update public.calibration_work_documents set is_current = false
  where item_id = p_item_id and document_kind in ('certificate','overdue') and is_current;
  if v_docs_before <> '[]'::jsonb then
    select coalesce(jsonb_agg(to_jsonb(d) order by d.uploaded_at), '[]'::jsonb)
      into v_docs_after
    from public.calibration_work_documents d
    where d.id in (
      select (x ->> 'id')::uuid from jsonb_array_elements(v_docs_before) x
    );
    insert into public.calibration_work_audit
      (batch_id, item_id, action, actor, before_data, after_data, reason)
    values
      (v_before.batch_id, p_item_id, 'reset_invalidate_documents', v_actor.username,
       v_docs_before, v_docs_after, btrim(p_reason));
  end if;
  update public.calibration_work_items
  set result_status = 'in_progress', cert_no = null, calibration_date = null,
      overdue_reason = null, skip_reason = null, completed_by = null,
      completed_at = null, updated_at = now()
  where id = p_item_id returning * into v_after;
  perform public.cw_refresh_batch_status(v_before.batch_id);
  insert into public.calibration_work_audit(batch_id, item_id, action, actor, before_data, after_data, reason)
  values (v_before.batch_id, p_item_id, 'reset_item_result', v_actor.username,
          to_jsonb(v_before), to_jsonb(v_after), btrim(p_reason));
  return v_after;
end;
$$;

create or replace function public.cw_complete_batch(p_token text, p_batch_id uuid)
returns public.calibration_work_batches
language plpgsql security definer set search_path = public
as $$
declare
  v_actor record;
begin
  select * into v_actor from public.cw_actor(p_token, true);
  raise exception 'batch completion occurs atomically when closure is registered';
end;
$$;

create or replace function public.cw_cancel_batch(p_token text, p_batch_id uuid, p_reason text)
returns public.calibration_work_batches
language plpgsql security definer set search_path = public
as $$
declare
  v_actor record;
  v_before public.calibration_work_batches%rowtype;
  v_after public.calibration_work_batches%rowtype;
begin
  select * into v_actor from public.cw_actor(p_token, true);
  if nullif(btrim(p_reason), '') is null then raise exception 'cancel reason is required'; end if;
  select * into strict v_before from public.calibration_work_batches
  where id = p_batch_id for update;
  if v_before.status in ('completed','cancelled') then raise exception 'batch is closed'; end if;
  update public.calibration_work_batches
  set status = 'cancelled', cancelled_by = v_actor.username, cancelled_at = now(),
      cancel_reason = btrim(p_reason), updated_at = now()
  where id = p_batch_id returning * into v_after;
  delete from public.calibration_work_instrument_locks where batch_id = p_batch_id;
  insert into public.calibration_work_audit(batch_id, action, actor, before_data, after_data, reason)
  values (p_batch_id, 'cancel_batch', v_actor.username,
          to_jsonb(v_before), to_jsonb(v_after), btrim(p_reason));
  return v_after;
end;
$$;

alter table public.calibration_work_batches enable row level security;
alter table public.calibration_work_items enable row level security;
alter table public.calibration_work_instrument_locks enable row level security;
alter table public.calibration_work_documents enable row level security;
alter table public.calibration_work_audit enable row level security;

drop policy if exists calibration_work_batches_read on public.calibration_work_batches;
create policy calibration_work_batches_read on public.calibration_work_batches
  for select to anon, authenticated
  using (exists (select 1 from public.cw_actor(public.cw_request_token(), false)));
drop policy if exists calibration_work_items_read on public.calibration_work_items;
create policy calibration_work_items_read on public.calibration_work_items
  for select to anon, authenticated
  using (exists (select 1 from public.cw_actor(public.cw_request_token(), false)));
drop policy if exists calibration_work_locks_read on public.calibration_work_instrument_locks;
create policy calibration_work_locks_read on public.calibration_work_instrument_locks
  for select to anon, authenticated
  using (exists (select 1 from public.cw_actor(public.cw_request_token(), false)));
drop policy if exists calibration_work_documents_read on public.calibration_work_documents;
create policy calibration_work_documents_read on public.calibration_work_documents
  for select to anon, authenticated
  using (exists (select 1 from public.cw_actor(public.cw_request_token(), false)));
drop policy if exists calibration_work_audit_read on public.calibration_work_audit;
create policy calibration_work_audit_read on public.calibration_work_audit
  for select to anon, authenticated
  using (exists (select 1 from public.cw_actor(public.cw_request_token(), false)));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('calibration-work-batches', 'calibration-work-batches', false, 52428800, array['application/pdf'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists calibration_work_storage_read on storage.objects;
create policy calibration_work_storage_read on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'calibration-work-batches'
    and exists (select 1 from public.cw_actor(public.cw_request_token(), false))
    and exists (
      select 1 from public.calibration_work_batches b
      where b.id::text = (storage.foldername(name))[1]
    )
  );
drop policy if exists calibration_work_storage_insert on storage.objects;
create policy calibration_work_storage_insert on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'calibration-work-batches'
    and exists (select 1 from public.cw_actor(public.cw_request_token(), true))
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(batch/(acknowledgement|closure)|items/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(certificate|overdue))/v[0-9]{4}\.pdf$'
    and exists (
      select 1 from public.calibration_work_batches b
      where b.id::text = (storage.foldername(name))[1]
    )
    and not exists (
      select 1 from public.calibration_work_documents d where d.storage_path = name
    )
  );
drop policy if exists calibration_work_storage_update on storage.objects;
drop policy if exists calibration_work_storage_delete on storage.objects;
drop policy if exists calibration_work_storage_delete_orphan on storage.objects;
create policy calibration_work_storage_delete_orphan on storage.objects
  for delete to anon, authenticated
  using (
    bucket_id = 'calibration-work-batches'
    and exists (select 1 from public.cw_actor(public.cw_request_token(), true))
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(batch/(acknowledgement|closure)|items/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(certificate|overdue))/v[0-9]{4}\.pdf$'
    and exists (
      select 1 from public.calibration_work_batches b
      where b.id::text = (storage.foldername(name))[1]
    )
    and not exists (
      select 1 from public.calibration_work_documents d where d.storage_path = name
    )
  );

revoke all on public.calibration_work_batches from anon, authenticated;
revoke all on public.calibration_work_items from anon, authenticated;
revoke all on public.calibration_work_instrument_locks from anon, authenticated;
revoke all on public.calibration_work_documents from anon, authenticated;
revoke all on public.calibration_work_audit from anon, authenticated;
grant select on public.calibration_work_batches to anon, authenticated;
grant select on public.calibration_work_items to anon, authenticated;
grant select on public.calibration_work_instrument_locks to anon, authenticated;
grant select on public.calibration_work_documents to anon, authenticated;
grant select on public.calibration_work_audit to anon, authenticated;

revoke all on function public.cw_actor(text, boolean) from public;
revoke all on function public.cw_request_token() from public;
revoke all on function public.cw_next_batch_no() from public;
revoke all on function public.cw_refresh_batch_status(uuid) from public;
revoke all on function public.cw_create_batch(text, text, text, text, jsonb) from public;
revoke all on function public.cw_update_batch_draft(text, uuid, text, text, text, timestamptz) from public;
revoke all on function public.cw_confirm_batch(text, uuid) from public;
revoke all on function public.cw_mutate_items(text, uuid, jsonb, timestamptz, text) from public;
revoke all on function public.cw_register_document(text, uuid, uuid, text, text, text, text, bigint, text, text) from public;
revoke all on function public.cw_save_item_draft(text, uuid, text, date, text) from public;
revoke all on function public.cw_complete_item(text, uuid) from public;
revoke all on function public.cw_skip_item(text, uuid, text) from public;
revoke all on function public.cw_reset_item_result(text, uuid, text) from public;
revoke all on function public.cw_complete_batch(text, uuid) from public;
revoke all on function public.cw_cancel_batch(text, uuid, text) from public;
grant execute on function public.cw_actor(text, boolean) to anon, authenticated;
grant execute on function public.cw_request_token() to anon, authenticated;
grant execute on function public.cw_create_batch(text, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.cw_update_batch_draft(text, uuid, text, text, text, timestamptz) to anon, authenticated;
grant execute on function public.cw_confirm_batch(text, uuid) to anon, authenticated;
grant execute on function public.cw_mutate_items(text, uuid, jsonb, timestamptz, text) to anon, authenticated;
grant execute on function public.cw_register_document(text, uuid, uuid, text, text, text, text, bigint, text, text) to anon, authenticated;
grant execute on function public.cw_save_item_draft(text, uuid, text, date, text) to anon, authenticated;
grant execute on function public.cw_complete_item(text, uuid) to anon, authenticated;
grant execute on function public.cw_skip_item(text, uuid, text) to anon, authenticated;
grant execute on function public.cw_reset_item_result(text, uuid, text) to anon, authenticated;
grant execute on function public.cw_complete_batch(text, uuid) to anon, authenticated;
grant execute on function public.cw_cancel_batch(text, uuid, text) to anon, authenticated;
