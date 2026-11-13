// =========================================================
// CALCUL D'UN FRAIS (pourcentage ou barème)
// =========================================================

import { Decimal } from './conversion.js';

/**
 * Frais selon un barème à tranches (ex. Mixx by Yas).
 * "jusqua" est inclusif : 500 -> 1re tranche, 501 -> 2e tranche.
 *
 * cycle = true : au-delà du dernier plafond (1 000 000), le montant est
 * découpé en blocs de ce plafond, chaque bloc suivant le barème.
 *   1 500 000 -> 1 000 000 (5 100) + 500 000 (4 200) = 9 300
 *   2 000 000 -> 5 100 + 5 100 = 10 200
 *
 * Renvoie null si le montant n'est couvert par aucune tranche
 * ou si la tranche n'a pas de frais confirmé.
 */
export function fraisBareme(montant, bareme, cycle = false) {
  let reste = new Decimal(montant);
  if (reste.lte(0)) return new Decimal(0);

  const derniere = bareme[bareme.length - 1];
  const plafond = new Decimal(derniere.jusqua);
  let total = new Decimal(0);

  if (reste.gt(plafond)) {
    if (!cycle || derniere.frais == null) return null;
    const blocs = reste.dividedToIntegerBy(plafond);
    total = total.plus(blocs.times(derniere.frais));
    reste = reste.minus(blocs.times(plafond));
    if (reste.isZero()) return total;
  }

  const tranche = bareme.find((t) => reste.lte(t.jusqua));
  if (!tranche || tranche.frais == null) return null;
  return total.plus(tranche.frais);
}

/**
 * Montant d'un frais de la config appliqué à une base.
 * Renvoie un Decimal, ou null si le frais ne peut pas être calculé.
 */
export function montantFrais(frais, base) {
  if (frais.type === 'pourcentage') {
    return new Decimal(base).times(frais.valeur).dividedBy(100);
  }
  if (frais.type === 'bareme') {
    return fraisBareme(base, frais.bareme, frais.cycle);
  }
  throw new Error(`Type de frais inconnu : ${frais.type}`);
}