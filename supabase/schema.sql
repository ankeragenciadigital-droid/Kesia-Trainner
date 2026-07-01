-- ============================================================
-- KT Kesia Trainner — Schema + Row Level Security (RLS)
-- Execute este arquivo inteiro no SQL Editor do seu projeto Supabase.
-- ============================================================

-- Extensão para gen_random_uuid()
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- TABELA: profiles
-- Um registro por usuário autenticado (treinadora OU aluno).
-- O id é o MESMO id do auth.users (1 para 1).
-- ------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('trainer', 'student')),
  name text not null,
  age int check (age between 5 and 120),
  weight numeric(5,2) check (weight > 0),          -- kg
  body_fat numeric(4,1) check (body_fat between 0 and 100), -- %
  goal_weight numeric(5,2),                         -- meta de peso (kg)
  goal_body_fat numeric(4,1),                       -- meta de % gordura
  trainer_id uuid references public.profiles(id) on delete set null, -- aluno aponta para a treinadora
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- TABELA: measurements
-- Histórico de medições do aluno (para gráfico de evolução)
-- ------------------------------------------------------------
create table public.measurements (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  weight numeric(5,2) not null,
  body_fat numeric(4,1) not null,
  recorded_at timestamptz not null default now(),
  recorded_by uuid not null references public.profiles(id)
);

-- ------------------------------------------------------------
-- TABELA: workout_videos
-- Vídeos ilustrativos de treino, armazenados no Supabase Storage.
-- student_id = NULL  -> vídeo "geral" visível a todos os alunos da treinadora
-- student_id = <uuid> -> vídeo específico para um aluno
-- ------------------------------------------------------------
create table public.workout_videos (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  storage_path text not null,   -- caminho dentro do bucket 'workout-videos'
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Trigger: manter updated_at sempre atualizado
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Função auxiliar: retorna true se o usuário logado é treinador(a)
-- SECURITY DEFINER evita recursão infinita nas policies de profiles
-- ------------------------------------------------------------
create or replace function public.is_trainer()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'trainer'
  );
$$ language sql security definer stable;

-- Função auxiliar: retorna o trainer_id do aluno logado (ou null)
create or replace function public.my_trainer_id()
returns uuid as $$
  select trainer_id from public.profiles where id = auth.uid();
$$ language sql security definer stable;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.measurements enable row level security;
alter table public.workout_videos enable row level security;

-- ---------- PROFILES ----------
-- Qualquer usuário autenticado pode ver o PRÓPRIO perfil
create policy "profiles_select_own"
on public.profiles for select
using (id = auth.uid());

-- Treinadora pode ver perfis dos alunos vinculados a ela
create policy "profiles_select_trainer_sees_students"
on public.profiles for select
using (public.is_trainer() and trainer_id = auth.uid());

-- Usuário pode inserir SOMENTE seu próprio perfil (criado no signup)
create policy "profiles_insert_own"
on public.profiles for insert
with check (id = auth.uid());

-- Aluno pode atualizar apenas campos do próprio perfil (linha)
create policy "profiles_update_own"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

-- Treinadora pode atualizar perfis dos seus alunos (ex: definir metas)
create policy "profiles_update_trainer_students"
on public.profiles for update
using (public.is_trainer() and trainer_id = auth.uid())
with check (public.is_trainer() and trainer_id = auth.uid());

-- ---------- MEASUREMENTS ----------
create policy "measurements_select_own"
on public.measurements for select
using (student_id = auth.uid());

create policy "measurements_select_trainer"
on public.measurements for select
using (
  public.is_trainer()
  and exists (
    select 1 from public.profiles p
    where p.id = measurements.student_id and p.trainer_id = auth.uid()
  )
);

create policy "measurements_insert_own"
on public.measurements for insert
with check (student_id = auth.uid() and recorded_by = auth.uid());

create policy "measurements_insert_trainer"
on public.measurements for insert
with check (
  public.is_trainer()
  and recorded_by = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = measurements.student_id and p.trainer_id = auth.uid()
  )
);

-- ---------- WORKOUT VIDEOS ----------
-- Aluno vê vídeos gerais da sua treinadora + vídeos endereçados a ele
create policy "videos_select_student"
on public.workout_videos for select
using (
  student_id = auth.uid()
  or (student_id is null and trainer_id = public.my_trainer_id())
);

-- Treinadora vê e gerencia os próprios vídeos
create policy "videos_select_trainer"
on public.workout_videos for select
using (public.is_trainer() and trainer_id = auth.uid());

create policy "videos_insert_trainer"
on public.workout_videos for insert
with check (public.is_trainer() and trainer_id = auth.uid());

create policy "videos_update_trainer"
on public.workout_videos for update
using (public.is_trainer() and trainer_id = auth.uid())
with check (public.is_trainer() and trainer_id = auth.uid());

create policy "videos_delete_trainer"
on public.workout_videos for delete
using (public.is_trainer() and trainer_id = auth.uid());

-- ============================================================
-- STORAGE: bucket de vídeos (privado)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('workout-videos', 'workout-videos', false)
on conflict (id) do nothing;

-- Treinadora pode subir/gerenciar arquivos dentro de uma pasta com o seu próprio uid
create policy "storage_trainer_upload"
on storage.objects for insert
with check (
  bucket_id = 'workout-videos'
  and public.is_trainer()
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "storage_trainer_manage"
on storage.objects for all
using (
  bucket_id = 'workout-videos'
  and public.is_trainer()
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'workout-videos'
  and public.is_trainer()
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Aluno pode ler (download/stream) vídeos cuja referência exista em workout_videos
-- e que ele tenha permissão de ver (reaproveita a policy de workout_videos via join)
create policy "storage_student_read"
on storage.objects for select
using (
  bucket_id = 'workout-videos'
  and exists (
    select 1 from public.workout_videos v
    where v.storage_path = storage.objects.name
      and (
        v.student_id = auth.uid()
        or (v.student_id is null and v.trainer_id = public.my_trainer_id())
      )
  )
);

-- ============================================================
-- Pronto. Nenhuma tabela é acessível sem login (RLS bloqueia tudo
-- por padrão; só as policies acima abrem exceções específicas).
-- A "anon key" do Supabase é pública por design — quem protege os
-- dados é o RLS, não o sigilo da chave.
-- ============================================================
