-- LovABA · 0003 · Programas e alvos: níveis de ajuda, biblioteca, programas do
-- aprendiz, alvos, históricos automáticos e playlists.
-- ---------------------------------------------------------------------------

-- prompt_levels (níveis de ajuda, configuráveis por clínica) ------------------
create table public.prompt_levels (
  id             uuid primary key default gen_random_uuid(),
  clinic_id      uuid not null references public.clinics (id),
  name           text not null check (length(btrim(name)) > 0),
  abbreviation   text not null check (length(btrim(abbreviation)) between 1 and 6),
  color          text not null default '#64748b' check (color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order     integer not null default 0, -- 1 = maior ajuda ... último = independente
  is_independent boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid default auth.uid(),
  deleted_at     timestamptz
);
create index prompt_levels_clinic_idx on public.prompt_levels (clinic_id, sort_order);

-- Níveis padrão criados automaticamente para toda clínica nova.
create or replace function public.seed_clinic_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.prompt_levels (clinic_id, name, abbreviation, color, sort_order, is_independent) values
    -- Escala roxo → azul (verde/amarelo/vermelho são reservados para acerto/dica/erro).
    (new.id, 'Ajuda física total',     'AFT', '#6d28d9', 1, false),
    (new.id, 'Ajuda física parcial',   'AFP', '#7c3aed', 2, false),
    (new.id, 'Modelo (demonstração)',  'MOD', '#8b5cf6', 3, false),
    (new.id, 'Duas opções',            '2OP', '#6366f1', 4, false),
    (new.id, 'Dica gestual',           'GES', '#3b82f6', 5, false),
    (new.id, 'Dica verbal',            'VER', '#0ea5e9', 6, false),
    (new.id, 'Independente',           'IND', '#1e40af', 7, true);
  return new;
end;
$$;
create trigger trg_clinic_defaults after insert on public.clinics
  for each row execute function public.seed_clinic_defaults();

-- program_categories (pastas da biblioteca) ----------------------------------
create table public.program_categories (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references public.clinics (id),
  name       text not null check (length(btrim(name)) > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz
);
create index program_categories_clinic_idx on public.program_categories (clinic_id);

-- program_templates (biblioteca) ---------------------------------------------
create table public.program_templates (
  id                 uuid primary key default gen_random_uuid(),
  clinic_id          uuid not null references public.clinics (id),
  name               text not null check (length(btrim(name)) > 0),
  objective          text check (objective is null or length(objective) <= 500),
  procedure          text,
  measure_type       public.measure_type not null default 'tentativa',
  goal               public.program_goal not null default 'aquisicao',
  protocol           public.protocol,
  protocol_other     text,
  category_id        uuid references public.program_categories (id),
  mastery_min_pct    integer not null default 80 check (mastery_min_pct between 1 and 100),
  mastery_sessions   integer not null default 3  check (mastery_sessions between 1 and 20),
  mastery_min_trials integer not null default 5  check (mastery_min_trials between 1 and 100),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid default auth.uid(),
  deleted_at         timestamptz
);
create index program_templates_clinic_idx on public.program_templates (clinic_id);

-- template_targets (alvos sugeridos) -----------------------------------------
create table public.template_targets (
  id          uuid primary key default gen_random_uuid(),
  clinic_id   uuid not null references public.clinics (id),
  template_id uuid not null references public.program_templates (id),
  name        text not null check (length(btrim(name)) > 0),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  deleted_at  timestamptz
);
create index template_targets_template_idx on public.template_targets (template_id);

-- learner_programs (programa do aprendiz — cópia própria dos campos) ----------
create table public.learner_programs (
  id                 uuid primary key default gen_random_uuid(),
  clinic_id          uuid not null references public.clinics (id),
  learner_id         uuid not null references public.learners (id),
  template_id        uuid references public.program_templates (id),
  name               text not null check (length(btrim(name)) > 0),
  objective          text check (objective is null or length(objective) <= 500),
  procedure          text,
  measure_type       public.measure_type not null default 'tentativa',
  goal               public.program_goal not null default 'aquisicao',
  protocol           public.protocol,
  protocol_other     text,
  category_name      text,
  status             public.program_status not null default 'ativo',
  mastery_min_pct    integer not null default 80 check (mastery_min_pct between 1 and 100),
  mastery_sessions   integer not null default 3  check (mastery_sessions between 1 and 20),
  mastery_min_trials integer not null default 5  check (mastery_min_trials between 1 and 100),
  sort_order         integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid default auth.uid(),
  deleted_at         timestamptz
);
create index learner_programs_learner_idx on public.learner_programs (learner_id);

-- targets (alvos) -------------------------------------------------------------
create table public.targets (
  id                        uuid primary key default gen_random_uuid(),
  clinic_id                 uuid not null references public.clinics (id),
  learner_program_id        uuid not null references public.learner_programs (id),
  learner_id                uuid not null references public.learners (id),
  name                      text not null check (length(btrim(name)) > 0),
  queue_position            integer not null default 0,
  current_prompt_level_id   uuid references public.prompt_levels (id),
  status                    public.target_status not null default 'fila',
  maintenance_interval_days integer check (maintenance_interval_days is null or maintenance_interval_days between 1 and 365),
  next_maintenance_date     date,
  mastered_at               timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  created_by                uuid default auth.uid(),
  deleted_at                timestamptz
);
create index targets_program_idx on public.targets (learner_program_id, status, queue_position);
create index targets_learner_idx on public.targets (learner_id);

-- O alvo sempre pertence ao mesmo aprendiz do programa.
create or replace function public.targets_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select lp.learner_id, lp.clinic_id into new.learner_id, new.clinic_id
  from public.learner_programs lp where lp.id = new.learner_program_id;
  return new;
end;
$$;
create trigger trg_targets_before_write before insert or update of learner_program_id on public.targets
  for each row execute function public.targets_before_write();

-- Históricos (preenchidos só pelo banco) --------------------------------------
create table public.target_prompt_history (
  id            uuid primary key default gen_random_uuid(),
  clinic_id     uuid not null references public.clinics (id),
  target_id     uuid not null references public.targets (id),
  learner_id    uuid not null references public.learners (id),
  from_level_id uuid references public.prompt_levels (id),
  to_level_id   uuid references public.prompt_levels (id),
  changed_by    uuid default auth.uid(),
  changed_at    timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid default auth.uid(),
  deleted_at    timestamptz
);
create index target_prompt_history_target_idx on public.target_prompt_history (target_id, changed_at);

create table public.target_status_history (
  id          uuid primary key default gen_random_uuid(),
  clinic_id   uuid not null references public.clinics (id),
  target_id   uuid not null references public.targets (id),
  learner_id  uuid not null references public.learners (id),
  from_status public.target_status,
  to_status   public.target_status not null,
  changed_by  uuid default auth.uid(),
  changed_at  timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  deleted_at  timestamptz
);
create index target_status_history_target_idx on public.target_status_history (target_id, changed_at);

create or replace function public.targets_log_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.current_prompt_level_id is distinct from old.current_prompt_level_id then
    if tg_op = 'INSERT' and new.current_prompt_level_id is null then
      null; -- sem nível ainda: nada a registrar
    else
      insert into public.target_prompt_history (clinic_id, target_id, learner_id, from_level_id, to_level_id, changed_by)
      values (new.clinic_id, new.id, new.learner_id,
              case when tg_op = 'UPDATE' then old.current_prompt_level_id end,
              new.current_prompt_level_id, auth.uid());
    end if;
  end if;

  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.target_status_history (clinic_id, target_id, learner_id, from_status, to_status, changed_by)
    values (new.clinic_id, new.id, new.learner_id,
            case when tg_op = 'UPDATE' then old.status end,
            new.status, auth.uid());
  end if;
  return null;
end;
$$;
create trigger trg_targets_log after insert or update on public.targets
  for each row execute function public.targets_log_changes();

-- playlists ------------------------------------------------------------------
create table public.playlists (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references public.clinics (id),
  learner_id uuid not null references public.learners (id),
  name       text not null check (length(btrim(name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz
);
create index playlists_learner_idx on public.playlists (learner_id);

create table public.playlist_programs (
  id                 uuid primary key default gen_random_uuid(),
  clinic_id          uuid not null references public.clinics (id),
  playlist_id        uuid not null references public.playlists (id),
  learner_program_id uuid not null references public.learner_programs (id),
  sort_order         integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid default auth.uid(),
  deleted_at         timestamptz
);
create unique index playlist_programs_uniq on public.playlist_programs (playlist_id, learner_program_id) where deleted_at is null;

-- updated_at ------------------------------------------------------------------
create trigger trg_updated_at before update on public.prompt_levels         for each row execute function public.set_updated_at();
create trigger trg_updated_at before update on public.program_categories    for each row execute function public.set_updated_at();
create trigger trg_updated_at before update on public.program_templates     for each row execute function public.set_updated_at();
create trigger trg_updated_at before update on public.template_targets      for each row execute function public.set_updated_at();
create trigger trg_updated_at before update on public.learner_programs      for each row execute function public.set_updated_at();
create trigger trg_updated_at before update on public.targets               for each row execute function public.set_updated_at();
create trigger trg_updated_at before update on public.target_prompt_history for each row execute function public.set_updated_at();
create trigger trg_updated_at before update on public.target_status_history for each row execute function public.set_updated_at();
create trigger trg_updated_at before update on public.playlists             for each row execute function public.set_updated_at();
create trigger trg_updated_at before update on public.playlist_programs     for each row execute function public.set_updated_at();
