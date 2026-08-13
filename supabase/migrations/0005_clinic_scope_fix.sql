-- Product bug: specific-clinic picks for people who haven't signed in yet
-- were silently discarded. user_clinic_access is keyed by profiles.id, so
-- admin_upsert_user could only write scope for someone who already has a
-- profile row — for everyone else, the clinics an admin checked in the
-- People & Access editor just vanished on save, with no error. Give
-- allowed_users its own clinic_ids column so scope can be set before first
-- sign-in, then carry it into user_clinic_access the moment a profile is
-- created.

alter table allowed_users add column if not exists clinic_ids text[] not null default '{}';

drop function if exists admin_upsert_user(text, text, text, text, boolean, text[]);

create or replace function admin_upsert_user(
  p_old_email text, p_email text, p_name text, p_role text, p_all_clinics boolean, p_clinic_ids text[]
) returns void as $$
declare v_me profiles; v_uid uuid; v_cid text;
begin
  v_me := current_profile();
  if v_me is null or v_me.role <> 'Lead' then raise exception 'Only Leads can manage access.'; end if;
  if p_role not in ('Lead','Team') then raise exception 'Role must be Lead or Team.'; end if;
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

  insert into allowed_users (email, name, role, all_clinics, clinic_ids, active)
  values (lower(p_email), p_name, p_role, p_all_clinics, coalesce(p_clinic_ids, '{}'), true)
  on conflict (email) do update
    set name = excluded.name, role = excluded.role, all_clinics = excluded.all_clinics,
        clinic_ids = excluded.clinic_ids, active = true;

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

-- Read-side: fall back to allowed_users.clinic_ids when nobody has signed in
-- yet — user_clinic_access is empty because there's no profile row to key it
-- off of, so it previously always read back as '{}' regardless of what was
-- saved.
create or replace function admin_list_users()
returns table (email text, name text, role text, all_clinics boolean, active boolean, clinic_ids text[], has_signed_in boolean) as $$
  select a.email, a.name, a.role, a.all_clinics, a.active,
         coalesce(
           (select array_agg(uca.clinic_id) from user_clinic_access uca
            join profiles p on p.id = uca.user_id where lower(p.email) = lower(a.email)),
           a.clinic_ids, '{}'
         ) as clinic_ids,
         exists (select 1 from profiles p where lower(p.email) = lower(a.email)) as has_signed_in
  from allowed_users a
  where is_lead()
  order by a.active desc, a.name;
$$ language sql stable security definer;

-- First-sign-in provisioning: seed user_clinic_access from whatever scope
-- was already set on the allow-list, so pre-signin clinic picks actually
-- take effect once the person logs in.
create or replace function provision_self()
returns void as $$
declare v_allowed allowed_users; v_email text; v_cid text;
begin
  v_email := (select email from auth.users where id = auth.uid());
  if v_email is null then raise exception 'Not authenticated.'; end if;
  select * into v_allowed from allowed_users where lower(email) = lower(v_email) and active = true;
  if v_allowed.email is not null then
    insert into profiles (id, email, name, role, all_clinics, active)
    values (auth.uid(), v_email, v_allowed.name, v_allowed.role, v_allowed.all_clinics, true)
    on conflict (id) do update set active = true, role = excluded.role, all_clinics = excluded.all_clinics;

    if not v_allowed.all_clinics and v_allowed.clinic_ids is not null then
      foreach v_cid in array v_allowed.clinic_ids loop
        insert into user_clinic_access (user_id, clinic_id) values (auth.uid(), v_cid) on conflict do nothing;
      end loop;
    end if;
  end if;
end;
$$ language plpgsql security definer;

create or replace function relink_allowed_users()
returns void as $$
declare v_me profiles; r record; v_cid text;
begin
  v_me := current_profile();
  if v_me is null or v_me.role <> 'Lead' then raise exception 'Only Leads can relink users.'; end if;

  insert into profiles (id, email, name, role, all_clinics, active)
  select u.id, u.email, a.name, a.role, a.all_clinics, true
  from auth.users u join allowed_users a on lower(a.email) = lower(u.email)
  where a.active = true
  on conflict (id) do nothing;

  -- seed clinic scope for anyone relinked here (or earlier) who never had
  -- scope carried over, using the allow-list's clinic_ids
  for r in
    select p.id as uid, a.clinic_ids
    from profiles p join allowed_users a on lower(a.email) = lower(p.email)
    where a.active = true and a.all_clinics is not true and a.clinic_ids is not null
      and not exists (select 1 from user_clinic_access uca where uca.user_id = p.id)
  loop
    foreach v_cid in array r.clinic_ids loop
      insert into user_clinic_access (user_id, clinic_id) values (r.uid, v_cid) on conflict do nothing;
    end loop;
  end loop;
end;
$$ language plpgsql security definer;
