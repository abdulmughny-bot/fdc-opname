-- Admin-configurable app settings. Currently one value: the stock-opname
-- acceptance threshold, previously hardcoded at 80 inside submit_dental_log.
-- Single-row config table, same shape/pattern as email_settings.

create table app_settings (
  id int primary key default 1 check (id = 1),
  submit_threshold numeric not null default 80 check (submit_threshold > 0 and submit_threshold <= 100),
  updated_by text,
  updated_at timestamptz
);
insert into app_settings (id) values (1) on conflict do nothing;

alter table app_settings enable row level security;

-- Any provisioned user can read it (the wizard needs it client-side to show
-- the submit gate copy) — only Leads can write, via admin_save_settings.
create policy "read settings" on app_settings for select using (is_provisioned());

create or replace function admin_save_settings(p_submit_threshold numeric)
returns void as $$
declare v_me profiles;
begin
  v_me := current_profile();
  if v_me is null or v_me.role <> 'Lead' then raise exception 'Only Leads can edit settings.'; end if;
  if p_submit_threshold <= 0 or p_submit_threshold > 100 then raise exception 'Threshold must be between 0 and 100.'; end if;
  update app_settings set submit_threshold = p_submit_threshold, updated_by = v_me.name, updated_at = now() where id = 1;
  insert into audit_trail (user_email, action, detail)
  values (v_me.email, 'Admin saved settings', 'submit_threshold=' || p_submit_threshold);
end;
$$ language plpgsql security definer;

-- Re-point the 80%-gate at the configurable threshold instead of a literal.
-- Everything else in this function is unchanged from 0001_schema.sql.
create or replace function submit_dental_log(p_session_id uuid, p_room_id uuid)
returns jsonb as $$
declare
  v_profile profiles; v_clinic text; v_status text; v_total int; v_ready int; v_pct numeric; v_threshold numeric;
begin
  v_profile := current_profile();
  select clinic_id into v_clinic from sessions where id = p_session_id;
  if not can_access_clinic(v_clinic) then raise exception 'You do not have access to this clinic.'; end if;
  select status into v_status from dental_status where session_id=p_session_id and room_id=p_room_id and deleted_at is null for update;
  if v_status is null then raise exception 'Station not found or deleted.'; end if;

  select count(*), count(*) filter (where qty_sistem is not null and qty_fisik is not null)
  into v_total, v_ready from dental_log_lines where session_id=p_session_id and room_id=p_room_id;
  v_pct := case when v_total > 0 then (v_ready::numeric / v_total) * 100 else 0 end;

  select coalesce(submit_threshold, 80) into v_threshold from app_settings where id = 1;
  if v_pct < v_threshold then
    -- NB: a bare `%` immediately followed by another `%` is read as an escaped
    -- literal percent sign (not "value then percent"), same as the original
    -- schema_v4.sql bug this replaces — that version had two `%%` but only one
    -- argument, which would raise "too many parameters specified for RAISE"
    -- instead of the intended message. Baking the "%" into each argument
    -- string sidesteps the ambiguity entirely.
    raise exception 'Only % of items have both Qty Sistem and Qty Fisik — need % to submit.',
      round(v_pct,0)::text || '%', v_threshold::text || '%';
  end if;

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
