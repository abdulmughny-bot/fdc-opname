-- Clinics and rooms have only ever been managed by hand-writing SQL (see the
-- seed insert in 0001_schema.sql) — there was no admin UI or RPC for it.
-- Both tables already have RLS enabled with a select-only policy (no
-- insert/update/delete policy), so direct client writes are rejected; these
-- SECURITY DEFINER RPCs are the only way to manage them, mirroring the
-- admin_* pattern already used for people/access.
--
-- Lead-only for now (no dedicated custom-role permission bit exists for
-- clinic/station structure — it's foundational, not a day-to-day task).

create or replace function admin_upsert_clinic(p_id text, p_name text)
returns clinics as $$
declare
  v_me profiles;
  v_row clinics;
begin
  v_me := current_profile();
  if v_me is null or v_me.role <> 'Lead' then
    raise exception 'You do not have permission to manage clinics.';
  end if;
  if p_id is null or trim(p_id) = '' then raise exception 'Clinic ID is required.'; end if;
  if p_name is null or trim(p_name) = '' then raise exception 'Clinic name is required.'; end if;

  insert into clinics (id, name) values (trim(p_id), trim(p_name))
  on conflict (id) do update set name = excluded.name
  returning * into v_row;
  return v_row;
end;
$$ language plpgsql security definer;

create or replace function admin_delete_clinic(p_id text)
returns void as $$
declare v_me profiles;
begin
  v_me := current_profile();
  if v_me is null or v_me.role <> 'Lead' then
    raise exception 'You do not have permission to manage clinics.';
  end if;
  begin
    delete from clinics where id = p_id;
  exception when foreign_key_violation then
    raise exception 'This clinic still has stations, users, or audit sessions tied to it — remove those first.';
  end;
end;
$$ language plpgsql security definer;

create or replace function admin_upsert_room(p_id uuid, p_clinic_id text, p_name text)
returns rooms as $$
declare
  v_me profiles;
  v_row rooms;
begin
  v_me := current_profile();
  if v_me is null or v_me.role <> 'Lead' then
    raise exception 'You do not have permission to manage stations.';
  end if;
  if p_clinic_id is null or trim(p_clinic_id) = '' then raise exception 'Clinic is required.'; end if;
  if p_name is null or trim(p_name) = '' then raise exception 'Station name is required.'; end if;

  if p_id is null then
    insert into rooms (clinic_id, name) values (trim(p_clinic_id), trim(p_name)) returning * into v_row;
  else
    update rooms set clinic_id = trim(p_clinic_id), name = trim(p_name) where id = p_id
    returning * into v_row;
    if v_row is null then raise exception 'Station not found.'; end if;
  end if;
  return v_row;
end;
$$ language plpgsql security definer;

create or replace function admin_delete_room(p_id uuid)
returns void as $$
declare v_me profiles;
begin
  v_me := current_profile();
  if v_me is null or v_me.role <> 'Lead' then
    raise exception 'You do not have permission to manage stations.';
  end if;
  begin
    delete from rooms where id = p_id;
  exception when foreign_key_violation then
    raise exception 'This station has audit history and cannot be deleted.';
  end;
end;
$$ language plpgsql security definer;
