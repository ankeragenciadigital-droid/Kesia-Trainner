-- ============================================================
-- ADICIONAR: Tabelas de planos de treino
-- Execute no SQL Editor do Supabase
-- ============================================================

create table public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.workout_plans(id) on delete cascade,
  name text not null,
  sets int,
  reps text,
  rest_seconds int,
  notes text,
  position int not null default 0
);

create trigger trg_plans_updated_at
before update on public.workout_plans
for each row execute function public.set_updated_at();

alter table public.workout_plans enable row level security;
alter table public.workout_exercises enable row level security;

-- Treinadora gerencia seus planos
create policy "plans_trainer_all"
on public.workout_plans for all
using (public.is_trainer() and trainer_id = auth.uid())
with check (public.is_trainer() and trainer_id = auth.uid());

-- Aluno vê seus planos
create policy "plans_student_select"
on public.workout_plans for select
using (student_id = auth.uid());

-- Exercícios: visível para quem pode ver o plano
create policy "exercises_trainer_all"
on public.workout_exercises for all
using (
  exists (
    select 1 from public.workout_plans p
    where p.id = workout_exercises.plan_id
      and p.trainer_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.workout_plans p
    where p.id = workout_exercises.plan_id
      and p.trainer_id = auth.uid()
  )
);

create policy "exercises_student_select"
on public.workout_exercises for select
using (
  exists (
    select 1 from public.workout_plans p
    where p.id = workout_exercises.plan_id
      and p.student_id = auth.uid()
  )
);
