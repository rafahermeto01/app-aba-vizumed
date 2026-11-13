-- LovABA · Fase 6 · Cores dos níveis de ajuda com contraste suficiente
-- Algumas cores padrão (MOD, 2OP, GES, VER) deixavam a sigla com contraste abaixo
-- do mínimo de acessibilidade (4,5:1). Novas cores, na mesma escala roxo → azul
-- (verde, amarelo e vermelho continuam reservados para acerto, dica e erro).

create or replace function public.seed_clinic_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.prompt_levels (clinic_id, name, abbreviation, color, sort_order, is_independent) values
    (new.id, 'Ajuda física total',     'AFT', '#5b21b6', 1, false),
    (new.id, 'Ajuda física parcial',   'AFP', '#6d28d9', 2, false),
    (new.id, 'Modelo (demonstração)',  'MOD', '#7c3aed', 3, false),
    (new.id, 'Duas opções',            '2OP', '#4f46e5', 4, false),
    (new.id, 'Dica gestual',           'GES', '#2563eb', 5, false),
    (new.id, 'Dica verbal',            'VER', '#0369a1', 6, false),
    (new.id, 'Independente',           'IND', '#1e3a8a', 7, true);
  return new;
end;
$$;

-- Clínicas que já existem: troca só as cores que ainda estão no padrão antigo
-- (quem escolheu outra cor mantém a sua).
update public.prompt_levels set color = '#5b21b6' where abbreviation = 'AFT' and lower(color) = '#6d28d9' and deleted_at is null;
update public.prompt_levels set color = '#6d28d9' where abbreviation = 'AFP' and lower(color) = '#7c3aed' and deleted_at is null;
update public.prompt_levels set color = '#7c3aed' where abbreviation = 'MOD' and lower(color) = '#8b5cf6' and deleted_at is null;
update public.prompt_levels set color = '#4f46e5' where abbreviation = '2OP' and lower(color) = '#6366f1' and deleted_at is null;
update public.prompt_levels set color = '#2563eb' where abbreviation = 'GES' and lower(color) = '#3b82f6' and deleted_at is null;
update public.prompt_levels set color = '#0369a1' where abbreviation = 'VER' and lower(color) = '#0ea5e9' and deleted_at is null;
update public.prompt_levels set color = '#1e3a8a' where abbreviation = 'IND' and lower(color) = '#1e40af' and deleted_at is null;
