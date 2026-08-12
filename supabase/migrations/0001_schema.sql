-- ============================================================================
-- FDC Stock Opname — Supabase / Postgres schema  v4
-- Run once in the SQL Editor. If upgrading from an earlier version on a test
-- project, easiest is to drop the old tables first (or start a fresh project).
-- ============================================================================
-- WHAT'S NEW IN v4 (the big feature batch):
--   * Periods derived from timestamps in GMT+8 (calendar month + quarter) —
--     no periods table, computed on the fly (see period_month / period_quarter).
--   * Per-user clinic visibility scope (user_clinic_access) separate from role.
--   * Soft delete on sessions AND stations (deleted_at/by) — hidden and
--     uncounted everywhere, but the deletion itself stays traceable.
--   * Edit-after-submit: reopening a submitted station is allowed, sets an
--     "amended" flag, logs it, and recomputes Ketersesuaian on resubmit.
--   * Two-column merge upload: Sistem upload touches only qty_sistem; clinic
--     template upload touches only qty_kartu/qty_fisik. Neither wipes the
--     other. Union of items; partial rows allowed.
--   * Scoring rule: a line counts ONLY when qty_sistem AND qty_fisik are both
--     present; green when qty_fisik = qty_sistem exactly. Never autofilled,
--     never zero-filled.
--   * Admin-managed email template + multiple editable recipients per clinic.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------- reference tables ----------

create table clinics (
  id text primary key,
  name text not null
);

create table rooms (
  id uuid primary key default gen_random_uuid(),
  clinic_id text references clinics(id) not null,
  name text not null
);

create table barang (
  sku text primary key,
  name text not null,
  unit text
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  name text not null,
  role text not null default 'Team' check (role in ('Lead', 'Team')),
  all_clinics boolean not null default false   -- Leads typically true: see every clinic
);

-- which clinics a user may see/act on (ignored when profiles.all_clinics = true)
create table user_clinic_access (
  user_id uuid references profiles(id) on delete cascade not null,
  clinic_id text references clinics(id) on delete cascade not null,
  primary key (user_id, clinic_id)
);

create table allowed_users (
  email text primary key,
  name text not null,
  role text not null default 'Team' check (role in ('Lead', 'Team')),
  all_clinics boolean not null default false
);

-- ---------- per-clinic email recipients + email template ----------

create table clinic_recipients (
  id uuid primary key default gen_random_uuid(),
  clinic_id text references clinics(id) on delete cascade not null,
  email text not null,
  label text,                                  -- e.g. 'HOC', 'PIC', 'Regional'
  unique (clinic_id, email)
);

-- single-row config table for the report email template
create table email_settings (
  id int primary key default 1 check (id = 1),
  subject_template text not null default 'Stock Opname Report — {clinic}',
  body_template text not null default
    'Attached is the stock opname report for {clinic} ({audit_type} audit), period {period}. Overall Ketersesuaian: {ketersesuaian}%.',
  updated_by text,
  updated_at timestamptz
);
insert into email_settings (id) values (1) on conflict do nothing;

-- ---------- Qty Sistem current values + upload event log ----------

create table sistem_current (
  clinic_id text references clinics(id) not null,
  room_id uuid references rooms(id) not null,   -- per-STATION now (one upload = one station)
  barang_sku text references barang(sku) not null,
  qty numeric not null,
  unit text,
  updated_at timestamptz not null default now(),
  primary key (room_id, barang_sku)
);

create table upload_log (
  id uuid primary key default gen_random_uuid(),
  clinic_id text references clinics(id) not null,
  room_id uuid references rooms(id),
  kind text not null check (kind in ('Sistem', 'ClinicTemplate')),
  uploaded_by text not null,
  uploaded_at timestamptz not null default now(),
  row_count int not null
);

-- ---------- sessions / stations / line items ----------

create table sessions (
  id uuid primary key default gen_random_uuid(),
  clinic_id text references clinics(id) not null,
  clinic_name text not null,
  audit_type text not null check (audit_type in ('Offline', 'Self')),
  started_by text not null,
  started_at timestamptz not null default now(),
  status text not null default 'Active' check (status in ('Active', 'Finished')),
  finished_at timestamptz,
  deleted_at timestamptz,                       -- soft delete
  deleted_by text
);

create table dental_status (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade not null,
  room_id uuid references rooms(id) not null,
  dental_name text not null,
  status text not null default 'Not Started' check (status in ('Not Started', 'In Progress', 'Submitted')),
  submitted_at timestamptz,
  ketersesuaian numeric,
  total_count int not null default 0,           -- SKU count for this room at station-creation time
                                                 -- (added: add_station()/submit_dental_log() below
                                                 -- already read/write this column)
  filled_count int not null default 0,          -- rows with BOTH sistem and fisik present
  matched_count int not null default 0,         -- of those, fisik = sistem
  scorable_count int not null default 0,        -- rows eligible to score (both present) = filled_count
  amended boolean not null default false,       -- true if reopened+edited after a submit
  deleted_at timestamptz,                       -- soft delete at station level
  deleted_by text,
  unique (session_id, room_id)
);

create table dental_log_lines (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade not null,
  room_id uuid references rooms(id) not null,
  barang_sku text references barang(sku) not null,
  qty_sistem numeric,
  qty_kartu numeric,
  qty_fisik numeric,
  remarks text,
  updated_by text,
  updated_at timestamptz,
  unique (session_id, room_id, barang_sku)
);

create index idx_lines_session on dental_log_lines(session_id);
create index idx_status_session on dental_status(session_id);
create index idx_sistem_room on sistem_current(room_id);
create index idx_sessions_started on sessions(started_at);

-- ---------- audit trail / reports / expired ----------

create table audit_trail (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  user_email text not null,
  action text not null,
  detail text
);

create table reports_sent (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) not null,
  sent_at timestamptz not null default now(),
  sent_by text not null,
  recipients text[] not null
);

create table expired_log (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id),
  room_id uuid references rooms(id),
  barang_sku text references barang(sku),
  qty_expired numeric,
  remarks text
);

-- ============================================================================
-- PERIOD HELPERS — calendar month & quarter in GMT+8 (Asia stored as UTC).
-- These are immutable so they can be used in generated columns / indexes if
-- ever needed, and everywhere the app needs to bucket a timestamp.
-- ============================================================================

create or replace function period_month(ts timestamptz) returns text as $$
  select to_char(ts at time zone 'Asia/Singapore', 'YYYY-MM'); -- Asia/Singapore = GMT+8, no DST
$$ language sql immutable;

create or replace function period_quarter(ts timestamptz) returns text as $$
  select to_char(ts at time zone 'Asia/Singapore', 'YYYY')
         || '-Q'
         || to_char(ceil(extract(month from (ts at time zone 'Asia/Singapore')) / 3.0), 'FM0');
$$ language sql immutable;

-- ============================================================================
-- SCOPE / AUTH HELPERS
-- ============================================================================

create or replace function is_provisioned() returns boolean as $$
  select exists (select 1 from profiles where id = auth.uid());
$$ language sql stable security definer;

create or replace function current_profile() returns profiles as $$
  select * from profiles where id = auth.uid();
$$ language sql stable security definer;

-- true if the current user may see/act on this clinic
create or replace function can_access_clinic(p_clinic_id text) returns boolean as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and (p.all_clinics = true
           or exists (select 1 from user_clinic_access u where u.user_id = p.id and u.clinic_id = p_clinic_id))
  );
$$ language sql stable security definer;

-- ============================================================================
-- ROW LEVEL SECURITY
-- Read/write/delete on clinic-bound data is gated by can_access_clinic().
-- Direct writes to sessions/status/lines/sistem go through SECURITY DEFINER
-- functions below, so the 80% gate, scoring, and soft-delete rules can't be
-- bypassed by a hand-crafted client call.
-- ============================================================================

alter table clinics enable row level security;
alter table rooms enable row level security;
alter table barang enable row level security;
alter table profiles enable row level security;
alter table user_clinic_access enable row level security;
alter table allowed_users enable row level security;
alter table clinic_recipients enable row level security;
alter table email_settings enable row level security;
alter table sistem_current enable row level security;
alter table upload_log enable row level security;
alter table sessions enable row level security;
alter table dental_status enable row level security;
alter table dental_log_lines enable row level security;
alter table audit_trail enable row level security;
alter table reports_sent enable row level security;
alter table expired_log enable row level security;

-- reference data: any provisioned user reads; only Leads write (admin page uses these)
create policy "read" on clinics for select using (is_provisioned());
create policy "read" on rooms for select using (is_provisioned());
create policy "read" on barang for select using (is_provisioned());
create policy "lead write barang" on barang for all
  using ((current_profile()).role = 'Lead') with check ((current_profile()).role = 'Lead');

create policy "read own or provisioned" on profiles for select using (auth.uid() = id or is_provisioned());
create policy "lead manage profiles" on profiles for all
  using ((current_profile()).role = 'Lead') with check ((current_profile()).role = 'Lead');

create policy "read scope" on user_clinic_access for select using (is_provisioned());
create policy "lead manage scope" on user_clinic_access for all
  using ((current_profile()).role = 'Lead') with check ((current_profile()).role = 'Lead');

create policy "lead manage allowed" on allowed_users for all
  using ((current_profile()).role = 'Lead') with check ((current_profile()).role = 'Lead');

create policy "read recipients" on clinic_recipients for select using (is_provisioned());
create policy "lead manage recipients" on clinic_recipients for all
  using ((current_profile()).role = 'Lead') with check ((current_profile()).role = 'Lead');

create policy "read email settings" on email_settings for select using (is_provisioned());
create policy "lead manage email settings" on email_settings for all
  using ((current_profile()).role = 'Lead') with check ((current_profile()).role = 'Lead');

-- clinic-scoped operational data
create policy "scoped read sistem" on sistem_current for select using (can_access_clinic(clinic_id));
create policy "scoped read uploadlog" on upload_log for select using (can_access_clinic(clinic_id));
create policy "scoped read sessions" on sessions for select using (can_access_clinic(clinic_id));
create policy "scoped read status" on dental_status for select
  using (exists (select 1 from sessions s where s.id = session_id and can_access_clinic(s.clinic_id)));
create policy "scoped read lines" on dental_log_lines for select
  using (exists (select 1 from sessions s where s.id = session_id and can_access_clinic(s.clinic_id)));

create policy "read trail" on audit_trail for select using (is_provisioned());
create policy "read reports" on reports_sent for select
  using (exists (select 1 from sessions s where s.id = session_id and can_access_clinic(s.clinic_id)));
create policy "scoped expired" on expired_log for all
  using (exists (select 1 from sessions s where s.id = session_id and can_access_clinic(s.clinic_id)))
  with check (exists (select 1 from sessions s where s.id = session_id and can_access_clinic(s.clinic_id)));

-- ============================================================================
-- ACCESS PROVISIONING (allow-list gates who ever gets a profile)
--
-- NOTE: auth.users lives in the shared `auth` schema (one copy across dev/
-- staging/prod). A trigger on it can only ever be bound to ONE schema's
-- version of a provisioning function — running this migration against a
-- second or third schema would either fail outright (trigger already
-- exists) or silently rebind provisioning to the wrong environment. So
-- provisioning is a function the client calls itself right after sign-in,
-- through the schema-scoped Supabase client — it always resolves `profiles`
-- and `allowed_users` in the caller's own dev/staging/prod schema.
-- ============================================================================

create or replace function provision_self()
returns void as $$
declare v_allowed allowed_users; v_email text;
begin
  v_email := (select email from auth.users where id = auth.uid());
  if v_email is null then raise exception 'Not authenticated.'; end if;
  select * into v_allowed from allowed_users where lower(email) = lower(v_email);
  if v_allowed.email is not null then
    insert into profiles (id, email, name, role, all_clinics)
    values (auth.uid(), v_email, v_allowed.name, v_allowed.role, v_allowed.all_clinics)
    on conflict (id) do nothing;
  end if;
end;
$$ language plpgsql security definer;

create or replace function relink_allowed_users()
returns void as $$
begin
  insert into profiles (id, email, name, role, all_clinics)
  select u.id, u.email, a.name, a.role, a.all_clinics
  from auth.users u join allowed_users a on lower(a.email) = lower(u.email)
  on conflict (id) do nothing;
end;
$$ language plpgsql security definer;

-- ============================================================================
-- CORE FUNCTIONS
-- ============================================================================

-- Start a session for a clinic. Only creates the session shell; stations are
-- added explicitly (so "manually add a station" and "start" share one path).
-- p_room_ids: the dentals to include at creation (can add/remove later).
create or replace function create_session(p_clinic_id text, p_audit_type text, p_room_ids uuid[])
returns uuid as $$
declare
  v_profile profiles;
  v_session_id uuid;
  v_room rooms;
  v_rid uuid;
begin
  v_profile := current_profile();
  if v_profile is null then raise exception 'Your account is not provisioned.'; end if;
  if not can_access_clinic(p_clinic_id) then raise exception 'You do not have access to this clinic.'; end if;
  if array_length(p_room_ids, 1) is null then raise exception 'Select at least one dental station.'; end if;

  insert into sessions (clinic_id, clinic_name, audit_type, started_by)
  select p_clinic_id, c.name, p_audit_type, v_profile.name from clinics c where c.id = p_clinic_id
  returning id into v_session_id;

  foreach v_rid in array p_room_ids loop
    perform add_station(v_session_id, v_rid);
  end loop;

  insert into audit_trail (user_email, action, detail)
  values (v_profile.email, 'Started session', p_clinic_id || ' (' || p_audit_type || ')');
  return v_session_id;
end;
$$ language plpgsql security definer;

-- Add (or restore) a station to a session. If it was soft-deleted, this
-- clears the delete flag instead of duplicating. Seeds line rows from any
-- Sistem data already uploaded for that room.
create or replace function add_station(p_session_id uuid, p_room_id uuid)
returns void as $$
declare
  v_profile profiles;
  v_clinic text;
  v_name text;
  v_existing dental_status;
begin
  v_profile := current_profile();
  select clinic_id into v_clinic from sessions where id = p_session_id;
  if not can_access_clinic(v_clinic) then raise exception 'You do not have access to this clinic.'; end if;
  select name into v_name from rooms where id = p_room_id;

  select * into v_existing from dental_status where session_id = p_session_id and room_id = p_room_id;
  if v_existing.id is not null then
    if v_existing.deleted_at is not null then
      update dental_status set deleted_at = null, deleted_by = null where id = v_existing.id;
      insert into audit_trail (user_email, action, detail)
      values (v_profile.email, 'Restored station', v_name || ' — session ' || p_session_id);
    end if;
    return;
  end if;

  insert into dental_status (session_id, room_id, dental_name, total_count)
  values (p_session_id, p_room_id, v_name, (select count(*) from sistem_current where room_id = p_room_id));

  insert into dental_log_lines (session_id, room_id, barang_sku, qty_sistem, qty_kartu, qty_fisik)
  select p_session_id, p_room_id, sc.barang_sku, sc.qty, null, null
  from sistem_current sc where sc.room_id = p_room_id;

  insert into audit_trail (user_email, action, detail)
  values (v_profile.email, 'Added station', v_name || ' — session ' || p_session_id);
end;
$$ language plpgsql security definer;

-- Recompute the count columns for a station from its current lines.
-- Scoring rule: a line is scorable ONLY when qty_sistem AND qty_fisik are
-- both non-null; matched when qty_fisik = qty_sistem.
create or replace function recompute_station(p_session_id uuid, p_room_id uuid)
returns void as $$
declare v_scorable int; v_matched int; v_keters numeric;
begin
  select
    count(*) filter (where qty_sistem is not null and qty_fisik is not null),
    count(*) filter (where qty_sistem is not null and qty_fisik is not null and qty_fisik = qty_sistem)
  into v_scorable, v_matched
  from dental_log_lines where session_id = p_session_id and room_id = p_room_id;

  v_keters := case when v_scorable > 0 then round((v_matched::numeric / v_scorable) * 1000) / 10 else null end;

  update dental_status
  set filled_count = v_scorable, scorable_count = v_scorable, matched_count = v_matched,
      ketersesuaian = case when status = 'Submitted' then v_keters else ketersesuaian end
  where session_id = p_session_id and room_id = p_room_id;
end;
$$ language plpgsql security definer;

-- Edit one field on one line. Allowed while Active/In Progress, and also
-- after Submit IF the station has been reopened (status back to In Progress).
-- Accepts decimals (numeric). Empty string -> null (never zero-filled).
create or replace function save_line_edit(p_session_id uuid, p_room_id uuid, p_barang_sku text, p_field text, p_value text)
returns void as $$
declare v_profile profiles; v_status text; v_clinic text; v_num numeric;
begin
  v_profile := current_profile();
  select clinic_id into v_clinic from sessions where id = p_session_id;
  if not can_access_clinic(v_clinic) then raise exception 'You do not have access to this clinic.'; end if;
  if p_field not in ('qty_kartu','qty_fisik','qty_sistem','remarks') then raise exception 'That field cannot be edited.'; end if;

  select status into v_status from dental_status
  where session_id = p_session_id and room_id = p_room_id and deleted_at is null for update;
  if v_status is null then raise exception 'Station not found or deleted.'; end if;
  if v_status = 'Submitted' then
    raise exception 'This station is submitted — reopen it first to edit (creates an amendment record).';
  end if;

  if p_field = 'remarks' then
    update dental_log_lines set remarks = p_value, updated_by = v_profile.name, updated_at = now()
    where session_id = p_session_id and room_id = p_room_id and barang_sku = p_barang_sku;
  else
    v_num := nullif(trim(p_value), '')::numeric;  -- decimals ok; blank stays null
    if p_field = 'qty_kartu' then
      update dental_log_lines set qty_kartu = v_num, updated_by = v_profile.name, updated_at = now()
      where session_id = p_session_id and room_id = p_room_id and barang_sku = p_barang_sku;
    elsif p_field = 'qty_fisik' then
      update dental_log_lines set qty_fisik = v_num, updated_by = v_profile.name, updated_at = now()
      where session_id = p_session_id and room_id = p_room_id and barang_sku = p_barang_sku;
    else
      update dental_log_lines set qty_sistem = v_num, updated_by = v_profile.name, updated_at = now()
      where session_id = p_session_id and room_id = p_room_id and barang_sku = p_barang_sku;
    end if;
  end if;

  update dental_status set status = case
    when (select count(*) from dental_log_lines where session_id = p_session_id and room_id = p_room_id and (qty_kartu is not null or qty_fisik is not null)) > 0
    then 'In Progress' else 'Not Started' end
  where session_id = p_session_id and room_id = p_room_id and status <> 'Submitted';

  perform recompute_station(p_session_id, p_room_id);
end;
$$ language plpgsql security definer;

-- Merge-upload. p_kind = 'Sistem' fills only qty_sistem; 'ClinicTemplate'
-- fills only qty_kartu/qty_fisik. Upload always wins on ITS columns; never
-- touches the other's. New SKUs are added (union). p_items:
--   Sistem:         [{sku,name,qty,unit}]
--   ClinicTemplate: [{sku,kartu,fisik}]
-- Returns a summary the UI turns into the confirmation/diff popup.
create or replace function apply_upload(p_session_id uuid, p_room_id uuid, p_kind text, p_items jsonb)
returns jsonb as $$
declare
  v_profile profiles; v_clinic text; v_status text;
  v_item jsonb; v_sku text; v_updated int := 0; v_added int := 0; v_changed int := 0;
  v_qty numeric; v_kartu numeric; v_fisik numeric; v_old numeric;
begin
  v_profile := current_profile();
  select clinic_id into v_clinic from sessions where id = p_session_id;
  if not can_access_clinic(v_clinic) then raise exception 'You do not have access to this clinic.'; end if;
  select status into v_status from dental_status where session_id = p_session_id and room_id = p_room_id and deleted_at is null;
  if v_status is null then raise exception 'Station not found or deleted.'; end if;
  if v_status = 'Submitted' then raise exception 'Reopen this station before re-uploading.'; end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_sku := upper(trim(v_item ->> 'sku'));
    if v_sku is null or v_sku = '' then continue; end if;

    -- ensure master + line row exist (union behaviour)
    if not exists (select 1 from barang where sku = v_sku) then
      insert into barang (sku, name, unit)
      values (v_sku, coalesce(nullif(trim(v_item->>'name'),''), v_sku), v_item->>'unit');
      v_added := v_added + 1;
    elsif p_kind = 'Sistem' and nullif(trim(v_item->>'name'),'') is not null then
      update barang set name = trim(v_item->>'name'), unit = coalesce(v_item->>'unit', unit) where sku = v_sku;
    end if;

    if not exists (select 1 from dental_log_lines where session_id=p_session_id and room_id=p_room_id and barang_sku=v_sku) then
      insert into dental_log_lines (session_id, room_id, barang_sku) values (p_session_id, p_room_id, v_sku);
    end if;

    if p_kind = 'Sistem' then
      v_qty := (v_item->>'qty')::numeric;
      select qty_sistem into v_old from dental_log_lines where session_id=p_session_id and room_id=p_room_id and barang_sku=v_sku;
      if v_old is distinct from v_qty then v_changed := v_changed + 1; end if;
      update dental_log_lines set qty_sistem = v_qty, updated_by = v_profile.name, updated_at = now()
      where session_id=p_session_id and room_id=p_room_id and barang_sku=v_sku;
      -- keep station-level sistem snapshot fresh too
      insert into sistem_current (clinic_id, room_id, barang_sku, qty, unit)
      values (v_clinic, p_room_id, v_sku, v_qty, v_item->>'unit')
      on conflict (room_id, barang_sku) do update set qty = excluded.qty, unit = excluded.unit, updated_at = now();
    else
      v_kartu := nullif(v_item->>'kartu','')::numeric;
      v_fisik := nullif(v_item->>'fisik','')::numeric;
      update dental_log_lines set qty_kartu = v_kartu, qty_fisik = v_fisik, updated_by = v_profile.name, updated_at = now()
      where session_id=p_session_id and room_id=p_room_id and barang_sku=v_sku;
    end if;
    v_updated := v_updated + 1;
  end loop;

  update dental_status set status = case
    when (select count(*) from dental_log_lines where session_id=p_session_id and room_id=p_room_id and (qty_kartu is not null or qty_fisik is not null)) > 0
    then 'In Progress' else status end
  where session_id=p_session_id and room_id=p_room_id and status <> 'Submitted';

  insert into upload_log (clinic_id, room_id, kind, uploaded_by, row_count)
  values (v_clinic, p_room_id, p_kind, v_profile.name, v_updated);
  insert into audit_trail (user_email, action, detail)
  values (v_profile.email, 'Uploaded ' || p_kind, 'session ' || p_session_id || ' — ' || v_updated || ' rows, ' || v_added || ' new SKUs, ' || v_changed || ' values changed');

  perform recompute_station(p_session_id, p_room_id);
  return jsonb_build_object('updated', v_updated, 'added', v_added, 'changed', v_changed);
end;
$$ language plpgsql security definer;

-- Submit a station: 80% of rows must have BOTH sistem and fisik present.
create or replace function submit_dental_log(p_session_id uuid, p_room_id uuid)
returns jsonb as $$
declare v_profile profiles; v_clinic text; v_status text; v_total int; v_ready int; v_pct numeric;
begin
  v_profile := current_profile();
  select clinic_id into v_clinic from sessions where id = p_session_id;
  if not can_access_clinic(v_clinic) then raise exception 'You do not have access to this clinic.'; end if;
  select status into v_status from dental_status where session_id=p_session_id and room_id=p_room_id and deleted_at is null for update;
  if v_status is null then raise exception 'Station not found or deleted.'; end if;

  select count(*), count(*) filter (where qty_sistem is not null and qty_fisik is not null)
  into v_total, v_ready from dental_log_lines where session_id=p_session_id and room_id=p_room_id;
  v_pct := case when v_total > 0 then (v_ready::numeric / v_total) * 100 else 0 end;
  if v_pct < 80 then raise exception 'Only %% of items have both Qty Sistem and Qty Fisik — need 80%% to submit.', round(v_pct,0); end if;

  update dental_status set status='Submitted', submitted_at=now(),
    amended = case when submitted_at is not null then true else amended end
  where session_id=p_session_id and room_id=p_room_id;
  perform recompute_station(p_session_id, p_room_id);

  insert into audit_trail (user_email, action, detail)
  values (v_profile.email, 'Submitted station', p_room_id::text || ' — session ' || p_session_id);
  return (select jsonb_build_object('ketersesuaian', ketersesuaian, 'scorable', scorable_count, 'matched', matched_count, 'total', total_count)
          from dental_status where session_id=p_session_id and room_id=p_room_id);
end;
$$ language plpgsql security definer;

-- Reopen a submitted station for editing (edit-after-submit). Marks amended.
create or replace function reopen_dental_log(p_session_id uuid, p_room_id uuid)
returns void as $$
declare v_profile profiles; v_clinic text;
begin
  v_profile := current_profile();
  select clinic_id into v_clinic from sessions where id=p_session_id;
  if not can_access_clinic(v_clinic) then raise exception 'You do not have access to this clinic.'; end if;
  update dental_status set status='In Progress', amended=true
  where session_id=p_session_id and room_id=p_room_id and status='Submitted';
  insert into audit_trail (user_email, action, detail)
  values (v_profile.email, 'Reopened station (amendment)', p_room_id::text || ' — session ' || p_session_id);
end;
$$ language plpgsql security definer;

-- Finish a clinic session — needs >=1 non-deleted submitted station.
create or replace function finish_session(p_session_id uuid)
returns void as $$
declare v_profile profiles; v_clinic text; v_n int;
begin
  v_profile := current_profile();
  select clinic_id into v_clinic from sessions where id=p_session_id;
  if not can_access_clinic(v_clinic) then raise exception 'You do not have access to this clinic.'; end if;
  select count(*) into v_n from dental_status where session_id=p_session_id and status='Submitted' and deleted_at is null;
  if v_n = 0 then raise exception 'Submit at least one dental log before finishing.'; end if;
  update sessions set status='Finished', finished_at=now() where id=p_session_id;
  insert into audit_trail (user_email, action, detail) values (v_profile.email, 'Finished session', p_session_id::text);
end;
$$ language plpgsql security definer;

-- Soft-delete / restore at session and station level.
create or replace function soft_delete_session(p_session_id uuid)
returns void as $$
declare v_profile profiles; v_clinic text;
begin
  v_profile := current_profile();
  select clinic_id into v_clinic from sessions where id=p_session_id;
  if not can_access_clinic(v_clinic) then raise exception 'You do not have access to this clinic.'; end if;
  update sessions set deleted_at=now(), deleted_by=v_profile.name where id=p_session_id;
  insert into audit_trail (user_email, action, detail) values (v_profile.email, 'Soft-deleted session', p_session_id::text);
end;
$$ language plpgsql security definer;

create or replace function restore_session(p_session_id uuid)
returns void as $$
declare v_profile profiles; v_clinic text;
begin
  v_profile := current_profile();
  select clinic_id into v_clinic from sessions where id=p_session_id;
  if not can_access_clinic(v_clinic) then raise exception 'You do not have access to this clinic.'; end if;
  update sessions set deleted_at=null, deleted_by=null where id=p_session_id;
  insert into audit_trail (user_email, action, detail) values (v_profile.email, 'Restored session', p_session_id::text);
end;
$$ language plpgsql security definer;

create or replace function soft_delete_station(p_session_id uuid, p_room_id uuid)
returns void as $$
declare v_profile profiles; v_clinic text;
begin
  v_profile := current_profile();
  select clinic_id into v_clinic from sessions where id=p_session_id;
  if not can_access_clinic(v_clinic) then raise exception 'You do not have access to this clinic.'; end if;
  update dental_status set deleted_at=now(), deleted_by=v_profile.name where session_id=p_session_id and room_id=p_room_id;
  insert into audit_trail (user_email, action, detail) values (v_profile.email, 'Soft-deleted station', p_room_id::text || ' — session ' || p_session_id);
end;
$$ language plpgsql security definer;

-- ============================================================================
-- SAMPLE DATA — replace before go-live
-- ============================================================================
insert into barang (sku, name, unit) values
  ('AKSD001','DENTAL FLOSS (AKSESORIS)','PCS'),
  ('AKSI001','INTERDENTAL BRUSH','PACK'),
  ('AKSM003','MEMBER CARD (FDC)','PCS');

insert into clinics (id, name) values
  ('6i7x','FDC Bali'), ('dgfu','FDC Bekasi'), ('jinr','FDC Berbagi'),
  ('qgvo','FDC Bogor'), ('wjjl','FDC Bogor Tajur');

insert into rooms (clinic_id, name) values
  ('6i7x','Dental 1'), ('6i7x','Dental 2'), ('6i7x','Dental 3'), ('6i7x','Dental 4'), ('6i7x','Dental 5'),
  ('dgfu','Dental 1'), ('dgfu','Dental 2'), ('dgfu','Dental 3'),
  ('jinr','Dental 1'), ('jinr','Dental 2'),
  ('qgvo','Dental 1'), ('qgvo','Dental 2'), ('qgvo','Dental 3'), ('qgvo','Dental 4'),
  ('wjjl','Dental 1'), ('wjjl','Dental 2'), ('wjjl','Dental 3'), ('wjjl','Dental 4');

insert into allowed_users (email, name, role, all_clinics) values
  ('rahmathidayat@fdcdentalclinic.co.id','Rahmat Hidayat','Lead', true),
  ('abdul.mughny@fdcdentalclinic.co.id','Abdul Mughny','Lead', true),
  ('irfanayyash@fdcdentalclinic.co.id','Irfan Ayyash','Team', false),
  ('triakbarrudin@fdcdentalclinic.co.id','Tri Akbarrudin','Team', false),
  ('meitri.malinda@fdcdentalclinic.co.id','Meitri Malinda','Lead', true);

insert into clinic_recipients (clinic_id, email, label) values
  ('6i7x','poojakaur@fdcdentalclinic.co.id','HOC'),
  ('dgfu','jeaneth@fdcdentalclinic.co.id','HOC'),
  ('qgvo','putriwulandari@fdcdentalclinic.co.id','PIC');
