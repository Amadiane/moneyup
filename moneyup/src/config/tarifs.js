// =========================================================
// TARIFS MONEYUP  (cahier des charges v1.1, §4 et §5)
// ---------------------------------------------------------
// C'est CE fichier que l'espace admin remplacera plus tard.
// Aucune règle de calcul ici : uniquement des données.
//
// COMMENT LIRE UN CORRIDOR
//   depuisMaroc : le client envoie depuis le Maroc  (MAD -> devise du pays)
//   versMaroc   : le client reçoit au Maroc         (devise du pays -> MAD)
//
// COMMENT LIRE UN TAUX
//   { unite: 'MAD', valeur: 60 }  =>  1 MAD = 60 (devise du pays)
//   { unite: 'EUR', valeur: 11 }  =>  1 EUR = 11 MAD
//
// PALIERS
//   Chaque corridor a au moins un palier. Le moteur choisit le palier
//   dont "aPartirDe" est le plus grand possible <= montant envoyé
//   (mesuré dans la devise envoyée). Exemple : Gabon -> Maroc.
//
// FRAIS
//   categorie : 'moneyup' (frais de service) ou 'operateur' (Airtel, MTN, Mixx)
//               -> jamais confondus à l'affichage (§7).
//   type      : 'pourcentage' (valeur en %) ou 'bareme' (grille en montant fixe)
//   base      : 'envoye' = calculé sur le montant envoyé
//               'recu'   = calculé sur le montant converti (côté bénéficiaire)
//   Le choix "frais déduits" ou "frais ajoutés" est fait par LE CLIENT
//   dans le simulateur (voir parametres.js), pas ici.
// =========================================================

// ---- Barème des frais de retrait Mixx by Yas – Togo (§5) ----
// "jusqua" est inclusif : 500 -> tranche 1 à 500, 501 -> tranche suivante.
// Décision MoneyUp : le barème s'arrête à 1 000 000 puis le cycle reprend.
// Au-delà, le montant est découpé en blocs de 1 000 000, chaque bloc
// suivant le barème. Ex. 1 500 000 = 1 000 000 (5 100) + 500 000 (4 200) = 9 300.
// (activé par "cycle: true" sur le frais Mixx, plus bas)
export const BAREME_MIXX_BY_YAS = [
  { jusqua: 500, frais: 50 },
  { jusqua: 5000, frais: 100 },
  { jusqua: 20000, frais: 300 },
  { jusqua: 50000, frais: 600 },
  { jusqua: 100000, frais: 1000 },
  { jusqua: 200000, frais: 3100 },
  { jusqua: 300000, frais: 3700 },
  { jusqua: 500000, frais: 4200 },
  { jusqua: 850000, frais: 4400 },
  { jusqua: 900000, frais: 4600 },
  { jusqua: 950000, frais: 4900 },
  { jusqua: 1000000, frais: 5100 },
];

export const PAYS = [
  // ------------------------------------------------- GABON
  {
    id: 'gabon',
    nom: 'Gabon',
    drapeau: '🇬🇦',
    devise: 'XAF',
    actif: true,
    corridors: {
      depuisMaroc: {
        actif: true,
        moyenPaiement: 'Airtel Money',
        paliers: [
          {
            aPartirDe: 0,
            taux: { unite: 'MAD', valeur: 60 },
            frais: [
              { id: 'service', libelle: 'Frais de service MoneyUp', categorie: 'moneyup', type: 'pourcentage', valeur: 0, base: 'envoye' },
              { id: 'retrait', libelle: 'Frais de retrait Airtel Money', categorie: 'operateur', type: 'pourcentage', valeur: 3, base: 'recu' },
            ],
          },
        ],
      },
      versMaroc: {
        actif: true,
        moyenPaiement: 'Airtel Money',
        paliers: [
          {
            aPartirDe: 0, // moins de 50 000 XAF
            taux: { unite: 'MAD', valeur: 68 },
            frais: [
              { id: 'operateur', libelle: 'Frais Airtel Money', categorie: 'operateur', type: 'pourcentage', valeur: 1.5, base: 'envoye' },
            ],
          },
          {
            aPartirDe: 50000, // à partir de 50 000 XAF
            taux: { unite: 'MAD', valeur: 67 },
            frais: [
              { id: 'operateur', libelle: 'Frais Airtel Money', categorie: 'operateur', type: 'pourcentage', valeur: 1, base: 'envoye' },
            ],
          },
        ],
      },
    },
  },

  // ------------------------------------------------- CONGO-BRAZZAVILLE
  {
    id: 'congo',
    nom: 'Congo-Brazzaville',
    drapeau: '🇨🇬',
    devise: 'XAF',
    actif: true,
    corridors: {
      depuisMaroc: {
        actif: true,
        moyenPaiement: 'MTN Money',
        paliers: [
          {
            aPartirDe: 0,
            taux: { unite: 'MAD', valeur: 60 },
            frais: [
              { id: 'service', libelle: 'Frais de service MoneyUp', categorie: 'moneyup', type: 'pourcentage', valeur: 0, base: 'envoye' },
              { id: 'retrait', libelle: 'Frais de retrait MTN Money', categorie: 'operateur', type: 'pourcentage', valeur: 3.5, base: 'recu' },
            ],
          },
        ],
      },
      versMaroc: {
        actif: true,
        moyenPaiement: 'MTN Money',
        paliers: [
          {
            aPartirDe: 0,
            taux: { unite: 'MAD', valeur: 61 },
            // Confirmé par MoneyUp : les deux frais sont calculés sur le montant de départ.
            frais: [
              { id: 'operateur', libelle: 'Frais MTN Money', categorie: 'operateur', type: 'pourcentage', valeur: 3.5, base: 'envoye' },
              { id: 'service', libelle: 'Frais de service MoneyUp', categorie: 'moneyup', type: 'pourcentage', valeur: 10, base: 'envoye' },
            ],
          },
        ],
      },
    },
  },

  // ------------------------------------------------- TOGO
  {
    id: 'togo',
    nom: 'Togo',
    drapeau: '🇹🇬',
    devise: 'XOF',
    actif: true,
    corridors: {
      depuisMaroc: {
        actif: true,
        moyenPaiement: 'Mixx by Yas',
        paliers: [
          {
            aPartirDe: 0,
            taux: { unite: 'MAD', valeur: 60 },
            frais: [
              { id: 'service', libelle: 'Frais de service MoneyUp', categorie: 'moneyup', type: 'pourcentage', valeur: 4, base: 'envoye' },
              { id: 'retrait', libelle: 'Frais de retrait Mixx by Yas', categorie: 'operateur', type: 'bareme', bareme: BAREME_MIXX_BY_YAS, cycle: true, base: 'recu' },
            ],
          },
        ],
      },
      versMaroc: {
        actif: true,
        moyenPaiement: null,
        paliers: [
          {
            aPartirDe: 0,
            taux: { unite: 'MAD', valeur: 60 },
            frais: [
              { id: 'service', libelle: 'Frais de service MoneyUp', categorie: 'moneyup', type: 'pourcentage', valeur: 4, base: 'envoye' },
            ],
          },
        ],
      },
    },
  },

  // ------------------------------------------------- FRANCE
  {
    id: 'france',
    nom: 'France',
    drapeau: '🇫🇷',
    devise: 'EUR',
    actif: true,
    corridors: {
      depuisMaroc: {
        actif: true,
        moyenPaiement: null,
        paliers: [
          {
            aPartirDe: 0,
            taux: { unite: 'EUR', valeur: 11 },
            frais: [
              { id: 'service', libelle: 'Frais de service MoneyUp', categorie: 'moneyup', type: 'pourcentage', valeur: 10, base: 'envoye' },
            ],
          },
        ],
      },
      versMaroc: {
        actif: true,
        moyenPaiement: null,
        paliers: [
          {
            aPartirDe: 0,
            taux: { unite: 'EUR', valeur: 10.7 },
            frais: [
              { id: 'service', libelle: 'Frais de service MoneyUp', categorie: 'moneyup', type: 'pourcentage', valeur: 5, base: 'envoye' },
            ],
          },
        ],
      },
    },
  },
];