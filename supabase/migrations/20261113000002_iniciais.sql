-- LovABA · Iniciais ignoram parênteses, números e pontuação
-- ("Maria (Mari) Souza" → "MMS", e não "M(S"). Mesma regra do app (src/lib/initials.ts).
create or replace function public.make_initials(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(string_agg(upper(left(w, 1)), '' order by ord), '')
  from (
    select regexp_replace(w0, '[^[:alpha:]]', '', 'g') as w, ord
    from unnest(regexp_split_to_array(btrim(coalesce(p_name, '')), '\s+')) with ordinality as t(w0, ord)
  ) words
  where w <> '' and lower(w) not in ('de', 'da', 'do', 'das', 'dos', 'e', 'di', 'du');
$$;
