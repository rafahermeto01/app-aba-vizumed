-- LovABA · 0005 · Regras de permissão (Row Level Security)
-- Todas as tabelas com RLS ativado, sem exceção. Sem política = acesso negado.
-- ---------------------------------------------------------------------------

-- Funções auxiliares de sessão -----------------------------------------------
create or replace function public.can_see_session(p_session uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.sessions s
    where s.id = p_session and public.can_see(s.learner_id)
  );
$$;

-- Pode escrever na sessão: o próprio aplicador enquanto em andamento, ou quem gere o aprendiz.
create or replace function public.can_write_session(p_session uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.sessions s
    where s.id = p_session
      and public.can_see(s.learner_id)
      and (
        (s.applicator_id = auth.uid() and s.status = 'em_andamento')
        or public.can_manage(s.learner_id)
      )
  );
$$;

-- Ninguém anônimo acessa nada ---------------------------------------------------
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

-- Ativar RLS em todas -----------------------------------------------------------
alter table public.clinics               enable row level security;
alter table public.profiles              enable row level security;
alter table public.learners              enable row level security;
alter table public.cid_codes             enable row level security;
alter table public.learner_cids          enable row level security;
alter table public.guardians             enable row level security;
alter table public.learner_team          enable row level security;
alter table public.consents              enable row level security;
alter table public.prompt_levels         enable row level security;
alter table public.program_categories    enable row level security;
alter table public.program_templates     enable row level security;
alter table public.template_targets      enable row level security;
alter table public.learner_programs      enable row level security;
alter table public.targets               enable row level security;
alter table public.target_prompt_history enable row level security;
alter table public.target_status_history enable row level security;
alter table public.playlists             enable row level security;
alter table public.playlist_programs     enable row level security;
alter table public.sessions              enable row level security;
alter table public.session_programs      enable row level security;
alter table public.trials                enable row level security;
alter table public.session_audit         enable row level security;
alter table private.provisional_passwords enable row level security;

-- clinics -------------------------------------------------------------------------
create policy clinics_select on public.clinics for select to authenticated
  using (id = (select public.my_clinic_id()));
create policy clinics_update on public.clinics for update to authenticated
  using (id = (select public.my_clinic_id()) and (select public.my_role()) = 'coordenador')
  with check (id = (select public.my_clinic_id()));

-- profiles ------------------------------------------------------------------------
-- Cada um lê o próprio perfil (mesmo antes de trocar a senha) e os colegas da clínica.
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or clinic_id = (select public.my_clinic_id()));
-- Cada um altera o próprio nome/foto; a coordenação altera os da clínica.
-- Papel, status e e-mail são protegidos pelo gatilho profiles_guard.
create policy profiles_update on public.profiles for update to authenticated
  using (
    id = (select auth.uid())
    or (clinic_id = (select public.my_clinic_id()) and (select public.my_role()) = 'coordenador')
  )
  with check (
    id = (select auth.uid())
    or (clinic_id = (select public.my_clinic_id()) and (select public.my_role()) = 'coordenador')
  );
-- Criar perfil: só pela Edge Function / scripts (chave de servidor). Sem política.

-- learners ----------------------------------------------------------------------
create policy learners_select on public.learners for select to authenticated
  using (public.can_see(id));
create policy learners_insert on public.learners for insert to authenticated
  with check (clinic_id = (select public.my_clinic_id()) and (select public.my_role()) = 'coordenador');
create policy learners_update on public.learners for update to authenticated
  using (clinic_id = (select public.my_clinic_id()) and (select public.my_role()) = 'coordenador')
  with check (clinic_id = (select public.my_clinic_id()));

-- Tabelas ligadas ao aprendiz, geridas pela coordenação ---------------------------
-- guardians, learner_cids, learner_team
create policy guardians_select on public.guardians for select to authenticated
  using (public.can_see(learner_id));
create policy guardians_insert on public.guardians for insert to authenticated
  with check (clinic_id = (select public.my_clinic_id()) and (select public.my_role()) = 'coordenador' and public.can_see(learner_id));
create policy guardians_update on public.guardians for update to authenticated
  using (clinic_id = (select public.my_clinic_id()) and (select public.my_role()) = 'coordenador')
  with check (clinic_id = (select public.my_clinic_id()) and public.can_see(learner_id));

create policy learner_cids_select on public.learner_cids for select to authenticated
  using (public.can_see(learner_id));
create policy learner_cids_insert on public.learner_cids for insert to authenticated
  with check (clinic_id = (select public.my_clinic_id()) and (select public.my_role()) = 'coordenador' and public.can_see(learner_id));
create policy learner_cids_update on public.learner_cids for update to authenticated
  using (clinic_id = (select public.my_clinic_id()) and (select public.my_role()) = 'coordenador')
  with check (clinic_id = (select public.my_clinic_id()) and public.can_see(learner_id));

create policy learner_team_select on public.learner_team for select to authenticated
  using (public.can_see(learner_id));
create policy learner_team_insert on public.learner_team for insert to authenticated
  with check (
    clinic_id = (select public.my_clinic_id()) and (select public.my_role()) = 'coordenador' and public.can_see(learner_id)
    and exists (select 1 from public.profiles p where p.id = profile_id and p.clinic_id = (select public.my_clinic_id()))
  );
create policy learner_team_update on public.learner_team for update to authenticated
  using (clinic_id = (select public.my_clinic_id()) and (select public.my_role()) = 'coordenador')
  with check (clinic_id = (select public.my_clinic_id()) and public.can_see(learner_id));

-- consents: cria, nunca altera nem apaga ------------------------------------------
create policy consents_select on public.consents for select to authenticated
  using (public.can_see(learner_id));
create policy consents_insert on public.consents for insert to authenticated
  with check (
    clinic_id = (select public.my_clinic_id()) and (select public.my_role()) = 'coordenador'
    and public.can_see(learner_id) and registered_by = (select auth.uid())
  );

-- cid_codes: globais + da clínica --------------------------------------------------
create policy cid_codes_select on public.cid_codes for select to authenticated
  using ((select public.my_clinic_id()) is not null and (clinic_id is null or clinic_id = (select public.my_clinic_id())));
create policy cid_codes_insert on public.cid_codes for insert to authenticated
  with check (clinic_id = (select public.my_clinic_id()) and (select public.my_role()) = 'coordenador');
create policy cid_codes_update on public.cid_codes for update to authenticated
  using (clinic_id = (select public.my_clinic_id()) and (select public.my_role()) = 'coordenador')
  with check (clinic_id = (select public.my_clinic_id()));

-- Configuração da clínica: níveis de ajuda e pastas (coordenação) ----------------
create policy prompt_levels_select on public.prompt_levels for select to authenticated
  using (clinic_id = (select public.my_clinic_id()));
create policy prompt_levels_insert on public.prompt_levels for insert to authenticated
  with check (clinic_id = (select public.my_clinic_id()) and (select public.my_role()) = 'coordenador');
create policy prompt_levels_update on public.prompt_levels for update to authenticated
  using (clinic_id = (select public.my_clinic_id()) and (select public.my_role()) = 'coordenador')
  with check (clinic_id = (select public.my_clinic_id()));

create policy program_categories_select on public.program_categories for select to authenticated
  using (clinic_id = (select public.my_clinic_id()));
create policy program_categories_insert on public.program_categories for insert to authenticated
  with check (clinic_id = (select public.my_clinic_id()) and (select public.my_role()) = 'coordenador');
create policy program_categories_update on public.program_categories for update to authenticated
  using (clinic_id = (select public.my_clinic_id()) and (select public.my_role()) = 'coordenador')
  with check (clinic_id = (select public.my_clinic_id()));

-- Biblioteca: coordenação e supervisão --------------------------------------------
create policy program_templates_select on public.program_templates for select to authenticated
  using (clinic_id = (select public.my_clinic_id()));
create policy program_templates_insert on public.program_templates for insert to authenticated
  with check (clinic_id = (select public.my_clinic_id()) and (select public.my_role()) in ('coordenador', 'supervisor'));
create policy program_templates_update on public.program_templates for update to authenticated
  using (clinic_id = (select public.my_clinic_id()) and (select public.my_role()) in ('coordenador', 'supervisor'))
  with check (clinic_id = (select public.my_clinic_id()));

create policy template_targets_select on public.template_targets for select to authenticated
  using (clinic_id = (select public.my_clinic_id()));
create policy template_targets_insert on public.template_targets for insert to authenticated
  with check (clinic_id = (select public.my_clinic_id()) and (select public.my_role()) in ('coordenador', 'supervisor'));
create policy template_targets_update on public.template_targets for update to authenticated
  using (clinic_id = (select public.my_clinic_id()) and (select public.my_role()) in ('coordenador', 'supervisor'))
  with check (clinic_id = (select public.my_clinic_id()));

-- Programas, alvos e playlists do aprendiz: vê quem pode ver, altera quem gere -----
create policy learner_programs_select on public.learner_programs for select to authenticated
  using (public.can_see(learner_id));
create policy learner_programs_insert on public.learner_programs for insert to authenticated
  with check (clinic_id = (select public.my_clinic_id()) and public.can_manage(learner_id));
create policy learner_programs_update on public.learner_programs for update to authenticated
  using (public.can_manage(learner_id))
  with check (clinic_id = (select public.my_clinic_id()) and public.can_manage(learner_id));

create policy targets_select on public.targets for select to authenticated
  using (public.can_see(learner_id));
create policy targets_insert on public.targets for insert to authenticated
  with check (clinic_id = (select public.my_clinic_id()) and public.can_manage(learner_id));
create policy targets_update on public.targets for update to authenticated
  using (public.can_manage(learner_id))
  with check (clinic_id = (select public.my_clinic_id()) and public.can_manage(learner_id));

create policy playlists_select on public.playlists for select to authenticated
  using (public.can_see(learner_id));
create policy playlists_insert on public.playlists for insert to authenticated
  with check (clinic_id = (select public.my_clinic_id()) and public.can_manage(learner_id));
create policy playlists_update on public.playlists for update to authenticated
  using (public.can_manage(learner_id))
  with check (clinic_id = (select public.my_clinic_id()) and public.can_manage(learner_id));

create policy playlist_programs_select on public.playlist_programs for select to authenticated
  using (exists (select 1 from public.playlists p where p.id = playlist_id and public.can_see(p.learner_id)));
create policy playlist_programs_insert on public.playlist_programs for insert to authenticated
  with check (
    clinic_id = (select public.my_clinic_id())
    and exists (select 1 from public.playlists p where p.id = playlist_id and public.can_manage(p.learner_id))
  );
create policy playlist_programs_update on public.playlist_programs for update to authenticated
  using (exists (select 1 from public.playlists p where p.id = playlist_id and public.can_manage(p.learner_id)))
  with check (clinic_id = (select public.my_clinic_id()));

-- Históricos: só leitura (o banco escreve sozinho) ---------------------------------
create policy target_prompt_history_select on public.target_prompt_history for select to authenticated
  using (public.can_see(learner_id));
create policy target_status_history_select on public.target_status_history for select to authenticated
  using (public.can_see(learner_id));
create policy session_audit_select on public.session_audit for select to authenticated
  using (public.can_see(learner_id));

-- sessions ------------------------------------------------------------------------
create policy sessions_select on public.sessions for select to authenticated
  using (public.can_see(learner_id));
-- Criar: só para aprendiz vinculado, com a própria pessoa como aplicador.
create policy sessions_insert on public.sessions for insert to authenticated
  with check (
    clinic_id = (select public.my_clinic_id())
    and applicator_id = (select auth.uid())
    and public.can_see(learner_id)
    and (status = 'em_andamento' or public.can_manage(learner_id))
  );
-- Alterar: o próprio aplicador enquanto em andamento; depois, só quem gere (auditado).
create policy sessions_update on public.sessions for update to authenticated
  using (
    (applicator_id = (select auth.uid()) and status = 'em_andamento' and public.can_see(learner_id))
    or public.can_manage(learner_id)
  )
  with check (
    public.can_see(learner_id)
    and (applicator_id = (select auth.uid()) or public.can_manage(learner_id))
  );
-- Apagar de verdade: ninguém. (Exclusão lógica pela coordenação, via deleted_at.)

-- session_programs e trials: seguem a sessão --------------------------------------
create policy session_programs_select on public.session_programs for select to authenticated
  using (public.can_see_session(session_id));
create policy session_programs_insert on public.session_programs for insert to authenticated
  with check (
    public.can_write_session(session_id)
    and exists (
      select 1 from public.learner_programs lp join public.sessions s on s.id = session_id
      where lp.id = learner_program_id and lp.learner_id = s.learner_id
    )
  );
create policy session_programs_update on public.session_programs for update to authenticated
  using (public.can_write_session(session_id))
  with check (public.can_write_session(session_id));

create policy trials_select on public.trials for select to authenticated
  using (public.can_see(learner_id));
create policy trials_insert on public.trials for insert to authenticated
  with check (
    public.can_write_session(session_id)
    and exists (select 1 from public.targets t where t.id = trials.target_id and t.learner_id = trials.learner_id)
  );
create policy trials_update on public.trials for update to authenticated
  using (public.can_write_session(session_id))
  with check (
    public.can_write_session(session_id)
    and exists (select 1 from public.targets t where t.id = trials.target_id and t.learner_id = trials.learner_id)
  );
