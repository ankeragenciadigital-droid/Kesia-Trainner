-- ============================================================
-- CORREÇÃO: Trigger que cria o perfil automaticamente no signup
-- Execute no SQL Editor do Supabase
-- ============================================================

-- Função que lê os metadados do usuário e insere em profiles
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (
    id,
    role,
    name,
    age,
    weight,
    body_fat,
    trainer_id
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'student'),
    coalesce(new.raw_user_meta_data->>'name', 'Sem nome'),
    nullif(new.raw_user_meta_data->>'age', '')::int,
    nullif(new.raw_user_meta_data->>'weight', '')::numeric,
    nullif(new.raw_user_meta_data->>'body_fat', '')::numeric,
    nullif(new.raw_user_meta_data->>'trainer_id', '')::uuid
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger: dispara após cada novo usuário no auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
