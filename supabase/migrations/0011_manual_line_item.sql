-- Lets a user add a brand-new line item to a station's log by hand (no file
-- upload needed), for both Offline and Self audits. Mirrors apply_upload's
-- barang/dental_log_lines insert-if-missing pattern, but for a single SKU,
-- and enforces the same Item Master membership rule as uploads: a SKU that
-- isn't in the catalog can't enter the log through any path.

create or replace function add_manual_line_item(p_session_id uuid, p_room_id uuid, p_barang_sku text)
returns dental_log_lines as $$
declare
  v_profile profiles;
  v_clinic text;
  v_status text;
  v_sku text := upper(trim(p_barang_sku));
  v_item item_master;
  v_line dental_log_lines;
begin
  v_profile := current_profile();
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

  select * into v_item from item_master where sku = v_sku and status = 'Active';
  if v_item is null then
    raise exception 'SKU % is not in Item Master — add it there first.', v_sku;
  end if;

  if exists (
    select 1 from dental_log_lines
    where session_id = p_session_id and room_id = p_room_id and barang_sku = v_sku
  ) then
    raise exception 'This item is already in the log.';
  end if;

  if not exists (select 1 from barang where sku = v_sku) then
    insert into barang (sku, name, unit) values (v_sku, v_item.name, v_item.unit);
  end if;

  insert into dental_log_lines (session_id, room_id, barang_sku, updated_by, updated_at)
  values (p_session_id, p_room_id, v_sku, v_profile.name, now())
  returning * into v_line;

  update dental_status set status = 'In Progress'
  where session_id = p_session_id and room_id = p_room_id and status = 'Not Started';

  perform recompute_station(p_session_id, p_room_id);

  return v_line;
end;
$$ language plpgsql security definer;
