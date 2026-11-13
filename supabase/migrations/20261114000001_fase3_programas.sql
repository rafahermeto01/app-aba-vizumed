-- LovABA · Fase 3 · Programas
--  - Supervisão também organiza as pastas da biblioteca (decisão da Etapa 0:
--    coordenação e supervisão editam a biblioteca)
--  - program_session_stats: desempenho por programa e sessão (mini-gráficos)
--  - Funções "tudo ou nada" (respeitam o RLS de quem chama):
--      save_prompt_levels, save_template, create_learner_program, add_targets,
--      set_target_status (masterizar → próximo da fila entra sozinho),
--      reorder_targets, reorder_programs, save_playlist
-- ---------------------------------------------------------------------------

-- Pastas da biblioteca: coordenação e supervisão -------------------------------
drop policy if exists program_categories_insert on public.program_categories;
drop policy if exists program_categories_update on public.program_categories;
create policy program_categories_insert on public.program_categories for insert to authenticated
  with check (clinic_id = (select public.my_clinic_id()) and (select public.my_role()) in ('coordenador', 'supervisor'));
create policy program_categories_update on public.program_categories for update to authenticated
  using (clinic_id = (select public.my_clinic_id()) and (select public.my_role()) in ('coordenador', 'supervisor'))
  with check (clinic_id = (select public.my_clinic_id()));

-- Desempenho por programa e sessão ---------------------------------------------
create or replace view public.program_session_stats
with (security_invoker = true) as
select
  tg.learner_program_id,
  t.learner_id,
  t.session_id,
  s.started_at,
  s.status                                         as session_status,
  s.applicator_id,
  count(*) filter (where t.result is not null)     as trials_total,
  count(*) filter (where t.result = 'acerto')      as correct_independent,
  count(*) filter (where t.result = 'dica')        as prompted,
  count(*) filter (where t.result = 'erro')        as errors,
  round(100.0 * count(*) filter (where t.result = 'acerto')
        / nullif(count(*) filter (where t.result is not null), 0), 1) as pct_independent,
  count(*) filter (where t.value is not null)      as occurrences,
  coalesce(sum(t.value), 0)                        as value_total
from public.trials t
join public.targets tg on tg.id = t.target_id
join public.sessions s on s.id = t.session_id
where t.deleted_at is null
  and s.deleted_at is null
group by tg.learner_program_id, t.learner_id, t.session_id, s.started_at, s.status, s.applicator_id;

revoke all on public.program_session_stats from anon, public;
grant select on public.program_session_stats to authenticated;

-- Níveis de ajuda: salvar a lista inteira (ordem, nomes, siglas, cores) ----------
-- p = [{id?, name, abbreviation, color, is_independent}] na ordem desejada
-- (1º = maior ajuda). Níveis que saírem da lista são removidos, se não estiverem
-- em uso por nenhum alvo.
create or replace function public.save_prompt_levels(p jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_clinic uuid := public.my_clinic_id();
  v_item   jsonb;
  v_id     uuid;
  v_keep   uuid[] := '{}';
  v_pos    int := 0;
  v_in_use record;
begin
  if v_clinic is null or public.my_role() is distinct from 'coordenador' then
    raise exception 'Apenas a coordenação pode alterar os níveis de ajuda.' using errcode = '42501';
  end if;
  if jsonb_typeof(p) is distinct from 'array' or jsonb_array_length(p) < 2 then
    raise exception 'A lista precisa ter pelo menos 2 níveis de ajuda.' using errcode = '23514';
  end if;
  if (select count(*) from jsonb_array_elements(p) e where coalesce((e ->> 'is_independent')::boolean, false)) <> 1 then
    raise exception 'Marque exatamente um nível como "Independente".' using errcode = '23514';
  end if;
  if (select count(distinct upper(btrim(e ->> 'abbreviation'))) from jsonb_array_elements(p) e) <> jsonb_array_length(p) then
    raise exception 'Cada nível precisa ter uma sigla diferente.' using errcode = '23514';
  end if;

  for v_item in select * from jsonb_array_elements(p) loop
    v_pos := v_pos + 1;
    v_id := nullif(v_item ->> 'id', '')::uuid;
    if v_id is not null then
      update public.prompt_levels
         set name = btrim(v_item ->> 'name'),
             abbreviation = upper(btrim(v_item ->> 'abbreviation')),
             color = lower(v_item ->> 'color'),
             is_independent = coalesce((v_item ->> 'is_independent')::boolean, false),
             sort_order = v_pos
       where id = v_id and clinic_id = v_clinic and deleted_at is null;
      if not found then v_id := null; end if;
    end if;
    if v_id is null then
      v_id := gen_random_uuid();
      insert into public.prompt_levels (id, clinic_id, name, abbreviation, color, sort_order, is_independent)
      values (v_id, v_clinic, btrim(v_item ->> 'name'), upper(btrim(v_item ->> 'abbreviation')),
              lower(v_item ->> 'color'), v_pos, coalesce((v_item ->> 'is_independent')::boolean, false));
    end if;
    v_keep := v_keep || v_id;
  end loop;

  -- Remover os que saíram da lista (só se ninguém estiver usando)
  select pl.abbreviation, count(tg.id) as n into v_in_use
    from public.prompt_levels pl
    join public.targets tg on tg.current_prompt_level_id = pl.id and tg.deleted_at is null
    join public.learner_programs lp on lp.id = tg.learner_program_id and lp.deleted_at is null
   where pl.clinic_id = v_clinic and pl.deleted_at is null and not (pl.id = any (v_keep))
   group by pl.abbreviation
   limit 1;
  if found then
    raise exception 'O nível % está em uso em % alvo(s). Mude o nível desses alvos antes de remover.', v_in_use.abbreviation, v_in_use.n
      using errcode = '23514';
  end if;
  update public.prompt_levels set deleted_at = now()
   where clinic_id = v_clinic and deleted_at is null and not (id = any (v_keep));
end;
$$;

-- Biblioteca: salvar modelo + alvos sugeridos ---------------------------------------
-- p = {id?, name, objective?, procedure?, measure_type, goal, protocol?, protocol_other?,
--      category_id?, mastery_min_pct, mastery_sessions, mastery_min_trials,
--      targets: [{id?, name}]  (na ordem)}
create or replace function public.save_template(p jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_clinic uuid := public.my_clinic_id();
  v_id     uuid := nullif(p ->> 'id', '')::uuid;
  v_item   jsonb;
  v_tid    uuid;
  v_keep   uuid[] := '{}';
  v_pos    int := 0;
begin
  if v_clinic is null or public.my_role() not in ('coordenador', 'supervisor') then
    raise exception 'Apenas coordenação e supervisão editam a biblioteca.' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p ->> 'name', ''))) = 0 then
    raise exception 'Informe o nome do programa.' using errcode = '23514';
  end if;

  if v_id is null then
    v_id := gen_random_uuid();
    insert into public.program_templates (id, clinic_id, name) values (v_id, v_clinic, btrim(p ->> 'name'));
  end if;

  update public.program_templates
     set name               = btrim(p ->> 'name'),
         objective          = nullif(btrim(p ->> 'objective'), ''),
         procedure          = nullif(btrim(p ->> 'procedure'), ''),
         measure_type       = coalesce(nullif(p ->> 'measure_type', ''), 'tentativa')::public.measure_type,
         goal               = coalesce(nullif(p ->> 'goal', ''), 'aquisicao')::public.program_goal,
         protocol           = nullif(p ->> 'protocol', '')::public.protocol,
         protocol_other     = case when p ->> 'protocol' = 'outro' then nullif(btrim(p ->> 'protocol_other'), '') end,
         category_id        = nullif(p ->> 'category_id', '')::uuid,
         mastery_min_pct    = coalesce((p ->> 'mastery_min_pct')::int, 80),
         mastery_sessions   = coalesce((p ->> 'mastery_sessions')::int, 3),
         mastery_min_trials = coalesce((p ->> 'mastery_min_trials')::int, 5)
   where id = v_id and clinic_id = v_clinic and deleted_at is null;
  if not found then
    raise exception 'Modelo não encontrado.' using errcode = 'P0002';
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p -> 'targets', '[]'::jsonb)) loop
    continue when length(btrim(coalesce(v_item ->> 'name', ''))) = 0;
    v_pos := v_pos + 1;
    v_tid := nullif(v_item ->> 'id', '')::uuid;
    if v_tid is not null then
      update public.template_targets set name = btrim(v_item ->> 'name'), sort_order = v_pos
       where id = v_tid and template_id = v_id and deleted_at is null;
      if not found then v_tid := null; end if;
    end if;
    if v_tid is null then
      v_tid := gen_random_uuid();
      insert into public.template_targets (id, clinic_id, template_id, name, sort_order)
      values (v_tid, v_clinic, v_id, btrim(v_item ->> 'name'), v_pos);
    end if;
    v_keep := v_keep || v_tid;
  end loop;
  update public.template_targets set deleted_at = now()
   where template_id = v_id and deleted_at is null and not (id = any (v_keep));

  return v_id;
end;
$$;

-- Primeiro nível de ajuda da clínica (maior ajuda) ---------------------------------
create or replace function public.first_prompt_level(p_clinic uuid)
returns uuid
language sql
stable
set search_path = ''
as $$
  select id from public.prompt_levels
   where clinic_id = p_clinic and deleted_at is null
   order by sort_order, created_at
   limit 1;
$$;

-- Programa do aprendiz (cópia própria dos campos) + alvos ---------------------------
-- p = {learner_id, template_id?, name, objective?, procedure?, measure_type, goal,
--      protocol?, protocol_other?, category_name?, mastery_*,
--      targets: [nome, ...]  (na ordem da fila),
--      start_count (quantos começam em intervenção, padrão 1),
--      start_level_id (nível de ajuda inicial; só para o tipo Tentativa)}
create or replace function public.create_learner_program(p jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_clinic  uuid := public.my_clinic_id();
  v_learner uuid := nullif(p ->> 'learner_id', '')::uuid;
  v_id      uuid := gen_random_uuid();
  v_measure public.measure_type := coalesce(nullif(p ->> 'measure_type', ''), 'tentativa')::public.measure_type;
  v_level   uuid;
  v_start   int := greatest(0, coalesce((p ->> 'start_count')::int, 1));
  v_name    text;
  v_pos     int := 0;
begin
  if v_learner is null or not public.can_manage(v_learner) then
    raise exception 'Apenas a coordenação e a supervisão vinculada podem criar programas para este aprendiz.' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p ->> 'name', ''))) = 0 then
    raise exception 'Informe o nome do programa.' using errcode = '23514';
  end if;

  if v_measure = 'tentativa' then
    select pl.id into v_level from public.prompt_levels pl
     where pl.id = nullif(p ->> 'start_level_id', '')::uuid and pl.clinic_id = v_clinic and pl.deleted_at is null;
    v_level := coalesce(v_level, public.first_prompt_level(v_clinic));
  end if;

  insert into public.learner_programs (
    id, clinic_id, learner_id, template_id, name, objective, procedure, measure_type, goal,
    protocol, protocol_other, category_name, mastery_min_pct, mastery_sessions, mastery_min_trials, sort_order
  ) values (
    v_id, v_clinic, v_learner,
    (select t.id from public.program_templates t where t.id = nullif(p ->> 'template_id', '')::uuid and t.clinic_id = v_clinic),
    btrim(p ->> 'name'),
    nullif(btrim(p ->> 'objective'), ''),
    nullif(btrim(p ->> 'procedure'), ''),
    v_measure,
    coalesce(nullif(p ->> 'goal', ''), 'aquisicao')::public.program_goal,
    nullif(p ->> 'protocol', '')::public.protocol,
    case when p ->> 'protocol' = 'outro' then nullif(btrim(p ->> 'protocol_other'), '') end,
    nullif(btrim(p ->> 'category_name'), ''),
    coalesce((p ->> 'mastery_min_pct')::int, 80),
    coalesce((p ->> 'mastery_sessions')::int, 3),
    coalesce((p ->> 'mastery_min_trials')::int, 5),
    (select coalesce(max(lp.sort_order), 0) + 1 from public.learner_programs lp where lp.learner_id = v_learner and lp.deleted_at is null)
  );

  for v_name in select btrim(x) from jsonb_array_elements_text(coalesce(p -> 'targets', '[]'::jsonb)) x loop
    continue when v_name = '';
    v_pos := v_pos + 1;
    insert into public.targets (clinic_id, learner_program_id, learner_id, name, queue_position, status, current_prompt_level_id)
    values (v_clinic, v_id, v_learner, v_name, v_pos,
            case when v_pos <= v_start then 'intervencao' else 'fila' end::public.target_status,
            v_level);
  end loop;

  return v_id;
end;
$$;

-- Adicionar alvos ao fim da fila -------------------------------------------------------
create or replace function public.add_targets(p_program uuid, p_names text[], p_level uuid default null)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_lp   public.learner_programs;
  v_pos  int;
  v_name text;
  v_n    int := 0;
begin
  select * into v_lp from public.learner_programs where id = p_program and deleted_at is null;
  if not found or not public.can_manage(v_lp.learner_id) then
    raise exception 'Apenas a coordenação e a supervisão vinculada podem alterar este programa.' using errcode = '42501';
  end if;
  select coalesce(max(queue_position), 0) into v_pos from public.targets where learner_program_id = p_program and deleted_at is null;
  foreach v_name in array p_names loop
    continue when btrim(coalesce(v_name, '')) = '';
    v_pos := v_pos + 1;
    v_n := v_n + 1;
    insert into public.targets (clinic_id, learner_program_id, learner_id, name, queue_position, status, current_prompt_level_id)
    values (v_lp.clinic_id, p_program, v_lp.learner_id, btrim(v_name), v_pos, 'fila',
            case when v_lp.measure_type = 'tentativa' then
              coalesce((select id from public.prompt_levels where id = p_level and clinic_id = v_lp.clinic_id and deleted_at is null),
                       public.first_prompt_level(v_lp.clinic_id))
            end);
  end loop;
  return v_n;
end;
$$;

-- Mudar a fase do alvo ------------------------------------------------------------------
-- Ao masterizar (ou mandar para manutenção) um alvo em intervenção, o próximo da
-- fila entra em intervenção automaticamente. Devolve o id desse alvo (ou null).
create or replace function public.set_target_status(p_target uuid, p_status public.target_status, p_interval_days int default null)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  t      public.targets;
  v_next uuid;
  v_lvl  uuid;
  v_type public.measure_type;
begin
  select * into t from public.targets where id = p_target and deleted_at is null;
  if not found then
    raise exception 'Alvo não encontrado.' using errcode = 'P0002';
  end if;
  if not public.can_manage(t.learner_id) then
    raise exception 'Apenas a coordenação e a supervisão vinculada podem mudar a fase do alvo.' using errcode = '42501';
  end if;
  if p_status = t.status and p_status <> 'manutencao' then
    return null;
  end if;
  select lp.measure_type into v_type from public.learner_programs lp where lp.id = t.learner_program_id;
  v_lvl := case when v_type = 'tentativa' then public.first_prompt_level(t.clinic_id) end;

  if p_status = 'manutencao' then
    if p_interval_days is null or p_interval_days not between 1 and 365 then
      raise exception 'Informe de quantos em quantos dias o alvo será revisado (1 a 365).' using errcode = '23514';
    end if;
    update public.targets
       set status = 'manutencao',
           maintenance_interval_days = p_interval_days,
           next_maintenance_date = (now() at time zone 'America/Sao_Paulo')::date + p_interval_days,
           mastered_at = coalesce(mastered_at, now())
     where id = p_target;
  elsif p_status = 'masterizado' then
    update public.targets
       set status = 'masterizado', mastered_at = now(), next_maintenance_date = null
     where id = p_target;
  elsif p_status = 'intervencao' then
    update public.targets
       set status = 'intervencao', next_maintenance_date = null,
           current_prompt_level_id = coalesce(current_prompt_level_id, v_lvl)
     where id = p_target;
  else -- fila: volta para o começo da fila
    update public.targets
       set status = 'fila', next_maintenance_date = null,
           queue_position = (select coalesce(min(x.queue_position), 1) - 1 from public.targets x
                              where x.learner_program_id = t.learner_program_id and x.status = 'fila' and x.deleted_at is null)
     where id = p_target;
  end if;

  if t.status = 'intervencao' and p_status in ('masterizado', 'manutencao') then
    select x.id into v_next from public.targets x
     where x.learner_program_id = t.learner_program_id and x.status = 'fila' and x.deleted_at is null
     order by x.queue_position, x.created_at
     limit 1;
    if v_next is not null then
      update public.targets
         set status = 'intervencao', current_prompt_level_id = coalesce(current_prompt_level_id, v_lvl)
       where id = v_next;
    end if;
  end if;
  return v_next;
end;
$$;

-- Reordenar ---------------------------------------------------------------------------
create or replace function public.reorder_targets(p_program uuid, p_ids uuid[])
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.targets t
     set queue_position = o.pos
    from unnest(p_ids) with ordinality as o(id, pos)
   where t.id = o.id and t.learner_program_id = p_program and t.deleted_at is null;
$$;

create or replace function public.reorder_programs(p_learner uuid, p_ids uuid[])
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.learner_programs lp
     set sort_order = o.pos
    from unnest(p_ids) with ordinality as o(id, pos)
   where lp.id = o.id and lp.learner_id = p_learner and lp.deleted_at is null;
$$;

-- Playlists ---------------------------------------------------------------------------
-- p = {id?, learner_id, name, program_ids: [uuid] (na ordem)}
create or replace function public.save_playlist(p jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_clinic  uuid := public.my_clinic_id();
  v_learner uuid := nullif(p ->> 'learner_id', '')::uuid;
  v_id      uuid := nullif(p ->> 'id', '')::uuid;
  v_ids     uuid[];
begin
  if v_learner is null or not public.can_manage(v_learner) then
    raise exception 'Apenas a coordenação e a supervisão vinculada podem montar playlists.' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p ->> 'name', ''))) = 0 then
    raise exception 'Dê um nome para a playlist.' using errcode = '23514';
  end if;
  select coalesce(array_agg(x::uuid), '{}') into v_ids
    from jsonb_array_elements_text(coalesce(p -> 'program_ids', '[]'::jsonb)) x;

  if v_id is null then
    v_id := gen_random_uuid();
    insert into public.playlists (id, clinic_id, learner_id, name) values (v_id, v_clinic, v_learner, btrim(p ->> 'name'));
  else
    update public.playlists set name = btrim(p ->> 'name')
     where id = v_id and learner_id = v_learner and deleted_at is null;
    if not found then
      raise exception 'Playlist não encontrada.' using errcode = 'P0002';
    end if;
  end if;

  update public.playlist_programs set deleted_at = now()
   where playlist_id = v_id and deleted_at is null and not (learner_program_id = any (v_ids));
  update public.playlist_programs pp set sort_order = o.pos
    from unnest(v_ids) with ordinality as o(id, pos)
   where pp.playlist_id = v_id and pp.learner_program_id = o.id and pp.deleted_at is null;
  insert into public.playlist_programs (clinic_id, playlist_id, learner_program_id, sort_order)
  select v_clinic, v_id, lp.id, o.pos
    from unnest(v_ids) with ordinality as o(id, pos)
    join public.learner_programs lp on lp.id = o.id and lp.learner_id = v_learner and lp.deleted_at is null
   where not exists (
     select 1 from public.playlist_programs pp
      where pp.playlist_id = v_id and pp.learner_program_id = lp.id and pp.deleted_at is null
   );
  return v_id;
end;
$$;

-- Permissões das funções ----------------------------------------------------------------
revoke all on function public.save_prompt_levels(jsonb) from public, anon;
revoke all on function public.save_template(jsonb) from public, anon;
revoke all on function public.first_prompt_level(uuid) from public, anon;
revoke all on function public.create_learner_program(jsonb) from public, anon;
revoke all on function public.add_targets(uuid, text[], uuid) from public, anon;
revoke all on function public.set_target_status(uuid, public.target_status, int) from public, anon;
revoke all on function public.reorder_targets(uuid, uuid[]) from public, anon;
revoke all on function public.reorder_programs(uuid, uuid[]) from public, anon;
revoke all on function public.save_playlist(jsonb) from public, anon;
grant execute on function public.save_prompt_levels(jsonb) to authenticated;
grant execute on function public.save_template(jsonb) to authenticated;
grant execute on function public.first_prompt_level(uuid) to authenticated;
grant execute on function public.create_learner_program(jsonb) to authenticated;
grant execute on function public.add_targets(uuid, text[], uuid) to authenticated;
grant execute on function public.set_target_status(uuid, public.target_status, int) to authenticated;
grant execute on function public.reorder_targets(uuid, uuid[]) to authenticated;
grant execute on function public.reorder_programs(uuid, uuid[]) to authenticated;
grant execute on function public.save_playlist(jsonb) to authenticated;
