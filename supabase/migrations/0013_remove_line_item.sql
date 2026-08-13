-- Lets a user remove a single line item from a station's log — the inverse
-- of add_manual_line_item, and just as necessary: a mis-added or mis-scanned
-- SKU had no way to be undone before this. Hard delete (not soft), same as
-- how any other field on an unsubmitted line is freely editable — there's
-- no separate audit value in keeping a half-filled row around.

create or replace function remove_line_item(p_session_id uuid, p_room_id uuid, p_barang_sku text)
returns void as $$
declare
  v_clinic text;
  v_status text;
begin
  select clinic_id into v_clinic from sessions where id = p_session_id;
  if not can_access_clinic(v_clinic) then
    raise exception 'You do not have access to this clinic.';
  end if;

  select status into v_status from dental_status
  where session_id = p_session_id and room_id = p_room_id and deleted_at is null
  for update;
  if v_status is null then
    raise exception 'Station not found or deleted.';
  end if;
  if v_status = 'Submitted' then
    raise exception 'This station is submitted — reopen it first to edit.';
  end if;

  delete from dental_log_lines
  where session_id = p_session_id and room_id = p_room_id and barang_sku = upper(trim(p_barang_sku));

  perform recompute_station(p_session_id, p_room_id);
end;
$$ language plpgsql security definer;
