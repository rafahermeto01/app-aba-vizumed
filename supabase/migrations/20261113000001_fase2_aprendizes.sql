-- LovABA · Fase 2 · Aprendizes
--  - learner_overview: lista de aprendizes com a última sessão ("há 22 horas")
--  - save_learner(): salva aprendiz + CIDs + responsáveis + equipe + consentimento
--    numa única transação (tudo ou nada), respeitando as regras de RLS de quem chama.
-- ---------------------------------------------------------------------------

-- Lista de aprendizes ----------------------------------------------------------
-- security_invoker: cada pessoa só enxerga os aprendizes (e sessões) que pode ver.
create or replace view public.learner_overview
with (security_invoker = true) as
select
  l.id,
  l.clinic_id,
  l.full_name,
  l.initials,
  l.birth_date,
  l.photo_path,
  l.active,
  l.created_at,
  s.last_session_at,
  coalesce(s.sessions_count, 0)::int as sessions_count
from public.learners l
left join lateral (
  select max(se.started_at) as last_session_at, count(*) as sessions_count
  from public.sessions se
  where se.learner_id = l.id
    and se.deleted_at is null
) s on true
where l.deleted_at is null;

revoke all on public.learner_overview from anon, public;
grant select on public.learner_overview to authenticated;

-- Texto do consentimento LGPD (cópia exata guardada em cada registro) -------------
create or replace function public.lgpd_consent_text()
returns text
language sql
immutable
set search_path = ''
as $$
  select 'Declaro que obtive o consentimento informado do responsável pelo(a) aprendiz para a coleta, '
      || 'armazenamento e uso de dados sensíveis, incluindo fotos, em conformidade com a LGPD.'::text;
$$;
grant execute on function public.lgpd_consent_text() to authenticated;

-- Salvar aprendiz (criar ou editar) ------------------------------------------------
-- p = {
--   id?            (vazio = novo aprendiz)
--   full_name, initials?, cpf?, birth_date?, notes?, active?
--   cid_ids:   [uuid]                 lista completa (o que sair da lista é removido)
--   team_ids:  [uuid]                 lista completa
--   guardians: [{id?, name, relationship?, phone?, email?}]  lista completa
--   consent_accepted: boolean        obrigatório se o aprendiz ainda não tem consentimento
-- }
create or replace function public.save_learner(p jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_clinic   uuid := public.my_clinic_id();
  v_id       uuid := nullif(p ->> 'id', '')::uuid;
  v_is_new   boolean := v_id is null;
  v_cids     uuid[];
  v_team     uuid[];
  v_keep     uuid[] := '{}';
  v_g        jsonb;
  v_gid      uuid;
  v_first_g  uuid;
begin
  if v_clinic is null or public.my_role() is distinct from 'coordenador' then
    raise exception 'Apenas a coordenação pode cadastrar ou editar aprendizes.' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p ->> 'full_name', ''))) = 0 then
    raise exception 'Informe o nome completo.' using errcode = '23514';
  end if;

  select coalesce(array_agg(x::uuid), '{}') into v_cids
    from jsonb_array_elements_text(coalesce(p -> 'cid_ids', '[]'::jsonb)) x;
  select coalesce(array_agg(x::uuid), '{}') into v_team
    from jsonb_array_elements_text(coalesce(p -> 'team_ids', '[]'::jsonb)) x;

  -- 1. Dados do aprendiz
  if v_is_new then
    v_id := gen_random_uuid();
    insert into public.learners (id, clinic_id, full_name, initials, cpf, birth_date, notes, active)
    values (
      v_id, v_clinic,
      btrim(p ->> 'full_name'),
      coalesce(btrim(p ->> 'initials'), ''),
      nullif(btrim(p ->> 'cpf'), ''),
      nullif(p ->> 'birth_date', '')::date,
      nullif(btrim(p ->> 'notes'), ''),
      coalesce((p ->> 'active')::boolean, true)
    );
  else
    update public.learners
       set full_name  = btrim(p ->> 'full_name'),
           initials   = coalesce(btrim(p ->> 'initials'), ''),
           cpf        = nullif(btrim(p ->> 'cpf'), ''),
           birth_date = nullif(p ->> 'birth_date', '')::date,
           notes      = nullif(btrim(p ->> 'notes'), ''),
           active     = coalesce((p ->> 'active')::boolean, active)
     where id = v_id and deleted_at is null;
    if not found then
      raise exception 'Aprendiz não encontrado.' using errcode = 'P0002';
    end if;
  end if;

  -- 2. CIDs (só códigos que a pessoa enxerga: globais ou da clínica)
  update public.learner_cids
     set deleted_at = now()
   where learner_id = v_id and deleted_at is null and not (cid_code_id = any (v_cids));
  insert into public.learner_cids (clinic_id, learner_id, cid_code_id)
  select v_clinic, v_id, c.id
    from public.cid_codes c
   where c.id = any (v_cids)
     and c.deleted_at is null
     and not exists (
       select 1 from public.learner_cids lc
        where lc.learner_id = v_id and lc.cid_code_id = c.id and lc.deleted_at is null
     );

  -- 3. Equipe vinculada (só membros ativos da própria clínica)
  update public.learner_team
     set deleted_at = now()
   where learner_id = v_id and deleted_at is null and not (profile_id = any (v_team));
  insert into public.learner_team (clinic_id, learner_id, profile_id)
  select v_clinic, v_id, pr.id
    from public.profiles pr
   where pr.id = any (v_team)
     and pr.clinic_id = v_clinic
     and pr.active
     and pr.deleted_at is null
     and not exists (
       select 1 from public.learner_team t
        where t.learner_id = v_id and t.profile_id = pr.id and t.deleted_at is null
     );

  -- 4. Responsáveis
  for v_g in select * from jsonb_array_elements(coalesce(p -> 'guardians', '[]'::jsonb)) loop
    if length(btrim(coalesce(v_g ->> 'name', ''))) = 0 then
      raise exception 'Informe o nome de cada responsável.' using errcode = '23514';
    end if;
    v_gid := nullif(v_g ->> 'id', '')::uuid;
    if v_gid is not null then
      update public.guardians
         set name = btrim(v_g ->> 'name'),
             relationship = nullif(btrim(v_g ->> 'relationship'), ''),
             phone = nullif(btrim(v_g ->> 'phone'), ''),
             email = nullif(lower(btrim(v_g ->> 'email')), '')
       where id = v_gid and learner_id = v_id and deleted_at is null;
      if not found then
        v_gid := null; -- não pertence a este aprendiz: cria um novo
      end if;
    end if;
    if v_gid is null then
      v_gid := gen_random_uuid();
      insert into public.guardians (id, clinic_id, learner_id, name, relationship, phone, email)
      values (
        v_gid, v_clinic, v_id,
        btrim(v_g ->> 'name'),
        nullif(btrim(v_g ->> 'relationship'), ''),
        nullif(btrim(v_g ->> 'phone'), ''),
        nullif(lower(btrim(v_g ->> 'email')), '')
      );
    end if;
    v_keep := v_keep || v_gid;
    v_first_g := coalesce(v_first_g, v_gid);
  end loop;
  update public.guardians
     set deleted_at = now()
   where learner_id = v_id and deleted_at is null and not (id = any (v_keep));

  -- 5. Consentimento LGPD (obrigatório; registrado uma vez, nunca alterado)
  if not exists (select 1 from public.consents c where c.learner_id = v_id and c.deleted_at is null) then
    if coalesce((p ->> 'consent_accepted')::boolean, false) is not true then
      raise exception 'É obrigatório confirmar o consentimento LGPD do responsável.' using errcode = '23514';
    end if;
    insert into public.consents (clinic_id, learner_id, guardian_id, consent_text)
    values (v_clinic, v_id, v_first_g, public.lgpd_consent_text());
  end if;

  return v_id;
end;
$$;
revoke all on function public.save_learner(jsonb) from public, anon;
grant execute on function public.save_learner(jsonb) to authenticated;
