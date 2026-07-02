-- Execute no SQL Editor do Supabase
create table if not exists public.water_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  amount_ml int not null default 250,
  logged_at timestamptz not null default now()
);

create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid references public.workout_plans(id) on delete set null,
  plan_title text,
  completed_at timestamptz not null default now()
);

alter table public.water_logs enable row level security;
alter table public.workout_sessions enable row level security;

create policy "water_own" on public.water_logs for all using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "water_trainer" on public.water_logs for select using (public.is_trainer() and exists (select 1 from public.profiles p where p.id = water_logs.student_id and p.trainer_id = auth.uid()));

create policy "sessions_own" on public.workout_sessions for all using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "sessions_trainer" on public.workout_sessions for select using (public.is_trainer() and exists (select 1 from public.profiles p where p.id = workout_sessions.student_id and p.trainer_id = auth.uid()));
