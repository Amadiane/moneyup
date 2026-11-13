// =========================================================
// CONVERSION ET ARRONDIS
// On utilise decimal.js au lieu des nombres JavaScript classiques,
// car 0.1 + 0.2 = 0.30000000000000004 en JavaScript :
// inacceptable pour de l'argent (cahier des charges §6).
// =========================================================

import Decimal from 'decimal.js';

export { Decimal };

/**
 * Convertit un montant d'une devise à l'autre avec un taux MoneyUp.
 * Le taux { unite: 'MAD', valeur: 60 } se lit « 1 MAD = 60 (autre devise) ».
 *   - si on part de l'unité  -> on MULTIPLIE  (1 000 MAD -> 60 000 XAF)
 *   - si on va vers l'unité  -> on DIVISE     (60 000 XAF -> 1 000 MAD)
 */
export function convertir(montant, taux, de, vers) {
  const m = new Decimal(montant);
  if (de === vers) return m;
  if (de === taux.unite) return m.times(taux.valeur);
  if (vers === taux.unite) return m.dividedBy(taux.valeur);
  throw new Error(`Le taux en ${taux.unite} ne permet pas de convertir ${de} -> ${vers}`);
}

/**
 * Arrondit selon le nombre de décimales de la devise.
 * Par défaut : arrondi commercial (0,5 -> au-dessus).
 * 'haut' : toujours vers le haut (utilisé pour qu'un montant à payer
 * ne soit jamais sous-estimé).
 */
export function arrondir(montant, decimales, sens = 'commercial') {
  const mode = sens === 'haut' ? Decimal.ROUND_UP : Decimal.ROUND_HALF_UP;
  return new Decimal(montant).toDecimalPlaces(decimales, mode);
}