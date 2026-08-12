-- Product feedback: email should be editable on People & Access, no
-- exceptions. admin_upsert_user previously upserted by email as the
-- allow-list's primary key, so changing it would silently create a second,
-- orphaned allowed_users row instead of renaming the existing person. Add
-- p_old_email so an edit can rename the row in place when the email changed.
--
-- Adding a parameter creates a new overload rather than replacing the old
-- 5-arg version, so drop that signature explicitly first.
drop function if exists admin_upsert_user(text, text, text, boolean, text[]);

create or replace function admin_upsert_user(
  p_old_email text, p_email text, p_name text, p_role text, p_all_clinics boolean, p_clinic_ids text[]
) returns void as $$
declare v_me profiles; v_uid uuid; v_cid text;
begin
  v_me := current_profile();
  if v_me is null or v_me.role <> 'Lead' then raise exception 'Only Leads can manage access.'; end if;
  if p_role not in ('Lead','Team') then raise exception 'Role must be Lead or Team.'; end if;
  -- anti-lockout must catch self-edits under either the old or new email,
  -- since a rename could otherwise be used to dodge this check
  if (lower(p_email) = lower(v_me.email) or (p_old_email is not null and lower(p_old_email) = lower(v_me.email)))
     and p_role <> 'Lead' then
    raise exception 'You cannot remove your own Lead role.';
  end if;

  if p_old_email is not null and lower(p_old_email) <> lower(p_email) then
    if exists (select 1 from allowed_users where lower(email) = lower(p_email)) then
      raise exception 'Someone with that email already exists.';
    end if;
    update allowed_users set email = lower(p_email) where lower(email) = lower(p_old_email);
    update profiles set email = lower(p_email) where lower(email) = lower(p_old_email);
  end if;

  insert into allowed_users (email, name, role, all_clinics, active)
  values (lower(p_email), p_name, p_role, p_all_clinics, true)
  on conflict (email) do update
    set name = excluded.name, role = excluded.role, all_clinics = excluded.all_clinics, active = true;

  -- if they've already signed in, update their live profile too
  select id into v_uid from profiles where lower(email) = lower(p_email);
  if v_uid is not null then
    update profiles set name = p_name, role = p_role, all_clinics = p_all_clinics, active = true where id = v_uid;
    delete from user_clinic_access where user_id = v_uid;
    if p_all_clinics is not true and p_clinic_ids is not null then
      foreach v_cid in array p_clinic_ids loop
        insert into user_clinic_access (user_id, clinic_id) values (v_uid, v_cid) on conflict do nothing;
      end loop;
    end if;
  end if;

  insert into audit_trail (user_email, action, detail)
  values (v_me.email, 'Admin upsert user', p_email || ' role=' || p_role || ' all_clinics=' || p_all_clinics);
end;
$$ language plpgsql security definer;
