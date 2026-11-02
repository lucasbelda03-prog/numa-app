-- Nüma · El título de la alerta respeta el orden del catálogo (actividad antes que alimentación).
-- Reemplaza refresh_dog_analytics; la lógica de detección no cambia.

create or replace function public.refresh_dog_analytics(p_dog uuid, p_as_of date)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_start date; v_changes jsonb; v_alert_id uuid;
begin
  if not public.owns_dog(p_dog) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select monitoring_started_on into v_start from public.dogs where id = p_dog;
  if v_start is null or p_as_of < v_start + 13 then
    return jsonb_build_object('baseline_ready', false);
  end if;

  insert into public.baselines as b
    (dog_id, metric_code, mean_value, stddev_value, lower_bound, upper_bound, window_start, window_end, sample_days)
  select p_dog, m.metric_code, round(avg(m.value), 2), round(stddev_samp(m.value), 2),
         round(avg(m.value) * 0.90, 2), round(avg(m.value) * 1.10, 2), v_start, v_start + 13, count(*)
  from public.daily_metrics m
  where m.dog_id = p_dog and m.day between v_start and v_start + 13
  group by m.metric_code
  having count(*) >= 10
  on conflict (dog_id, metric_code) do update set
    mean_value = excluded.mean_value, stddev_value = excluded.stddev_value,
    lower_bound = excluded.lower_bound, upper_bound = excluded.upper_bound,
    window_start = excluded.window_start, window_end = excluded.window_end,
    sample_days = excluded.sample_days, computed_at = now();

  if p_as_of >= v_start + 16 then
    select coalesce(jsonb_agg(jsonb_build_object(
             'metric_code', x.metric_code, 'baseline', x.baseline, 'recent', x.recent, 'pct', x.pct)
             order by abs(x.pct) desc), '[]'::jsonb)
      into v_changes
    from (
      select b.metric_code, b.mean_value as baseline, round(avg(m.value), 2) as recent,
             round((avg(m.value) - b.mean_value) / nullif(b.mean_value, 0) * 100)::int as pct
      from public.baselines b
      join public.daily_metrics m
        on m.dog_id = b.dog_id and m.metric_code = b.metric_code and m.day between p_as_of - 2 and p_as_of
      where b.dog_id = p_dog
      group by b.metric_code, b.mean_value
      having count(*) = 3
         and (bool_and(m.value <= b.mean_value * 0.85) or bool_and(m.value >= b.mean_value * 1.15))
    ) x;

    if jsonb_array_length(v_changes) > 0 and not exists (
      select 1 from public.alerts a
      where a.dog_id = p_dog and a.status <> 'resolved' and a.window_end >= p_as_of - 2
    ) then
      insert into public.alerts (dog_id, window_start, window_end, title, changes)
      select p_dog, p_as_of - 2, p_as_of,
             'Cambio sostenido en ' || string_agg(lower(t.short_name), ' y ' order by t.sort_order),
             v_changes
      from jsonb_array_elements(v_changes) as c(item)
      join public.metric_types t on t.code = c.item ->> 'metric_code'
      returning id into v_alert_id;
    end if;
  end if;
  return jsonb_build_object('baseline_ready', true, 'new_alert_id', v_alert_id);
end;
$$;
