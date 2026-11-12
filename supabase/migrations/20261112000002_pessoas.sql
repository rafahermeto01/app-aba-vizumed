-- LovABA · 0002 · Pessoas: clínicas, perfis, aprendizes, CIDs, responsáveis,
-- equipe e consentimento. Também as funções-"crachá" usadas pelas regras (RLS).
-- ---------------------------------------------------------------------------

-- clinics --------------------------------------------------------------------
create table public.clinics (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null check (length(btrim(name)) > 0),
  logo_path          text,
  show_initials_only boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid default auth.uid(),
  deleted_at         timestamptz
);

-- profiles (um por usuário; id = auth.users.id) ------------------------------
create table public.profiles (
  id                   uuid primary key references auth.users (id) on delete restrict,
  clinic_id            uuid not null references public.clinics (id),
  full_name            text not null check (length(btrim(full_name)) > 0),
  email                text not null,
  photo_path           text,
  role                 public.user_role not null default 'aplicador',
  active               boolean not null default true,
  must_change_password boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  created_by           uuid default auth.uid(),
  deleted_at           timestamptz
);
create index profiles_clinic_idx on public.profiles (clinic_id);
create unique index profiles_email_uniq on public.profiles (lower(email));

-- Guarda o "hash" da senha provisória para provar que a pessoa realmente trocou.
create table private.provisional_passwords (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  password_hash text,
  set_at        timestamptz not null default now()
);

-- learners (aprendizes) ------------------------------------------------------
create table public.learners (
  id                  uuid primary key default gen_random_uuid(),
  clinic_id           uuid not null references public.clinics (id),
  full_name           text not null check (length(btrim(full_name)) > 0),
  initials            text not null default '' check (length(initials) <= 6),
  cpf                 text check (cpf is null or public.is_valid_cpf(cpf)),
  birth_date          date,
  photo_path          text,
  notes               text,
  active              boolean not null default true,
  last_session_number integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid default auth.uid(),
  deleted_at          timestamptz
);
create index learners_clinic_idx on public.learners (clinic_id);
create unique index learners_cpf_uniq on public.learners (clinic_id, cpf)
  where cpf is not null and deleted_at is null;

-- cid_codes ------------------------------------------------------------------
-- clinic_id vazio = código de referência, vale para todas as clínicas.
create table public.cid_codes (
  id          uuid primary key default gen_random_uuid(),
  clinic_id   uuid references public.clinics (id),
  code        text not null,
  description text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  deleted_at  timestamptz
);
create unique index cid_codes_uniq
  on public.cid_codes (coalesce(clinic_id, '00000000-0000-0000-0000-000000000000'::uuid), upper(code))
  where deleted_at is null;

-- learner_cids ---------------------------------------------------------------
create table public.learner_cids (
  id          uuid primary key default gen_random_uuid(),
  clinic_id   uuid not null references public.clinics (id),
  learner_id  uuid not null references public.learners (id),
  cid_code_id uuid not null references public.cid_codes (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  deleted_at  timestamptz
);
create unique index learner_cids_uniq on public.learner_cids (learner_id, cid_code_id) where deleted_at is null;

-- guardians (responsáveis) ---------------------------------------------------
create table public.guardians (
  id           uuid primary key default gen_random_uuid(),
  clinic_id    uuid not null references public.clinics (id),
  learner_id   uuid not null references public.learners (id),
  name         text not null check (length(btrim(name)) > 0),
  relationship text,
  phone        text,
  email        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid default auth.uid(),
  deleted_at   timestamptz
);
create index guardians_learner_idx on public.guardians (learner_id);

-- learner_team (quem atende quem) --------------------------------------------
create table public.learner_team (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references public.clinics (id),
  learner_id uuid not null references public.learners (id),
  profile_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz
);
create unique index learner_team_uniq on public.learner_team (learner_id, profile_id) where deleted_at is null;
create index learner_team_profile_idx on public.learner_team (profile_id) where deleted_at is null;

-- consents (LGPD) — nunca alterado nem apagado --------------------------------
create table public.consents (
  id            uuid primary key default gen_random_uuid(),
  clinic_id     uuid not null references public.clinics (id),
  learner_id    uuid not null references public.learners (id),
  guardian_id   uuid references public.guardians (id),
  consent_text  text not null,
  accepted_at   timestamptz not null default now(),
  registered_by uuid not null default auth.uid() references public.profiles (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid default auth.uid(),
  deleted_at    timestamptz
);
create index consents_learner_idx on public.consents (learner_id);

-- updated_at em todas ---------------------------------------------------------
create trigger trg_updated_at before update on public.clinics      for each row execute function public.set_updated_at();
create trigger trg_updated_at before update on public.profiles     for each row execute function public.set_updated_at();
create trigger trg_updated_at before update on public.learners     for each row execute function public.set_updated_at();
create trigger trg_updated_at before update on public.cid_codes    for each row execute function public.set_updated_at();
create trigger trg_updated_at before update on public.learner_cids for each row execute function public.set_updated_at();
create trigger trg_updated_at before update on public.guardians    for each row execute function public.set_updated_at();
create trigger trg_updated_at before update on public.learner_team for each row execute function public.set_updated_at();
create trigger trg_updated_at before update on public.consents     for each row execute function public.set_updated_at();

-- Funções-"crachá" (quem é o usuário logado) ---------------------------------
-- Retornam vazio se a pessoa estiver desativada ou ainda não trocou a senha
-- provisória: aí nenhuma regra libera dado algum.
create or replace function public.my_clinic_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.clinic_id
  from public.profiles p
  where p.id = auth.uid()
    and p.active
    and not p.must_change_password
    and p.deleted_at is null;
$$;

create or replace function public.my_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
    and p.active
    and not p.must_change_password
    and p.deleted_at is null;
$$;

create or replace function public.is_on_team(p_learner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.learner_team t
    where t.learner_id = p_learner
      and t.profile_id = auth.uid()
      and t.deleted_at is null
  );
$$;

-- Pode VER o aprendiz: coordenador da clínica, ou membro vinculado.
create or replace function public.can_see(p_learner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.learners l
    where l.id = p_learner
      and l.clinic_id = public.my_clinic_id()
      and (public.my_role() = 'coordenador' or public.is_on_team(p_learner))
  );
$$;

-- Pode GERIR o aprendiz (programas, alvos, correções): coordenador, ou supervisor vinculado.
create or replace function public.can_manage(p_learner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.learners l
    where l.id = p_learner
      and l.clinic_id = public.my_clinic_id()
      and (
        public.my_role() = 'coordenador'
        or (public.my_role() = 'supervisor' and public.is_on_team(p_learner))
      )
  );
$$;

-- Iniciais automáticas e CPF só com dígitos ----------------------------------
create or replace function public.learners_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.initials is null or btrim(new.initials) = '' then
    new.initials := public.make_initials(new.full_name);
  end if;
  new.initials := upper(btrim(new.initials));
  if new.cpf is not null then
    new.cpf := nullif(regexp_replace(new.cpf, '\D', '', 'g'), '');
  end if;
  if tg_op = 'UPDATE' then
    -- o contador de sessões só muda pelo banco
    if current_user in ('authenticated', 'anon') then
      new.last_session_number := old.last_session_number;
    end if;
  end if;
  return new;
end;
$$;
create trigger trg_learners_before_write before insert or update on public.learners
  for each row execute function public.learners_before_write();

-- Proteção de perfil: ninguém muda o próprio papel, status, clínica, e-mail ou
-- a obrigação de trocar a senha pelo app. Isso só acontece pela Edge Function
-- (chave de servidor) ou por funções do próprio banco.
create or replace function public.profiles_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon')
     and (new.role, new.active, new.clinic_id, new.email, new.must_change_password, new.id, new.deleted_at)
         is distinct from
         (old.role, old.active, old.clinic_id, old.email, old.must_change_password, old.id, old.deleted_at)
  then
    raise exception 'Alteração não permitida neste perfil.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger trg_profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();

-- Senha provisória ------------------------------------------------------------
-- Chamada pelo servidor (script/Edge Function) logo depois de definir uma senha
-- provisória: guarda o hash atual e obriga a troca no próximo login.
create or replace function public.mark_provisional_password(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.provisional_passwords (user_id, password_hash, set_at)
  select u.id, u.encrypted_password, now() from auth.users u where u.id = p_user
  on conflict (user_id) do update set password_hash = excluded.password_hash, set_at = now();

  update public.profiles set must_change_password = true where id = p_user;
end;
$$;
revoke all on function public.mark_provisional_password(uuid) from public, anon, authenticated;
grant execute on function public.mark_provisional_password(uuid) to service_role;

-- Chamada pelo app depois que a pessoa troca a senha. Só libera se a senha de
-- fato mudou (o hash atual é diferente do provisório).
create or replace function public.complete_password_change()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current text;
  v_provisional text;
begin
  select u.encrypted_password into v_current from auth.users u where u.id = auth.uid();
  select pp.password_hash into v_provisional from private.provisional_passwords pp where pp.user_id = auth.uid();

  if v_current is null then
    return false;
  end if;
  if v_provisional is not null and v_current = v_provisional then
    return false; -- ainda é a senha provisória
  end if;

  update public.profiles
     set must_change_password = false
   where id = auth.uid() and active and deleted_at is null;
  delete from private.provisional_passwords where user_id = auth.uid();
  return true;
end;
$$;
revoke all on function public.complete_password_change() from public, anon;
grant execute on function public.complete_password_change() to authenticated;
