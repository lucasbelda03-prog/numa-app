-- Nüma · 1/4 · Tipos y catálogos
--
-- Modelo de datos (resumen):
--  auth.users ─1:1─ profiles ─1:N─ dogs ─1:1─ devices
--                       │            ├─1:N─ daily_metrics ─N:1─ metric_types
--                       │            ├─1:N─ baselines     ─N:1─ metric_types
--                       │            ├─1:N─ alerts / reports / ai_insights / ai_messages
--                       │            └─1:1─ demo_state   (solo simulación)
--                       └─1:N─ subscriptions ─N:1─ plans

create type public.dog_sex             as enum ('female', 'male');
create type public.alert_status        as enum ('new', 'seen', 'watching', 'resolved');
create type public.alert_severity      as enum ('attention', 'change');
create type public.subscription_status as enum ('trialing', 'active', 'canceled');
create type public.ai_role             as enum ('user', 'assistant');

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.metric_types (
  code              text primary key check (code ~ '^[a-z_]+$'),
  name              text     not null,
  short_name        text     not null,
  unit              text     not null,
  decimals          smallint not null default 0 check (decimals between 0 and 2),
  is_physiological  boolean  not null default false,
  sort_order        smallint not null
);
comment on table public.metric_types is 'Catálogo de indicadores que registra el collar.';

insert into public.metric_types (code, name, short_name, unit, decimals, is_physiological, sort_order) values
  ('activity_minutes',    'Actividad',                         'Actividad',    'min activos',          0, false, 1),
  ('feeding_minutes',     'Alimentación',                      'Alimentación', 'min comiendo',         1, false, 2),
  ('rest_quality_pct',    'Calidad del descanso',              'Descanso',     '% sin interrupciones', 0, false, 3),
  ('sleep_hours',         'Sueño',                             'Sueño',        'h por día',            1, false, 4),
  ('resting_heart_rate',  'Frecuencia cardíaca en reposo',     'FC en reposo', 'lpm',                  0, true,  5),
  ('resting_resp_rate',   'Frecuencia respiratoria en reposo', 'Respiración',  'resp/min',             0, true,  6),
  ('drinking_events',     'Hidratación',                       'Hidratación',  'veces que tomó agua',  0, false, 7),
  ('scratching_episodes', 'Rascado',                           'Rascado',      'episodios',            0, false, 8);

create table public.plans (
  code             text primary key check (code ~ '^[a-z_]+$'),
  name             text         not null,
  price_usd_month  numeric(6,2) not null check (price_usd_month >= 0),
  trial_days       smallint     not null default 0 check (trial_days >= 0),
  features         jsonb        not null default '[]'::jsonb,
  sort_order       smallint     not null
);
comment on table public.plans is 'Planes de suscripción de la app.';

insert into public.plans (code, name, price_usd_month, trial_days, features, sort_order) values
  ('basic', 'Básico', 0, 0,
   '["Seguimiento de los 8 indicadores","Índice de bienestar y tendencias","Alertas ante cambios sostenidos","Informe para el veterinario"]', 1),
  ('premium', 'Premium', 7, 90,
   '["Todo lo del Plan Básico","Análisis con IA de los datos de tu perro","Asistente para hacer preguntas","Ración orientativa y recomendaciones de cuidado"]', 2);

alter table public.metric_types enable row level security;
alter table public.plans        enable row level security;
create policy "Catálogo de indicadores visible" on public.metric_types for select to anon, authenticated using (true);
create policy "Catálogo de planes visible" on public.plans for select to anon, authenticated using (true);
