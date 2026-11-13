-- LovABA · Fase 5 · Evolução
--  - session_target_stats ganha prompt_level_id: o nível de ajuda VIGENTE do alvo
--    naquela sessão (o mais frequente nas tentativas). É o que colore o gráfico.
--  - session_overview: uma linha por sessão para a lista (programas, alvos,
--    tentativas, acertos), respeitando as permissões (security_invoker).
-- ---------------------------------------------------------------------------

create or replace view public.session_target_stats
with (security_invoker = true) as
select
  t.session_id,
  t.target_id,
  t.learner_id,
  s.started_at,
  s.status                                         as session_status,
  count(*) filter (where t.result is not null)     as trials_total,
  count(*) filter (where t.result = 'acerto')      as correct_independent,
  count(*) filter (where t.result = 'dica')        as prompted,
  count(*) filter (where t.result = 'erro')        as errors,
  round(100.0 * count(*) filter (where t.result = 'acerto')
        / nullif(count(*) filter (where t.result is not null), 0), 1) as pct_independent,
  round(100.0 * count(*) filter (where t.result in ('acerto', 'dica'))
        / nullif(count(*) filter (where t.result is not null), 0), 1) as pct_total,
  count(*) filter (where t.value is not null)      as occurrences,
  coalesce(sum(t.value), 0)                        as value_total,
  mode() within group (order by t.prompt_level_id) as prompt_level_id
from public.trials t
join public.sessions s on s.id = t.session_id
where t.deleted_at is null
  and s.deleted_at is null
group by t.session_id, t.target_id, t.learner_id, s.started_at, s.status;

create or replace view public.session_overview
with (security_invoker = true) as
select
  s.id,
  s.clinic_id,
  s.learner_id,
  s.number,
  s.started_at,
  s.ended_at,
  s.duration_seconds,
  s.status,
  s.rating,
  s.notes,
  s.applicator_id,
  s.applicator_signature_path,
  coalesce(sp.programs_count, 0)::int    as programs_count,
  coalesce(tr.targets_count, 0)::int     as targets_count,
  coalesce(tr.trials_total, 0)::int      as trials_total,
  coalesce(tr.correct_independent, 0)::int as correct_independent,
  coalesce(tr.prompted, 0)::int          as prompted,
  coalesce(tr.occurrences, 0)::int       as occurrences
from public.sessions s
left join lateral (
  select count(*) as programs_count
  from public.session_programs x
  where x.session_id = s.id and x.deleted_at is null
) sp on true
left join lateral (
  select
    count(distinct t.target_id)                     as targets_count,
    count(*) filter (where t.result is not null)    as trials_total,
    count(*) filter (where t.result = 'acerto')     as correct_independent,
    count(*) filter (where t.result = 'dica')       as prompted,
    count(*) filter (where t.value is not null)     as occurrences
  from public.trials t
  where t.session_id = s.id and t.deleted_at is null
) tr on true
where s.deleted_at is null;

revoke all on public.session_overview from anon, public;
grant select on public.session_overview to authenticated;
revoke all on public.session_target_stats from anon;
grant select on public.session_target_stats to authenticated;
