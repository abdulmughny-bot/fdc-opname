-- ============================================================================
-- FDC Stock Opname — Admin patch  (run AFTER schema_v4.sql)
-- Adds soft-deactivation to allowed_users and the Lead-only management
-- functions the admin page calls. Idempotent where practical.
-- ============================================================================

-- 1) soft-deactivation flag on the allow-list
alter table allowed_users add column if not exists active boolean not null default true;
alter table profiles      add column if not exists active boolean not null default true;

-- 2) provisioning must respect the active flag: a deactivated email must not
--    get (or keep) a working profile, even if its auth.users row still exists.
-- Overrides provision_self() from 0001_schema.sql — schema-scoped, called by
-- the client right after sign-in (see the note in 0001_schema.sql).
create or replace function provision_self()
returns void as $$
declare v_allowed allowed_users; v_email text;
begin
  v_email := (select email from auth.users where id = auth.uid());
  if v_email is null then raise exception 'Not authenticated.'; end if;
  select * into v_allowed from allowed_users where lower(email) = lower(v_email) and active = true;
  if v_allowed.email is not null then
    insert into profiles (id, email, name, role, all_clinics, active)
    values (auth.uid(), v_email, v_allowed.name, v_allowed.role, v_allowed.all_clinics, true)
    on conflict (id) do update set active = true, role = excluded.role, all_clinics = excluded.all_clinics;
  end if;
end;
$$ language plpgsql security definer;

-- is_provisioned must also require active = true
create or replace function is_provisioned() returns boolean as $$
  select exists (select 1 from profiles where id = auth.uid() and active = true);
$$ language sql stable security definer;

-- relink_allowed_users() (0001_schema.sql) had no role check at all, and
-- ignored the active flag entirely — either gap would let it re-provision a
-- profile for someone who was deactivated. Bring it in line with the other
-- admin_* functions: Lead-only, active allow-list rows only.
create or replace function relink_allowed_users()
returns void as $$
declare v_me profiles;
begin
  v_me := current_profile();
  if v_me is null or v_me.role <> 'Lead' then raise exception 'Only Leads can relink users.'; end if;
  insert into profiles (id, email, name, role, all_clinics, active)
  select u.id, u.email, a.name, a.role, a.all_clinics, true
  from auth.users u join allowed_users a on lower(a.email) = lower(u.email)
  where a.active = true
  on conflict (id) do nothing;
end;
$$ language plpgsql security definer;

-- convenience: is the current user a Lead?
create or replace function is_lead() returns boolean as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'Lead' and active = true);
$$ language sql stable security definer;

-- ============================================================================
-- ADMIN FUNCTIONS  (all Lead-only, enforced server-side)
-- ============================================================================

-- Add or update a person on the allow-list + reflect onto any existing profile.
-- p_clinic_ids is ignored when p_all_clinics = true.
create or replace function admin_upsert_user(
  p_email text, p_name text, p_role text, p_all_clinics boolean, p_clinic_ids text[]
) returns void as $$
declare v_me profiles; v_uid uuid; v_cid text;
begin
  v_me := current_profile();
  if v_me is null or v_me.role <> 'Lead' then raise exception 'Only Leads can manage access.'; end if;
  if p_role not in ('Lead','Team') then raise exception 'Role must be Lead or Team.'; end if;
  if lower(p_email) = lower(v_me.email) and p_role <> 'Lead' then
    raise exception 'You cannot remove your own Lead role.';
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

-- Deactivate (soft). Cannot deactivate yourself (anti-lockout).
create or replace function admin_deactivate_user(p_email text)
returns void as $$
declare v_me profiles;
begin
  v_me := current_profile();
  if v_me is null or v_me.role <> 'Lead' then raise exception 'Only Leads can manage access.'; end if;
  if lower(p_email) = lower(v_me.email) then raise exception 'You cannot deactivate your own account.'; end if;

  update allowed_users set active = false where lower(email) = lower(p_email);
  update profiles set active = false where lower(email) = lower(p_email);
  insert into audit_trail (user_email, action, detail) values (v_me.email, 'Admin deactivated user', p_email);
end;
$$ language plpgsql security definer;

-- Reactivate a previously-deactivated person.
create or replace function admin_reactivate_user(p_email text)
returns void as $$
declare v_me profiles;
begin
  v_me := current_profile();
  if v_me is null or v_me.role <> 'Lead' then raise exception 'Only Leads can manage access.'; end if;
  update allowed_users set active = true where lower(email) = lower(p_email);
  update profiles set active = true where lower(email) = lower(p_email);
  insert into audit_trail (user_email, action, detail) values (v_me.email, 'Admin reactivated user', p_email);
end;
$$ language plpgsql security definer;

-- Prevent a Lead from removing their own Lead role (anti-lockout).
-- (admin_upsert_user already handles role changes; this guards the self-demote case.)
create or replace function admin_set_role(p_email text, p_role text)
returns void as $$
declare v_me profiles;
begin
  v_me := current_profile();
  if v_me is null or v_me.role <> 'Lead' then raise exception 'Only Leads can manage access.'; end if;
  if lower(p_email) = lower(v_me.email) and p_role <> 'Lead' then
    raise exception 'You cannot remove your own Lead role.';
  end if;
  update allowed_users set role = p_role where lower(email) = lower(p_email);
  update profiles set role = p_role where lower(email) = lower(p_email);
  insert into audit_trail (user_email, action, detail) values (v_me.email, 'Admin set role', p_email || ' -> ' || p_role);
end;
$$ language plpgsql security definer;

-- Clinic recipients management
create or replace function admin_add_recipient(p_clinic_id text, p_email text, p_label text)
returns void as $$
declare v_me profiles;
begin
  v_me := current_profile();
  if v_me is null or v_me.role <> 'Lead' then raise exception 'Only Leads can manage recipients.'; end if;
  insert into clinic_recipients (clinic_id, email, label) values (p_clinic_id, lower(p_email), p_label)
  on conflict (clinic_id, email) do update set label = excluded.label;
  insert into audit_trail (user_email, action, detail) values (v_me.email, 'Admin add recipient', p_clinic_id || ' ' || p_email);
end;
$$ language plpgsql security definer;

create or replace function admin_remove_recipient(p_clinic_id text, p_email text)
returns void as $$
declare v_me profiles;
begin
  v_me := current_profile();
  if v_me is null or v_me.role <> 'Lead' then raise exception 'Only Leads can manage recipients.'; end if;
  delete from clinic_recipients where clinic_id = p_clinic_id and lower(email) = lower(p_email);
  insert into audit_trail (user_email, action, detail) values (v_me.email, 'Admin remove recipient', p_clinic_id || ' ' || p_email);
end;
$$ language plpgsql security definer;

-- Email template
create or replace function admin_save_email_template(p_subject text, p_body text)
returns void as $$
declare v_me profiles;
begin
  v_me := current_profile();
  if v_me is null or v_me.role <> 'Lead' then raise exception 'Only Leads can edit the email template.'; end if;
  update email_settings set subject_template = p_subject, body_template = p_body, updated_by = v_me.name, updated_at = now() where id = 1;
  insert into audit_trail (user_email, action, detail) values (v_me.email, 'Admin saved email template', '');
end;
$$ language plpgsql security definer;

-- Read-side helper for the admin page: everyone on the allow-list with their
-- live scope. Lead-only.
create or replace function admin_list_users()
returns table (email text, name text, role text, all_clinics boolean, active boolean, clinic_ids text[], has_signed_in boolean) as $$
  select a.email, a.name, a.role, a.all_clinics, a.active,
         coalesce((select array_agg(uca.clinic_id) from user_clinic_access uca
                   join profiles p on p.id = uca.user_id where lower(p.email) = lower(a.email)), '{}') as clinic_ids,
         exists (select 1 from profiles p where lower(p.email) = lower(a.email)) as has_signed_in
  from allowed_users a
  where is_lead()
  order by a.active desc, a.name;
$$ language sql stable security definer;
