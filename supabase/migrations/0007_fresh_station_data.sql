-- Fix: Start fresh audits without carrying stale sistem_current data
-- When creating a new audit session, dental_log_lines should be empty initially
-- Users must explicitly upload fresh Qty Sistem file for each audit

create or replace function add_station(p_session_id uuid, p_room_id uuid)
returns void as $$
declare
  v_profile profiles;
  v_clinic text;
  v_name text;
  v_audit text;
  v_existing dental_status;
begin
  v_profile := current_profile();
  select clinic_id, audit_type into v_clinic, v_audit from sessions where id = p_session_id;
  if not can_access_clinic(v_clinic) then raise exception 'You do not have access to this clinic.'; end if;
  select name into v_name from rooms where id = p_room_id;

  select * into v_existing from dental_status where session_id = p_session_id and room_id = p_room_id;
  if v_existing.id is not null then
    -- restoring a soft-deleted station in THIS session — never blocked
    if v_existing.deleted_at is not null then
      update dental_status set deleted_at = null, deleted_by = null where id = v_existing.id;
      insert into audit_trail (user_email, action, detail)
      values (v_profile.email, 'Restored station', v_name || ' — session ' || p_session_id);
    end if;
    return;
  end if;

  -- adding this station fresh: block if the same station is already live in a
  -- different unfinished session of the same audit type
  if exists (
    select 1
    from dental_status dstat
    join sessions sess on sess.id = dstat.session_id
    where dstat.room_id = p_room_id
      and dstat.deleted_at is null
      and sess.id <> p_session_id
      and sess.status = 'Active'
      and sess.deleted_at is null
      and sess.audit_type = v_audit
  ) then
    raise exception 'There is already an unfinished % audit on station "%". Finish or delete that one before starting another of the same type.', v_audit, v_name;
  end if;

  insert into dental_status (session_id, room_id, dental_name, total_count)
  values (p_session_id, p_room_id, v_name, 0);

  -- START FRESH: Don't auto-populate from stale sistem_current
  -- Users must explicitly upload fresh Qty Sistem file for each new audit
  -- This prevents carrying over old data from previous audit sessions

  insert into audit_trail (user_email, action, detail)
  values (v_profile.email, 'Added station', v_name || ' — session ' || p_session_id);
end;
$$ language plpgsql security definer;
