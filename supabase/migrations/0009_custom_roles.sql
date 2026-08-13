-- Custom roles: named, reusable permission bundles that can be granted to a
-- Team member without making them a full Lead. Supersedes the role_permissions
-- table added in 0008 — that was a per-assignment table with no reusable
-- "role" concept and never had real data attached, so it's dropped here
-- rather than kept alongside a second, conflicting permission system.

drop policy if exists item_pricing_lead_only on item_pricing;
drop policy if exists item_pricing_lead_insert on item_pricing;
drop policy if exists item_pricing_lead_update on item_pricing;
drop table if exists role_permissions;

create table custom_roles (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  can_view_pricing boolean not null default false,
  can_edit_item_master boolean not null default false,
  can_manage_users boolean not null default false,
  can_access_admin boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id)
);

alter table profiles add column if not exists custom_role_id uuid references custom_roles(id) on delete set null;

-- Permission helpers — Lead always has every permission; otherwise defer to
-- the person's assigned custom role, if any. Mirrors the existing is_lead().
create or replace function can_view_pricing() returns boolean as $$
  select exists (
    select 1 from profiles p
    left join custom_roles cr on cr.id = p.custom_role_id
    where p.id = auth.uid() and p.active = true and (p.role = 'Lead' or coalesce(cr.can_view_pricing, false))
  );
$$ language sql stable security definer;

create or replace function can_edit_item_master() returns boolean as $$
  select exists (
    select 1 from profiles p
    left join custom_roles cr on cr.id = p.custom_role_id
    where p.id = auth.uid() and p.active = true and (p.role = 'Lead' or coalesce(cr.can_edit_item_master, false))
  );
$$ language sql stable security definer;

create or replace function can_manage_users() returns boolean as $$
  select exists (
    select 1 from profiles p
    left join custom_roles cr on cr.id = p.custom_role_id
    where p.id = auth.uid() and p.active = true and (p.role = 'Lead' or coalesce(cr.can_manage_users, false))
  );
$$ language sql stable security definer;

create or replace function can_access_admin() returns boolean as $$
  select exists (
    select 1 from profiles p
    left join custom_roles cr on cr.id = p.custom_role_id
    where p.id = auth.uid() and p.active = true and (p.role = 'Lead' or coalesce(cr.can_access_admin, false))
  );
$$ language sql stable security definer;

-- item_pricing RLS, now driven by can_view_pricing() instead of the dropped table.
create policy item_pricing_view on item_pricing
  for select using (can_view_pricing());

create policy item_pricing_insert on item_pricing
  for insert with check (can_view_pricing());

create policy item_pricing_update on item_pricing
  for update using (can_view_pricing());

-- update_item_pricing now checks can_view_pricing() instead of role_permissions.
create or replace function update_item_pricing(
  p_item_id uuid,
  p_selling_price decimal,
  p_clinic_id text default null,
  p_cost_price decimal default null
)
returns void as $$
declare
  v_profile profiles;
  v_margin_pct decimal;
begin
  v_profile := current_profile();

  if not can_view_pricing() then
    raise exception 'You do not have permission to update item pricing.';
  end if;

  if p_cost_price is not null then
    v_margin_pct := round(((p_selling_price - p_cost_price) / p_cost_price * 100)::numeric, 2);
  else
    v_margin_pct := null;
  end if;

  insert into item_pricing (item_id, clinic_id, selling_price, cost_price, margin_pct, updated_by)
  values (p_item_id, p_clinic_id, p_selling_price, p_cost_price, v_margin_pct, v_profile.id)
  on conflict (item_id, coalesce(clinic_id, '__global__')) do update
  set
    selling_price = p_selling_price,
    cost_price = p_cost_price,
    margin_pct = v_margin_pct,
    updated_by = v_profile.id,
    updated_at = now();

  insert into audit_trail (user_email, action, detail)
  values (v_profile.email, 'Updated item pricing', 'Item: ' || p_item_id || ', Price: ' || p_selling_price);
end;
$$ language plpgsql security definer;

-- Role catalog CRUD (Lead only — defining what a role grants is high-trust).
create or replace function admin_list_custom_roles()
returns setof custom_roles as $$
  select * from custom_roles where is_lead() order by name;
$$ language sql stable security definer;

create or replace function admin_upsert_custom_role(
  p_id uuid,
  p_name text,
  p_can_view_pricing boolean,
  p_can_edit_item_master boolean,
  p_can_manage_users boolean,
  p_can_access_admin boolean
) returns uuid as $$
declare v_me profiles; v_id uuid; v_name text;
begin
  v_me := current_profile();
  if v_me is null or v_me.role <> 'Lead' then raise exception 'Only Leads can manage roles.'; end if;
  v_name := trim(p_name);
  if v_name = '' then raise exception 'Role name is required.'; end if;
  if v_name in ('Lead', 'Team') then raise exception 'That name is reserved for the built-in roles.'; end if;

  if p_id is null then
    insert into custom_roles (name, can_view_pricing, can_edit_item_master, can_manage_users, can_access_admin, created_by)
    values (v_name, p_can_view_pricing, p_can_edit_item_master, p_can_manage_users, p_can_access_admin, v_me.id)
    returning id into v_id;
  else
    update custom_roles set
      name = v_name,
      can_view_pricing = p_can_view_pricing,
      can_edit_item_master = p_can_edit_item_master,
      can_manage_users = p_can_manage_users,
      can_access_admin = p_can_access_admin
    where id = p_id
    returning id into v_id;
  end if;

  insert into audit_trail (user_email, action, detail) values (v_me.email, 'Upserted custom role', v_name);
  return v_id;
end;
$$ language plpgsql security definer;

create or replace function admin_delete_custom_role(p_id uuid)
returns void as $$
declare v_me profiles; v_name text;
begin
  v_me := current_profile();
  if v_me is null or v_me.role <> 'Lead' then raise exception 'Only Leads can manage roles.'; end if;
  select name into v_name from custom_roles where id = p_id;
  delete from custom_roles where id = p_id;
  insert into audit_trail (user_email, action, detail) values (v_me.email, 'Deleted custom role', coalesce(v_name, p_id::text));
end;
$$ language plpgsql security definer;

create or replace function admin_assign_custom_role(p_email text, p_custom_role_id uuid)
returns void as $$
declare v_me profiles; v_uid uuid;
begin
  v_me := current_profile();
  if v_me is null or not (v_me.role = 'Lead' or can_manage_users()) then raise exception 'You do not have permission to manage access.'; end if;
  select id into v_uid from profiles where lower(email) = lower(p_email);
  if v_uid is null then raise exception 'That person has not signed in yet — assign a custom role after their first sign-in.'; end if;
  update profiles set custom_role_id = p_custom_role_id where id = v_uid;
  insert into audit_trail (user_email, action, detail) values (v_me.email, 'Assigned custom role', p_email);
end;
$$ language plpgsql security definer;

-- People management RPCs now also allow anyone granted can_manage_users() —
-- previously hardcoded to Lead only.
create or replace function admin_upsert_user(
  p_old_email text, p_email text, p_name text, p_role text, p_all_clinics boolean, p_clinic_ids text[]
) returns void as $$
declare v_me profiles; v_uid uuid; v_cid text;
begin
  v_me := current_profile();
  if v_me is null or not (v_me.role = 'Lead' or can_manage_users()) then raise exception 'You do not have permission to manage access.'; end if;
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

create or replace function admin_deactivate_user(p_email text)
returns void as $$
declare v_me profiles;
begin
  v_me := current_profile();
  if v_me is null or not (v_me.role = 'Lead' or can_manage_users()) then raise exception 'You do not have permission to manage access.'; end if;
  if lower(p_email) = lower(v_me.email) then raise exception 'You cannot deactivate your own account.'; end if;

  update allowed_users set active = false where lower(email) = lower(p_email);
  update profiles set active = false where lower(email) = lower(p_email);
  insert into audit_trail (user_email, action, detail) values (v_me.email, 'Admin deactivated user', p_email);
end;
$$ language plpgsql security definer;

create or replace function admin_reactivate_user(p_email text)
returns void as $$
declare v_me profiles;
begin
  v_me := current_profile();
  if v_me is null or not (v_me.role = 'Lead' or can_manage_users()) then raise exception 'You do not have permission to manage access.'; end if;
  update allowed_users set active = true where lower(email) = lower(p_email);
  update profiles set active = true where lower(email) = lower(p_email);
  insert into audit_trail (user_email, action, detail) values (v_me.email, 'Admin reactivated user', p_email);
end;
$$ language plpgsql security definer;

-- True delete (not just deactivate). Always removes the allow-list entry and
-- clinic access grants — the actual access gate; if other tables still hold
-- a foreign key to their historical profile row (e.g. item edits), falls
-- back to deactivating that row rather than failing outright. Never touches
-- auth.users — that schema is shared across dev/staging/prod, so deleting it
-- would deprovision the person everywhere at once.
create or replace function admin_delete_user(p_email text)
returns void as $$
declare v_me profiles; v_uid uuid;
begin
  v_me := current_profile();
  if v_me is null or not (v_me.role = 'Lead' or can_manage_users()) then raise exception 'You do not have permission to manage access.'; end if;
  if lower(p_email) = lower(v_me.email) then raise exception 'You cannot delete your own account.'; end if;

  select id into v_uid from profiles where lower(email) = lower(p_email);

  delete from allowed_users where lower(email) = lower(p_email);

  if v_uid is not null then
    delete from user_clinic_access where user_id = v_uid;
    begin
      delete from profiles where id = v_uid;
    exception when foreign_key_violation then
      update profiles set active = false, custom_role_id = null where id = v_uid;
    end;
  end if;

  insert into audit_trail (user_email, action, detail) values (v_me.email, 'Deleted person', p_email);
end;
$$ language plpgsql security definer;

-- admin_list_users, extended with custom-role info and can_manage_users() access.
drop function if exists admin_list_users();
create or replace function admin_list_users()
returns table (
  email text, name text, role text, all_clinics boolean, active boolean,
  clinic_ids text[], has_signed_in boolean, custom_role_id uuid, custom_role_name text
) as $$
  select a.email, a.name, a.role, a.all_clinics, a.active,
         coalesce(
           (select array_agg(uca.clinic_id) from user_clinic_access uca
            join profiles p on p.id = uca.user_id where lower(p.email) = lower(a.email)),
           a.clinic_ids, '{}'
         ) as clinic_ids,
         exists (select 1 from profiles p where lower(p.email) = lower(a.email)) as has_signed_in,
         p2.custom_role_id,
         cr.name as custom_role_name
  from allowed_users a
  left join profiles p2 on lower(p2.email) = lower(a.email)
  left join custom_roles cr on cr.id = p2.custom_role_id
  where is_lead() or can_manage_users()
  order by a.active desc, a.name;
$$ language sql stable security definer;
