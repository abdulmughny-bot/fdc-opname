-- Item Master System: Standardized items for audits
-- Includes: Master data, approval workflow, pricing, access control

-- 1. ITEM MASTER TABLE (Source of truth)
create table item_master (
  id uuid primary key default gen_random_uuid(),
  sku text unique not null,
  name text not null,
  category text,
  unit text not null default 'Box',
  std_qty_per_location int,
  cost_price decimal(12,2),
  notes text,
  status text default 'Active' check (status in ('Active', 'Inactive', 'Discontinued')),
  created_at timestamp default now(),
  created_by uuid references profiles(id),
  updated_at timestamp default now(),
  updated_by uuid references profiles(id)
);

create index idx_item_master_sku on item_master(sku);
create index idx_item_master_category on item_master(category);
create index idx_item_master_status on item_master(status);

-- 2. ITEM APPROVAL WORKFLOW (Upload → Review → Approve/Reject)
create table item_approval (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references item_master(id) on delete cascade,
  status text default 'Pending' check (status in ('Pending', 'Approved', 'Rejected')),
  uploaded_by uuid not null references profiles(id),
  reviewed_by uuid references profiles(id),
  rejection_reason text,
  admin_notes text,
  created_at timestamp default now(),
  approved_at timestamp,
  constraint only_lead_can_approve check (
    -- This constraint will be enforced in RPC
    true
  )
);

create index idx_item_approval_status on item_approval(status);
create index idx_item_approval_item_id on item_approval(item_id);
create index idx_item_approval_uploaded_by on item_approval(uploaded_by);

-- 3. ITEM PRICING (Lead-only access)
create table item_pricing (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references item_master(id) on delete cascade,
  clinic_id uuid references clinics(id),
  cost_price decimal(12,2),
  selling_price decimal(12,2) not null,
  margin_pct decimal(5,2),
  effective_date date default today(),
  updated_by uuid not null references profiles(id),
  updated_at timestamp default now(),
  constraint price_must_be_positive check (selling_price > 0)
);

create index idx_item_pricing_item_id on item_pricing(item_id);
create index idx_item_pricing_clinic_id on item_pricing(clinic_id);
create index idx_item_pricing_effective_date on item_pricing(effective_date);

-- 4. ROLE-BASED ACCESS CONTROL
create table role_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in ('Lead', 'Auditor', 'Clinic Manager')),
  can_view_pricing boolean default false,
  can_approve_items boolean default false,
  can_edit_item_master boolean default false,
  can_manage_users boolean default false,
  accessible_clinic_ids uuid[] default array[]::uuid[],
  created_at timestamp default now(),
  updated_at timestamp default now(),
  unique(user_id, role)
);

create index idx_role_permissions_user_id on role_permissions(user_id);
create index idx_role_permissions_role on role_permissions(role);

-- 5. ITEM USAGE HISTORY (Track which items used in audits)
create table item_audit_usage (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references item_master(id),
  session_id uuid not null references sessions(id) on delete cascade,
  room_id uuid not null references rooms(id),
  qty_sistem int,
  qty_fisik int,
  variance int,
  variance_pct decimal(5,2),
  created_at timestamp default now()
);

create index idx_item_audit_usage_item_id on item_audit_usage(item_id);
create index idx_item_audit_usage_session_id on item_audit_usage(session_id);

-- RPC: Approve item (Lead only)
create or replace function approve_item(
  p_item_approval_id uuid,
  p_admin_notes text default null
)
returns void as $$
declare
  v_profile profiles;
  v_approval item_approval;
  v_item item_master;
begin
  v_profile := current_profile();

  -- Only Leads can approve
  if not exists (
    select 1 from role_permissions
    where user_id = v_profile.id and role = 'Lead' and can_approve_items = true
  ) then
    raise exception 'Only Leads can approve items';
  end if;

  select * into v_approval from item_approval where id = p_item_approval_id;
  select * into v_item from item_master where id = v_approval.item_id;

  update item_approval
  set
    status = 'Approved',
    reviewed_by = v_profile.id,
    admin_notes = p_admin_notes,
    approved_at = now()
  where id = p_item_approval_id;

  insert into audit_trail (user_email, action, detail)
  values (v_profile.email, 'Approved item', v_item.sku || ' - ' || v_item.name);
end;
$$ language plpgsql security definer;

-- RPC: Reject item (Lead only)
create or replace function reject_item(
  p_item_approval_id uuid,
  p_rejection_reason text,
  p_admin_notes text default null
)
returns void as $$
declare
  v_profile profiles;
  v_approval item_approval;
  v_item item_master;
begin
  v_profile := current_profile();

  -- Only Leads can reject
  if not exists (
    select 1 from role_permissions
    where user_id = v_profile.id and role = 'Lead' and can_approve_items = true
  ) then
    raise exception 'Only Leads can reject items';
  end if;

  select * into v_approval from item_approval where id = p_item_approval_id;
  select * into v_item from item_master where id = v_approval.item_id;

  update item_approval
  set
    status = 'Rejected',
    reviewed_by = v_profile.id,
    rejection_reason = p_rejection_reason,
    admin_notes = p_admin_notes
  where id = p_item_approval_id;

  insert into audit_trail (user_email, action, detail)
  values (v_profile.email, 'Rejected item', v_item.sku || ' - ' || v_item.name || ': ' || p_rejection_reason);
end;
$$ language plpgsql security definer;

-- RPC: Update item pricing (Lead only)
create or replace function update_item_pricing(
  p_item_id uuid,
  p_clinic_id uuid default null,
  p_selling_price decimal,
  p_cost_price decimal default null
)
returns void as $$
declare
  v_profile profiles;
  v_margin_pct decimal;
begin
  v_profile := current_profile();

  -- Only Leads can set pricing
  if not exists (
    select 1 from role_permissions
    where user_id = v_profile.id and role = 'Lead' and can_view_pricing = true
  ) then
    raise exception 'Only Leads can update item pricing';
  end if;

  -- Calculate margin if cost provided
  if p_cost_price is not null then
    v_margin_pct := round(((p_selling_price - p_cost_price) / p_cost_price * 100)::numeric, 2);
  else
    v_margin_pct := null;
  end if;

  insert into item_pricing (item_id, clinic_id, selling_price, cost_price, margin_pct, updated_by)
  values (p_item_id, p_clinic_id, p_selling_price, p_cost_price, v_margin_pct, v_profile.id)
  on conflict (item_id, clinic_id) do update
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

-- RPC: Get clinic rankings by ketersesuaian
create or replace function get_clinic_rankings(p_period_type text default 'month')
returns table (
  clinic_id uuid,
  clinic_name text,
  ketersesuaian_pct numeric,
  total_stations int,
  audited_stations int,
  last_audit_date timestamp,
  variance_value decimal,
  trend_direction text
) as $$
begin
  return query
  with current_period as (
    select
      s.clinic_id,
      c.name as clinic_name,
      avg(ds.ketersesuaian) as avg_ketersesuaian,
      count(distinct ds.room_id) as total_stations,
      count(distinct case when ds.status = 'Submitted' then ds.room_id end) as audited_stations,
      max(s.finished_at) as last_audit,
      sum(abs(dlog.qty_sistem - dlog.qty_fisik)) as total_variance
    from sessions s
    join clinics c on c.id = s.clinic_id
    left join dental_status ds on ds.session_id = s.id and ds.deleted_at is null
    left join dental_log_lines dlog on dlog.session_id = s.id and dlog.room_id = ds.room_id
    where s.status = 'Finished'
      and s.deleted_at is null
      and (p_period_type = 'month' and date_trunc('month', s.finished_at) = date_trunc('month', now())
           or p_period_type = 'quarter' and date_trunc('quarter', s.finished_at) = date_trunc('quarter', now())
           or p_period_type = 'year' and date_trunc('year', s.finished_at) = date_trunc('year', now()))
    group by s.clinic_id, c.name
  )
  select
    cp.clinic_id,
    cp.clinic_name,
    round(coalesce(cp.avg_ketersesuaian, 0)::numeric, 1),
    cp.total_stations,
    cp.audited_stations,
    cp.last_audit,
    cp.total_variance,
    case
      when cp.avg_ketersesuaian >= 90 then 'Excellent'
      when cp.avg_ketersesuaian >= 80 then 'Good'
      when cp.avg_ketersesuaian >= 70 then 'Fair'
      else 'Poor'
    end as trend_direction
  from current_period cp
  order by cp.avg_ketersesuaian desc;
end;
$$ language plpgsql security definer;

-- RPC: Get item variance analysis (financial impact)
create or replace function get_item_variance_analysis(p_period_days int default 30)
returns table (
  item_id uuid,
  sku text,
  item_name text,
  category text,
  total_sistem_qty int,
  total_fisik_qty int,
  variance_qty int,
  variance_pct numeric,
  cost_per_unit decimal,
  variance_value_rp decimal,
  most_affected_clinic text
) as $$
begin
  return query
  with variance_data as (
    select
      im.id,
      im.sku,
      im.name,
      im.category,
      im.cost_price,
      sum(iau.qty_sistem) as total_sistem,
      sum(iau.qty_fisik) as total_fisik,
      sum(iau.qty_sistem - iau.qty_fisik) as total_variance,
      c.name as clinic_name,
      dense_rank() over (partition by iau.item_id order by abs(sum(iau.qty_sistem - iau.qty_fisik)) desc) as clinic_rank
    from item_audit_usage iau
    join item_master im on im.id = iau.item_id
    join rooms r on r.id = iau.room_id
    join clinics c on c.id = r.clinic_id
    where iau.created_at >= now() - make_interval(days := p_period_days)
    group by im.id, im.sku, im.name, im.category, im.cost_price, c.name
  )
  select
    vd.id,
    vd.sku,
    vd.name,
    vd.category,
    coalesce(vd.total_sistem, 0),
    coalesce(vd.total_fisik, 0),
    coalesce(vd.total_variance, 0),
    round((coalesce(vd.total_variance, 0)::numeric / nullif(vd.total_sistem, 0) * 100)::numeric, 2),
    vd.cost_price,
    (coalesce(vd.total_variance, 0)::numeric * coalesce(vd.cost_price, 0))::decimal,
    vd.clinic_name
  from variance_data vd
  where vd.clinic_rank = 1
  order by abs((coalesce(vd.total_variance, 0)::numeric * coalesce(vd.cost_price, 0))) desc;
end;
$$ language plpgsql security definer;

-- Row-Level Security: item_pricing (only Leads can see prices)
alter table item_pricing enable row level security;

create policy item_pricing_lead_only on item_pricing
  for select
  using (
    exists (
      select 1 from role_permissions rp
      join profiles p on p.id = rp.user_id
      where p.id = auth.uid()
        and rp.role = 'Lead'
        and rp.can_view_pricing = true
    )
  );

create policy item_pricing_lead_insert on item_pricing
  for insert
  with check (
    exists (
      select 1 from role_permissions rp
      join profiles p on p.id = rp.user_id
      where p.id = auth.uid()
        and rp.role = 'Lead'
        and rp.can_view_pricing = true
    )
  );

create policy item_pricing_lead_update on item_pricing
  for update
  using (
    exists (
      select 1 from role_permissions rp
      join profiles p on p.id = rp.user_id
      where p.id = auth.uid()
        and rp.role = 'Lead'
        and rp.can_view_pricing = true
    )
  );

-- Insert initial role permissions for existing leads
insert into role_permissions (user_id, role, can_view_pricing, can_approve_items, can_edit_item_master, can_manage_users)
select distinct p.id, 'Lead', true, true, true, true
from profiles p
where p.role = 'Lead'
  and not exists (
    select 1 from role_permissions rp where rp.user_id = p.id and rp.role = 'Lead'
  );

insert into role_permissions (user_id, role, can_view_pricing, can_approve_items, can_edit_item_master)
select distinct p.id, 'Auditor', false, false, false
from profiles p
where p.role = 'Team'
  and not exists (
    select 1 from role_permissions rp where rp.user_id = p.id and rp.role = 'Auditor'
  );
