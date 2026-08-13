-- Variance financial-impact figures were valuing missing/extra stock at cost
-- price (what the clinic paid) instead of selling price (what it's worth) —
-- and get_clinic_rankings' "variance" wasn't converted to Rupiah at all, it
-- was a raw quantity difference mislabeled as money in the UI. Both now use
-- selling price (item_pricing, global row where clinic_id is null).
--
-- get_clinic_rankings also now ranks clinics by a composite of Ketersesuaian
-- rank + variance-value rank (lower Rp loss = better), rather than
-- Ketersesuaian alone — both numbers are still returned/displayed as before.

drop function if exists get_item_variance_analysis(int);

create or replace function get_item_variance_analysis(p_period_days int default 30)
returns table (
  item_id uuid,
  sku text,
  item_name text,
  category text,
  total_sistem_qty numeric,
  total_fisik_qty numeric,
  variance_qty numeric,
  variance_pct numeric,
  price_per_unit decimal,
  variance_value_rp decimal,
  most_affected_clinic text
) as $$
begin
  return query
  with scored_lines as (
    select
      im.id as item_id,
      im.sku,
      im.name as item_name,
      im.category,
      ip.selling_price as price_per_unit,
      c.name as clinic_name,
      dlog.qty_sistem,
      dlog.qty_fisik
    from dental_log_lines dlog
    join sessions s on s.id = dlog.session_id and s.deleted_at is null
    join rooms r on r.id = dlog.room_id
    join clinics c on c.id = r.clinic_id
    join item_master im on im.sku = dlog.barang_sku
    left join item_pricing ip on ip.item_id = im.id and ip.clinic_id is null
    where dlog.qty_sistem is not null
      and dlog.qty_fisik is not null
      and s.started_at >= now() - make_interval(days := p_period_days)
  ),
  totals as (
    select
      sl.item_id, sl.sku, sl.item_name, sl.category, sl.price_per_unit,
      sum(sl.qty_sistem) as total_sistem,
      sum(sl.qty_fisik) as total_fisik,
      sum(sl.qty_sistem - sl.qty_fisik) as total_variance
    from scored_lines sl
    group by sl.item_id, sl.sku, sl.item_name, sl.category, sl.price_per_unit
  ),
  by_clinic as (
    select
      sl.item_id,
      sl.clinic_name,
      dense_rank() over (
        partition by sl.item_id
        order by abs(sum(sl.qty_sistem - sl.qty_fisik)) desc
      ) as clinic_rank
    from scored_lines sl
    group by sl.item_id, sl.clinic_name
  )
  select
    t.item_id,
    t.sku,
    t.item_name,
    t.category,
    coalesce(t.total_sistem, 0),
    coalesce(t.total_fisik, 0),
    coalesce(t.total_variance, 0),
    round((coalesce(t.total_variance, 0) / nullif(t.total_sistem, 0) * 100)::numeric, 2),
    t.price_per_unit,
    (coalesce(t.total_variance, 0) * coalesce(t.price_per_unit, 0))::decimal,
    bc.clinic_name
  from totals t
  left join by_clinic bc on bc.item_id = t.item_id and bc.clinic_rank = 1
  order by abs(coalesce(t.total_variance, 0) * coalesce(t.price_per_unit, 0)) desc;
end;
$$ language plpgsql security definer;

-- get_clinic_rankings: same return shape (variance_value stays the column
-- name), only the calculation and the final ordering change.
create or replace function get_clinic_rankings(p_period_type text default 'month')
returns table (
  clinic_id text,
  clinic_name text,
  ketersesuaian_pct numeric,
  total_stations int,
  audited_stations int,
  last_audit_date timestamptz,
  variance_value decimal,
  trend_direction text
) as $$
begin
  return query
  with finished_sessions as (
    select s.id, s.clinic_id, c.name as clinic_name, s.finished_at
    from sessions s
    join clinics c on c.id = s.clinic_id
    where s.status = 'Finished'
      and s.deleted_at is null
      and (p_period_type = 'month' and date_trunc('month', s.finished_at) = date_trunc('month', now())
           or p_period_type = 'quarter' and date_trunc('quarter', s.finished_at) = date_trunc('quarter', now())
           or p_period_type = 'year' and date_trunc('year', s.finished_at) = date_trunc('year', now()))
  ),
  station_stats as (
    select
      fs.clinic_id,
      fs.clinic_name,
      fs.finished_at,
      ds.room_id,
      ds.ketersesuaian,
      ds.status
    from finished_sessions fs
    join dental_status ds on ds.session_id = fs.id and ds.deleted_at is null
  ),
  variance_stats as (
    select
      fs.clinic_id,
      sum(abs(dlog.qty_sistem - dlog.qty_fisik) * coalesce(ip.selling_price, 0)) as total_variance_rp
    from finished_sessions fs
    join dental_log_lines dlog on dlog.session_id = fs.id
    join item_master im on im.sku = dlog.barang_sku
    left join item_pricing ip on ip.item_id = im.id and ip.clinic_id is null
    where dlog.qty_sistem is not null and dlog.qty_fisik is not null
    group by fs.clinic_id
  ),
  clinic_summary as (
    select
      ss.clinic_id,
      ss.clinic_name,
      avg(ss.ketersesuaian) as avg_ketersesuaian,
      count(distinct ss.room_id) as total_stations,
      count(distinct case when ss.status = 'Submitted' then ss.room_id end) as audited_stations,
      max(ss.finished_at) as last_audit
    from station_stats ss
    group by ss.clinic_id, ss.clinic_name
  ),
  ranked as (
    select
      cs.*,
      coalesce(vs.total_variance_rp, 0) as variance_value,
      rank() over (order by cs.avg_ketersesuaian desc) as rank_keter,
      rank() over (order by coalesce(vs.total_variance_rp, 0) asc) as rank_variance
    from clinic_summary cs
    left join variance_stats vs on vs.clinic_id = cs.clinic_id
  )
  select
    r.clinic_id,
    r.clinic_name,
    round(coalesce(r.avg_ketersesuaian, 0)::numeric, 1),
    r.total_stations::int,
    r.audited_stations::int,
    r.last_audit,
    r.variance_value,
    case
      when r.avg_ketersesuaian >= 90 then 'Excellent'
      when r.avg_ketersesuaian >= 80 then 'Good'
      when r.avg_ketersesuaian >= 70 then 'Fair'
      else 'Poor'
    end as trend_direction
  from ranked r
  order by (r.rank_keter + r.rank_variance) asc;
end;
$$ language plpgsql security definer;
