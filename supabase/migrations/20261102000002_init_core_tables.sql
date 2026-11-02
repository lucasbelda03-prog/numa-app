-- Nüma · 2/4 · Tablas principales

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text        not null default '' check (char_length(full_name) <= 120),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.profiles is 'Datos públicos del dueño; 1:1 con auth.users.';
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.dogs (
  id                     uuid primary key default gen_random_uuid(),
  owner_id               uuid not null references public.profiles (id) on delete cascade,
  name                   text not null check (char_length(name) between 1 and 60),
  breed                  text check (char_length(breed) <= 80),
  birth_date             date check (birth_date > date '1990-01-01'),
  weight_kg              numeric(5,2) check (weight_kg > 0 and weight_kg < 150),
  sex                    public.dog_sex,
  neutered               boolean,
  known_conditions       text check (char_length(known_conditions) <= 500),
  monitoring_started_on  date,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index dogs_owner_id_idx on public.dogs (owner_id);
create trigger dogs_set_updated_at before update on public.dogs
  for each row execute function public.set_updated_at();

create table public.devices (
  id                uuid primary key default gen_random_uuid(),
  serial            text not null unique
                    default ('NM-' || upper(substr(md5(gen_random_uuid()::text), 1, 6))),
  owner_id          uuid not null references public.profiles (id) on delete cascade,
  dog_id            uuid unique references public.dogs (id) on delete set null,
  firmware_version  text not null default '1.0.0',
  battery_pct       smallint not null default 100 check (battery_pct between 0 and 100),
  paired_at         timestamptz,
  last_sync_at      timestamptz,
  created_at        timestamptz not null default now()
);
create index devices_owner_id_idx on public.devices (owner_id);
comment on table public.devices is 'Collares Nüma. Un collar se vincula a un solo perro.';

create table public.daily_metrics (
  dog_id       uuid not null references public.dogs (id) on delete cascade,
  metric_code  text not null references public.metric_types (code),
  day          date not null,
  value        numeric(8,2) not null check (value >= 0),
  source       text not null default 'collar' check (source in ('collar', 'simulation', 'manual')),
  recorded_at  timestamptz not null default now(),
  primary key (dog_id, metric_code, day)
);
create index daily_metrics_dog_day_idx on public.daily_metrics (dog_id, day);
create index daily_metrics_metric_code_idx on public.daily_metrics (metric_code);
comment on table public.daily_metrics is 'Un valor agregado por perro, indicador y día (formato largo).';

create table public.baselines (
  dog_id        uuid not null references public.dogs (id) on delete cascade,
  metric_code   text not null references public.metric_types (code),
  mean_value    numeric(8,2) not null,
  stddev_value  numeric(8,2),
  lower_bound   numeric(8,2) not null,
  upper_bound   numeric(8,2) not null,
  window_start  date not null,
  window_end    date not null,
  sample_days   smallint not null check (sample_days > 0),
  computed_at   timestamptz not null default now(),
  primary key (dog_id, metric_code),
  check (lower_bound <= upper_bound),
  check (window_start <= window_end)
);
create index baselines_metric_code_idx on public.baselines (metric_code);
comment on table public.baselines is 'Patrón habitual individual de cada perro por indicador.';

create table public.alerts (
  id            uuid primary key default gen_random_uuid(),
  dog_id        uuid not null references public.dogs (id) on delete cascade,
  severity      public.alert_severity not null default 'change',
  status        public.alert_status   not null default 'new',
  window_start  date not null,
  window_end    date not null,
  title         text not null,
  changes       jsonb not null default '[]'::jsonb check (jsonb_typeof(changes) = 'array'),
  created_at    timestamptz not null default now(),
  seen_at       timestamptz,
  resolved_at   timestamptz,
  unique (dog_id, window_end),
  check (window_start <= window_end)
);
create index alerts_dog_created_idx on public.alerts (dog_id, created_at desc);
comment on column public.alerts.changes is '[{metric_code, baseline, recent, pct}] ordenado por magnitud.';

create table public.reports (
  id            uuid primary key default gen_random_uuid(),
  dog_id        uuid not null references public.dogs (id) on delete cascade,
  period_days   smallint not null check (period_days in (30, 60, 90)),
  date_from     date not null,
  date_to       date not null,
  owner_notes   text check (char_length(owner_notes) <= 2000),
  snapshot      jsonb not null,
  created_at    timestamptz not null default now(),
  check (date_from <= date_to)
);
create index reports_dog_created_idx on public.reports (dog_id, created_at desc);
comment on column public.reports.snapshot is 'Copia de los datos al momento de generar el informe.';

create table public.subscriptions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  plan_code      text not null references public.plans (code),
  status         public.subscription_status not null,
  started_at     timestamptz not null default now(),
  trial_ends_at  timestamptz,
  canceled_at    timestamptz,
  created_at     timestamptz not null default now()
);
create unique index subscriptions_one_open_per_user
  on public.subscriptions (user_id) where status in ('trialing', 'active');
create index subscriptions_user_idx on public.subscriptions (user_id, created_at desc);
create index subscriptions_plan_code_idx on public.subscriptions (plan_code);

create table public.ai_insights (
  id          uuid primary key default gen_random_uuid(),
  dog_id      uuid not null references public.dogs (id) on delete cascade,
  as_of       date not null,
  content     text not null,
  model       text,
  created_at  timestamptz not null default now()
);
create index ai_insights_dog_created_idx on public.ai_insights (dog_id, created_at desc);

create table public.ai_messages (
  id          uuid primary key default gen_random_uuid(),
  dog_id      uuid not null references public.dogs (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        public.ai_role not null,
  content     text not null check (char_length(content) between 1 and 6000),
  created_at  timestamptz not null default now()
);
create index ai_messages_dog_created_idx on public.ai_messages (dog_id, created_at);
create index ai_messages_user_idx on public.ai_messages (user_id);

create table public.demo_state (
  dog_id       uuid primary key references public.dogs (id) on delete cascade,
  current_day  smallint not null default 1 check (current_day between 1 and 90),
  updated_at   timestamptz not null default now()
);
comment on table public.demo_state is 'Día simulado de monitoreo. Reemplaza al reloj real durante la demostración.';
