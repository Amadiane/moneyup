-- =========================================================
-- MONEYUP – Base de données de l'espace admin
-- À exécuter UNE FOIS dans Supabase : SQL Editor > New query > coller > Run
-- =========================================================

-- 1. TABLES -------------------------------------------------

-- Les tarifs : une seule ligne (id = 1) qui contient tout en JSON,
-- avec exactement la même structure que src/config/tarifs.js
create table if not exists public.configuration (
  id          int primary key default 1 check (id = 1),
  donnees     jsonb not null,
  modifie_le  timestamptz not null default now(),
  modifie_par uuid references auth.users(id)
);

-- La liste des comptes autorisés à modifier les tarifs
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

-- Chaque modification archive l'ancienne version ici (filet de sécurité)
create table if not exists public.historique_configuration (
  id          bigint generated always as identity primary key,
  donnees     jsonb not null,
  modifie_le  timestamptz not null,
  modifie_par uuid,
  archive_le  timestamptz not null default now()
);

-- 2. SÉCURITÉ (Row Level Security) ---------------------------
-- Tout est fermé par défaut, puis on ouvre au cas par cas.

alter table public.configuration            enable row level security;
alter table public.admins                   enable row level security;
alter table public.historique_configuration enable row level security;

-- Vrai si l'utilisateur connecté est dans la table admins
create or replace function public.est_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- Tout le monde (les visiteurs du simulateur) peut LIRE les tarifs
drop policy if exists "lecture publique des tarifs" on public.configuration;
create policy "lecture publique des tarifs" on public.configuration
  for select to anon, authenticated using (true);

-- Seuls les admins peuvent les MODIFIER
drop policy if exists "modification par un admin" on public.configuration;
create policy "modification par un admin" on public.configuration
  for update to authenticated
  using (public.est_admin()) with check (public.est_admin());

-- Un utilisateur connecté peut seulement vérifier s'il est admin
drop policy if exists "voir son propre statut" on public.admins;
create policy "voir son propre statut" on public.admins
  for select to authenticated using (user_id = auth.uid());

-- L'historique n'est visible que par les admins
drop policy if exists "historique pour les admins" on public.historique_configuration;
create policy "historique pour les admins" on public.historique_configuration
  for select to authenticated using (public.est_admin());

grant usage on schema public to anon, authenticated;
grant select on public.configuration to anon, authenticated;
grant update on public.configuration to authenticated;
grant select on public.admins to authenticated;
grant select on public.historique_configuration to authenticated;
grant execute on function public.est_admin() to anon, authenticated;

-- 3. ARCHIVAGE AUTOMATIQUE ----------------------------------
create or replace function public.archiver_configuration()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.historique_configuration (donnees, modifie_le, modifie_par)
  values (old.donnees, old.modifie_le, old.modifie_par);
  new.modifie_le  := now();
  new.modifie_par := auth.uid();
  return new;
end;
$$;

drop trigger if exists avant_modification on public.configuration;
create trigger avant_modification
  before update on public.configuration
  for each row execute function public.archiver_configuration();

-- 4. TARIFS DE DÉPART (copie de tarifs.js + parametres.js) ---
insert into public.configuration (id, donnees)
values (1, $json$
{
  "pays": [
    {
      "id": "gabon",
      "nom": "Gabon",
      "drapeau": "🇬🇦",
      "devise": "XAF",
      "actif": true,
      "corridors": {
        "depuisMaroc": {
          "actif": true,
          "moyenPaiement": "Airtel Money",
          "paliers": [
            {
              "aPartirDe": 0,
              "taux": {
                "unite": "MAD",
                "valeur": 60
              },
              "frais": [
                {
                  "id": "service",
                  "libelle": "Frais de service MoneyUp",
                  "categorie": "moneyup",
                  "type": "pourcentage",
                  "valeur": 0,
                  "base": "envoye"
                },
                {
                  "id": "retrait",
                  "libelle": "Frais de retrait Airtel Money",
                  "categorie": "operateur",
                  "type": "pourcentage",
                  "valeur": 3,
                  "base": "recu"
                }
              ]
            }
          ]
        },
        "versMaroc": {
          "actif": true,
          "moyenPaiement": "Airtel Money",
          "paliers": [
            {
              "aPartirDe": 0,
              "taux": {
                "unite": "MAD",
                "valeur": 68
              },
              "frais": [
                {
                  "id": "operateur",
                  "libelle": "Frais Airtel Money",
                  "categorie": "operateur",
                  "type": "pourcentage",
                  "valeur": 1.5,
                  "base": "envoye"
                }
              ]
            },
            {
              "aPartirDe": 50000,
              "taux": {
                "unite": "MAD",
                "valeur": 67
              },
              "frais": [
                {
                  "id": "operateur",
                  "libelle": "Frais Airtel Money",
                  "categorie": "operateur",
                  "type": "pourcentage",
                  "valeur": 1,
                  "base": "envoye"
                }
              ]
            }
          ]
        }
      }
    },
    {
      "id": "congo",
      "nom": "Congo-Brazzaville",
      "drapeau": "🇨🇬",
      "devise": "XAF",
      "actif": true,
      "corridors": {
        "depuisMaroc": {
          "actif": true,
          "moyenPaiement": "MTN Money",
          "paliers": [
            {
              "aPartirDe": 0,
              "taux": {
                "unite": "MAD",
                "valeur": 60
              },
              "frais": [
                {
                  "id": "service",
                  "libelle": "Frais de service MoneyUp",
                  "categorie": "moneyup",
                  "type": "pourcentage",
                  "valeur": 0,
                  "base": "envoye"
                },
                {
                  "id": "retrait",
                  "libelle": "Frais de retrait MTN Money",
                  "categorie": "operateur",
                  "type": "pourcentage",
                  "valeur": 3.5,
                  "base": "recu"
                }
              ]
            }
          ]
        },
        "versMaroc": {
          "actif": true,
          "moyenPaiement": "MTN Money",
          "paliers": [
            {
              "aPartirDe": 0,
              "taux": {
                "unite": "MAD",
                "valeur": 61
              },
              "frais": [
                {
                  "id": "operateur",
                  "libelle": "Frais MTN Money",
                  "categorie": "operateur",
                  "type": "pourcentage",
                  "valeur": 3.5,
                  "base": "envoye"
                },
                {
                  "id": "service",
                  "libelle": "Frais de service MoneyUp",
                  "categorie": "moneyup",
                  "type": "pourcentage",
                  "valeur": 10,
                  "base": "envoye"
                }
              ]
            }
          ]
        }
      }
    },
    {
      "id": "togo",
      "nom": "Togo",
      "drapeau": "🇹🇬",
      "devise": "XOF",
      "actif": true,
      "corridors": {
        "depuisMaroc": {
          "actif": true,
          "moyenPaiement": "Mixx by Yas",
          "paliers": [
            {
              "aPartirDe": 0,
              "taux": {
                "unite": "MAD",
                "valeur": 60
              },
              "frais": [
                {
                  "id": "service",
                  "libelle": "Frais de service MoneyUp",
                  "categorie": "moneyup",
                  "type": "pourcentage",
                  "valeur": 4,
                  "base": "envoye"
                },
                {
                  "id": "retrait",
                  "libelle": "Frais de retrait Mixx by Yas",
                  "categorie": "operateur",
                  "type": "bareme",
                  "bareme": [
                    {
                      "jusqua": 500,
                      "frais": 50
                    },
                    {
                      "jusqua": 5000,
                      "frais": 100
                    },
                    {
                      "jusqua": 20000,
                      "frais": 300
                    },
                    {
                      "jusqua": 50000,
                      "frais": 600
                    },
                    {
                      "jusqua": 100000,
                      "frais": 1000
                    },
                    {
                      "jusqua": 200000,
                      "frais": 3100
                    },
                    {
                      "jusqua": 300000,
                      "frais": 3700
                    },
                    {
                      "jusqua": 500000,
                      "frais": 4200
                    },
                    {
                      "jusqua": 850000,
                      "frais": 4400
                    },
                    {
                      "jusqua": 900000,
                      "frais": 4600
                    },
                    {
                      "jusqua": 950000,
                      "frais": 4900
                    },
                    {
                      "jusqua": 1000000,
                      "frais": 5100
                    }
                  ],
                  "cycle": true,
                  "base": "recu"
                }
              ]
            }
          ]
        },
        "versMaroc": {
          "actif": true,
          "moyenPaiement": null,
          "paliers": [
            {
              "aPartirDe": 0,
              "taux": {
                "unite": "MAD",
                "valeur": 60
              },
              "frais": [
                {
                  "id": "service",
                  "libelle": "Frais de service MoneyUp",
                  "categorie": "moneyup",
                  "type": "pourcentage",
                  "valeur": 4,
                  "base": "envoye"
                }
              ]
            }
          ]
        }
      }
    },
    {
      "id": "france",
      "nom": "France",
      "drapeau": "🇫🇷",
      "devise": "EUR",
      "actif": true,
      "corridors": {
        "depuisMaroc": {
          "actif": true,
          "moyenPaiement": null,
          "paliers": [
            {
              "aPartirDe": 0,
              "taux": {
                "unite": "EUR",
                "valeur": 11
              },
              "frais": [
                {
                  "id": "service",
                  "libelle": "Frais de service MoneyUp",
                  "categorie": "moneyup",
                  "type": "pourcentage",
                  "valeur": 10,
                  "base": "envoye"
                }
              ]
            }
          ]
        },
        "versMaroc": {
          "actif": true,
          "moyenPaiement": null,
          "paliers": [
            {
              "aPartirDe": 0,
              "taux": {
                "unite": "EUR",
                "valeur": 10.7
              },
              "frais": [
                {
                  "id": "service",
                  "libelle": "Frais de service MoneyUp",
                  "categorie": "moneyup",
                  "type": "pourcentage",
                  "valeur": 5,
                  "base": "envoye"
                }
              ]
            }
          ]
        }
      }
    }
  ],
  "parametres": {
    "whatsapp": "212751527863",
    "modeFraisParDefaut": "deduit",
    "montantMinimum": 1,
    "messageAvertissement": "Cette simulation est indicative. Les conditions applicables et le montant définitif sont confirmés par MoneyUp avant validation du transfert."
  }
}
$json$::jsonb)
on conflict (id) do nothing;