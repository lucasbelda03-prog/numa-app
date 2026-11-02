-- Nüma · 3/4 · Seguridad (RLS) y lógica de negocio
--
-- Reglas:
--  * Patrón habitual: promedio de los días 1–14 de monitoreo; rango = ±10 %.
--  * Alerta: un indicador queda a ±15 % o más de su patrón durante 3 días
--    consecutivos, en la misma dirección.

-- Alta de usuario: perfil + Plan Básico
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  insert into public.subscriptions (user_id, plan_code, status)
  values (new.id, 'basic', 'active');
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.owns_dog(p_dog uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.dogs d where d.id = p_dog and d.owner_id = (select auth.uid()));
$$;

alter table public.profiles      enable row level security;
alter table public.dogs          enable row level security;
alter table public.devices       enable row level security;
alter table public.daily_metrics enable row level security;
alter table public.baselines     enable row level security;
alter table public.alerts        enable row level security;
alter table public.reports       enable row level security;
alter table public.subscriptions enable row level security;
alter table public.ai_insights   enable row level security;
alter table public.ai_messages   enable row level security;
alter table public.demo_state    enable row level security;

create policy "Ver mi perfil" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "Editar mi perfil" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "Gestionar mis perros" on public.dogs for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "Gestionar mis collares" on public.devices for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()) and (dog_id is null or public.owns_dog(dog_id)));
create policy "Gestionar datos de mis perros" on public.daily_metrics for all to authenticated using (public.owns_dog(dog_id)) with check (public.owns_dog(dog_id));
create policy "Ver patrones de mis perros" on public.baselines for select to authenticated using (public.owns_dog(dog_id));
create policy "Reiniciar patrones de mis perros" on public.baselines for delete to authenticated using (public.owns_dog(dog_id));
create policy "Ver alertas de mis perros" on public.alerts for select to authenticated using (public.owns_dog(dog_id));
create policy "Actualizar alertas de mis perros" on public.alerts for update to authenticated using (public.owns_dog(dog_id)) with check (public.owns_dog(dog_id));
create policy "Reiniciar alertas de mis perros" on public.alerts for delete to authenticated using (public.owns_dog(dog_id));
create policy "Gestionar informes de mis perros" on public.reports for all to authenticated using (public.owns_dog(dog_id)) with check (public.owns_dog(dog_id));
create policy "Ver mis suscripciones" on public.subscriptions for select to authenticated using (user_id = (select auth.uid()));
create policy "Gestionar análisis de mis perros" on public.ai_insights for all to authenticated using (public.owns_dog(dog_id)) with check (public.owns_dog(dog_id));
create policy "Gestionar mi conversación" on public.ai_messages for all to authenticated using (user_id = (select auth.uid()) and public.owns_dog(dog_id)) with check (user_id = (select auth.uid()) and public.owns_dog(dog_id));
create policy "Gestionar simulación de mis perros" on public.demo_state for all to authenticated using (public.owns_dog(dog_id)) with check (public.owns_dog(dog_id));

-- Patrón habitual + detección de cambios sostenidos al día p_as_of
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
             'Cambio sostenido en ' || string_agg(lower(t.short_name), ' y ' order by c.ord),
             v_changes
      from jsonb_array_elements(v_changes) with ordinality as c(item, ord)
      join public.metric_types t on t.code = c.item ->> 'metric_code'
      returning id into v_alert_id;
    end if;
  end if;
  return jsonb_build_object('baseline_ready', true, 'new_alert_id', v_alert_id);
end;
$$;

-- Suscripciones
create or replace function public.start_premium_trial()
returns public.subscriptions language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_days smallint; v_sub public.subscriptions;
begin
  if v_uid is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  select trial_days into v_days from public.plans where code = 'premium';
  update public.subscriptions set status = 'canceled', canceled_at = now()
  where user_id = v_uid and status in ('trialing', 'active');
  insert into public.subscriptions (user_id, plan_code, status, trial_ends_at)
  values (v_uid, 'premium', 'trialing', now() + make_interval(days => v_days))
  returning * into v_sub;
  return v_sub;
end;
$$;

create or replace function public.cancel_premium()
returns public.subscriptions language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_sub public.subscriptions;
begin
  if v_uid is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  update public.subscriptions set status = 'canceled', canceled_at = now()
  where user_id = v_uid and status in ('trialing', 'active');
  insert into public.subscriptions (user_id, plan_code, status)
  values (v_uid, 'basic', 'active')
  returning * into v_sub;
  return v_sub;
end;
$$;
