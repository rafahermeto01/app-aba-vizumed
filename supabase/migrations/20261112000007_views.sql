-- LovABA · 0007 · Cálculos prontos (views). Respeitam as mesmas regras de
-- permissão das tabelas (security_invoker).
-- ---------------------------------------------------------------------------

-- Por sessão e alvo: total de tentativas, +, DICA, − e porcentagens.
-- Tentativas desfeitas (deleted_at) não contam.
create view public.session_target_stats
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
  coalesce(sum(t.value), 0)                        as value_total
from public.trials t
join public.sessions s on s.id = t.session_id
where t.deleted_at is null
  and s.deleted_at is null
group by t.session_id, t.target_id, t.learner_id, s.started_at, s.status;

-- Sugestão de maestria: alvo em intervenção (programa de aquisição, tipo
-- Tentativa) cujas últimas N sessões finalizadas cumprem o critério do programa.
-- O sistema SÓ SUGERE; quem masteriza é o supervisor.
create view public.target_mastery
with (security_invoker = true) as
with ranked as (
  select
    st.*,
    row_number() over (partition by st.target_id order by st.started_at desc) as rn
  from public.session_target_stats st
  where st.session_status = 'finalizada'
    and st.trials_total > 0
)
select
  tg.id                    as target_id,
  tg.learner_id,
  tg.learner_program_id,
  lp.mastery_min_pct,
  lp.mastery_sessions,
  lp.mastery_min_trials,
  count(r.session_id)      as sessions_considered,
  count(r.session_id) filter (
    where r.trials_total >= lp.mastery_min_trials
      and r.pct_independent >= lp.mastery_min_pct
  )                        as sessions_meeting,
  (
    count(r.session_id) = lp.mastery_sessions
    and count(r.session_id) filter (
      where r.trials_total >= lp.mastery_min_trials
        and r.pct_independent >= lp.mastery_min_pct
    ) = lp.mastery_sessions
  )                        as ready_to_master
from public.targets tg
join public.learner_programs lp on lp.id = tg.learner_program_id
left join ranked r on r.target_id = tg.id and r.rn <= lp.mastery_sessions
where tg.status = 'intervencao'
  and tg.deleted_at is null
  and lp.deleted_at is null
  and lp.status = 'ativo'
  and lp.measure_type = 'tentativa'
  and lp.goal = 'aquisicao'
group by tg.id, tg.learner_id, tg.learner_program_id,
         lp.mastery_min_pct, lp.mastery_sessions, lp.mastery_min_trials;

grant select on public.session_target_stats to authenticated;
grant select on public.target_mastery to authenticated;
revoke all on public.session_target_stats from anon;
revoke all on public.target_mastery from anon;
