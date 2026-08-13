-- Product rule: a dental station may only be under one unfinished audit of a
-- given type at a time. Before tonight, nothing stopped two Active sessions
-- from both auditing the same station — their dental_log_lines are separate
-- rows, but the counts would double up and the two agents would clobber each
-- other's picture of the station. Block adding a station that's already in
-- another Active (unfinished, non-deleted) session of the SAME audit_type.
--
-- Deliberately scoped to the SAME type only: an Offline audit and a Self
-- audit of one station can legitimately run at once (they measure different
-- things), so those are still allowed — exactly the carve-out asked for.
--
-- The check lives in add_station, which is the single path both create_session
-- (initial stations) and mid-session "add station" go through, so one guard
-- covers both. If it fires inside create_session the whole session insert
-- rolls back with it — no orphan session left behind.

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
  values (p_session_id, p_room_id, v_name, (select count(*) from sistem_current where room_id = p_room_id));

  insert into dental_log_lines (session_id, room_id, barang_sku, qty_sistem, qty_kartu, qty_fisik)
  select p_session_id, p_room_id, sist.barang_sku, sist.qty, null, null
  from sistem_current sist where sist.room_id = p_room_id;

  insert into audit_trail (user_email, action, detail)
  values (v_profile.email, 'Added station', v_name || ' — session ' || p_session_id);
end;
$$ language plpgsql security definer;
