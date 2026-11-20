-- =========================================================
-- MONEYUP – Codes promo
-- À exécuter UNE FOIS dans Supabase : SQL Editor > New query > coller > Run
-- (après schema.sql, déjà exécuté)
-- =========================================================

create table if not exists public.codes_promo (
  code            text primary key check (code = upper(code) and length(code) between 4 and 30),
  libelle         text not null,
  pays_id         text not null,
  sens            text not null default 'tous' check (sens in ('tous', 'depuisMaroc', 'versMaroc')),
  frais_operateur numeric check (frais_operateur between 0 and 100),  -- nouveau % (0 = offerts), null = inchangé
  frais_service   numeric check (frais_service between 0 and 100),    -- nouveau % du service MoneyUp, null = inchangé
  note            text,                                               -- ex. nom du client
  actif           boolean not null default true,
  expire_le       date,                                               -- null = sans date de fin
  cree_le         timestamptz not null default now(),
  check (frais_operateur is not null or frais_service is not null)
);

-- SÉCURITÉ : la table est fermée au public.
-- Seuls les admins peuvent lister, créer, modifier ou supprimer des codes.
alter table public.codes_promo enable row level security;

drop policy if exists "admins : tout sur les codes" on public.codes_promo;
create policy "admins : tout sur les codes" on public.codes_promo
  for all to authenticated
  using (public.est_admin()) with check (public.est_admin());

grant select, insert, update, delete on public.codes_promo to authenticated;

-- Un visiteur du simulateur ne peut que VÉRIFIER un code précis.
-- La fonction renvoie la réduction si le code est actif et non expiré,
-- sinon null. Impossible de lister les codes existants.
create or replace function public.verifier_code_promo(p_code text)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'code',           c.code,
    'libelle',        c.libelle,
    'paysId',         c.pays_id,
    'sens',           c.sens,
    'fraisOperateur', c.frais_operateur,
    'fraisService',   c.frais_service
  )
  from public.codes_promo c
  where c.code = upper(trim(p_code))
    and c.actif
    and (c.expire_le is null or c.expire_le >= current_date);
$$;

revoke all on function public.verifier_code_promo(text) from public;
grant execute on function public.verifier_code_promo(text) to anon, authenticated;