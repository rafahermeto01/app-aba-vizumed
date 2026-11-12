-- LovABA · 0004 · Sessões e coleta: sessões, programas da sessão, tentativas
-- e auditoria de correções.
-- ---------------------------------------------------------------------------

-- sessions --------------------------------------------------------------------
create table public.sessions (
  id                        uuid primary key default gen_random_uuid(),
  clinic_id                 uuid not null references public.clinics (id),
  client_id                 uuid not null unique, -- gerado no aparelho: reenvio nunca duplica
  learner_id                uuid not null references public.learners (id),
  applicator_id             uuid not null default auth.uid() references public.profiles (id),
  number                    integer, -- Sessão #24 (dado pelo servidor)
  started_at                timestamptz not null default now(),
  ended_at                  timestamptz,
  duration_seconds          integer check (duration_seconds is null or duration_seconds >= 0),
  status                    public.session_status not null default 'em_andamento',
  rating                    smallint check (rating is null or rating between 1 and 5),
  notes                     text,
  applicator_signature_path text,
  supervisor_signature_path text,
  supervisor_signed_by      uuid references public.profiles (id),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  created_by                uuid default auth.uid(),
  deleted_at                timestamptz
);
create index sessions_learner_idx on public.sessions (learner_id, started_at desc);
create index sessions_applicator_idx on public.sessions (applicator_id, started_at desc);
create unique index sessions_number_uniq on public.sessions (learner_id, number) where number is not null;

-- Número sequencial por aprendiz, atribuído quando a sessão chega ao servidor.
-- Roda com permissão do banco porque precisa atualizar o contador do aprendiz.
create or replace function public.sessions_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select l.clinic_id into new.clinic_id from public.learners l where l.id = new.learner_id;

  -- Reenvio (upsert) de uma sessão que já existe: não gasta número novo.
  if exists (select 1 from public.sessions s where s.client_id = new.client_id) then
    new.number := null;
    return new;
  end if;

  update public.learners
     set last_session_number = last_session_number + 1
   where id = new.learner_id
  returning last_session_number into new.number;
  return new;
end;
$$;
create trigger trg_sessions_before_insert before insert on public.sessions
  for each row execute function public.sessions_before_insert();

-- Campos que nunca mudam depois de criados.
create or replace function public.sessions_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.id            := old.id;
  new.client_id     := old.client_id;
  new.clinic_id     := old.clinic_id;
  new.learner_id    := old.learner_id;
  new.applicator_id := old.applicator_id;
  new.number        := old.number;
  new.created_at    := old.created_at;
  new.created_by    := old.created_by;
  -- Sessão finalizada não volta a "em andamento".
  if old.status = 'finalizada' then
    new.status := 'finalizada';
  end if;
  -- Só a coordenação pode excluir (exclusão lógica) uma sessão.
  if new.deleted_at is distinct from old.deleted_at
     and current_user in ('authenticated', 'anon')
     and public.my_role() is distinct from 'coordenador' then
    raise exception 'Somente a coordenação pode excluir sessões.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger trg_sessions_before_update before update on public.sessions
  for each row execute function public.sessions_before_update();

-- session_programs ------------------------------------------------------------
create table public.session_programs (
  id                 uuid primary key default gen_random_uuid(),
  clinic_id          uuid not null references public.clinics (id),
  client_id          uuid not null unique,
  session_id         uuid not null references public.sessions (id),
  learner_program_id uuid not null references public.learner_programs (id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid default auth.uid(),
  deleted_at         timestamptz
);
create unique index session_programs_uniq on public.session_programs (session_id, learner_program_id) where deleted_at is null;

-- trials (cada toque da coleta) -----------------------------------------------
create table public.trials (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references public.clinics (id),
  client_id       uuid not null unique, -- gerado no aparelho
  session_id      uuid not null references public.sessions (id),
  target_id       uuid not null references public.targets (id),
  learner_id      uuid not null references public.learners (id),
  result          public.trial_result,           -- só no tipo Tentativa
  prompt_level_id uuid references public.prompt_levels (id), -- foto do nível atual do alvo
  help_level_id   uuid references public.prompt_levels (id), -- ajuda usada no DICA
  value           numeric check (value is null or value >= 0), -- frequência: 1 · duração: segundos
  started_at      timestamptz,
  recorded_at     timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid default auth.uid(),
  deleted_at      timestamptz, -- "Desfazer"
  check (result is not null or value is not null),
  check (help_level_id is null or result = 'dica')
);
create index trials_session_idx on public.trials (session_id);
create index trials_target_idx on public.trials (target_id, recorded_at);

-- Tentativa sempre herda clínica e aprendiz da sessão.
create or replace function public.trials_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.client_id := old.client_id;
    new.session_id := old.session_id;
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;
  select s.clinic_id, s.learner_id into new.clinic_id, new.learner_id
  from public.sessions s where s.id = new.session_id;
  return new;
end;
$$;
create trigger trg_trials_before_write before insert or update on public.trials
  for each row execute function public.trials_before_write();

create or replace function public.session_programs_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.client_id := old.client_id;
    new.session_id := old.session_id;
  end if;
  select s.clinic_id into new.clinic_id from public.sessions s where s.id = new.session_id;
  return new;
end;
$$;
create trigger trg_session_programs_before_write before insert or update on public.session_programs
  for each row execute function public.session_programs_before_write();

-- session_audit (correções em sessão finalizada) ------------------------------
create table public.session_audit (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references public.clinics (id),
  session_id uuid not null references public.sessions (id),
  learner_id uuid not null references public.learners (id),
  table_name text not null,
  record_id  uuid not null,
  action     text not null, -- INSERT | UPDATE
  old_data   jsonb,
  new_data   jsonb,
  changed_by uuid default auth.uid(),
  changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz
);
create index session_audit_session_idx on public.session_audit (session_id, changed_at);

create or replace function public.audit_finalized_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.sessions;
  v_session_id uuid;
begin
  if tg_table_name = 'sessions' then
    v_session_id := old.id;
    -- só audita alterações em sessão que JÁ estava finalizada
    if old.status <> 'finalizada' then
      return null;
    end if;
  else
    v_session_id := coalesce(new.session_id, old.session_id);
  end if;

  select * into v_session from public.sessions s where s.id = v_session_id;
  if tg_table_name <> 'sessions' and v_session.status <> 'finalizada' then
    return null;
  end if;

  insert into public.session_audit (clinic_id, session_id, learner_id, table_name, record_id, action, old_data, new_data, changed_by)
  values (v_session.clinic_id, v_session.id, v_session.learner_id, tg_table_name,
          coalesce(new.id, old.id), tg_op,
          case when tg_op = 'UPDATE' then to_jsonb(old) end,
          to_jsonb(new), auth.uid());
  return null;
end;
$$;
create trigger trg_audit after update on public.sessions
  for each row execute function public.audit_finalized_session();
create trigger trg_audit after insert or update on public.trials
  for each row execute function public.audit_finalized_session();
create trigger trg_audit after insert or update on public.session_programs
  for each row execute function public.audit_finalized_session();

-- updated_at ------------------------------------------------------------------
create trigger trg_updated_at before update on public.sessions         for each row execute function public.set_updated_at();
create trigger trg_updated_at before update on public.session_programs for each row execute function public.set_updated_at();
create trigger trg_updated_at before update on public.trials           for each row execute function public.set_updated_at();
create trigger trg_updated_at before update on public.session_audit    for each row execute function public.set_updated_at();
