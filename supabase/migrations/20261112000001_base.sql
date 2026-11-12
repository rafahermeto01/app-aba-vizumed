-- LovABA · 0001 · Base: tipos, funções utilitárias, esquema privado
-- ---------------------------------------------------------------------------

-- Esquema "private": nunca exposto pela API (só o banco e as funções acessam).
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Tipos (listas fixas) -------------------------------------------------------
create type public.user_role      as enum ('coordenador', 'supervisor', 'aplicador');
-- Preparado para crescer: alter type public.measure_type add value 'analise_tarefas'; etc.
create type public.measure_type   as enum ('tentativa', 'frequencia', 'duracao');
create type public.program_goal   as enum ('aquisicao', 'reducao');
create type public.program_status as enum ('ativo', 'pausado', 'concluido');
create type public.target_status  as enum ('fila', 'intervencao', 'manutencao', 'masterizado');
create type public.session_status as enum ('em_andamento', 'finalizada');
create type public.trial_result   as enum ('acerto', 'erro', 'dica');
create type public.protocol       as enum ('vbmapp', 'ablls_r', 'denver_esdm', 'peak', 'afls', 'portage', 'marcos_cv', 'outro');

-- updated_at automático -----------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Iniciais a partir do nome ("Ana Beatriz de Souza" -> "ABS") ---------------
create or replace function public.make_initials(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(string_agg(upper(left(w, 1)), '' order by ord), '')
  from unnest(regexp_split_to_array(btrim(coalesce(p_name, '')), '\s+')) with ordinality as t(w, ord)
  where w <> '' and lower(w) not in ('de', 'da', 'do', 'das', 'dos', 'e', 'di', 'du');
$$;

-- Validação de CPF (somente dígitos, com dígitos verificadores) -------------
create or replace function public.is_valid_cpf(p_cpf text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  d int[];
  s int;
  r int;
  i int;
begin
  if p_cpf is null or p_cpf !~ '^\d{11}$' then
    return false;
  end if;
  if p_cpf ~ '^(\d)\1{10}$' then
    return false; -- 000.000.000-00, 111.111.111-11 ...
  end if;
  d := array(select substr(p_cpf, g, 1)::int from generate_series(1, 11) g);

  s := 0;
  for i in 1..9 loop s := s + d[i] * (11 - i); end loop;
  r := (s * 10) % 11; if r = 10 then r := 0; end if;
  if r <> d[10] then return false; end if;

  s := 0;
  for i in 1..10 loop s := s + d[i] * (12 - i); end loop;
  r := (s * 10) % 11; if r = 10 then r := 0; end if;
  return r = d[11];
end;
$$;

-- Converte texto em uuid sem erro (usado nas regras do Storage) -------------
create or replace function public.try_uuid(p text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p::uuid;
exception when others then
  return null;
end;
$$;
