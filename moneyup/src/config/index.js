// =========================================================
// POINT D'ACCÈS UNIQUE À LA CONFIGURATION
// ---------------------------------------------------------
// Le reste de l'application ne lit JAMAIS tarifs.js directement :
// il appelle chargerConfig().
// Aujourd'hui, la config vient des fichiers locaux.
// À l'étape 8 (espace admin), seule cette fonction changera
// pour lire les tarifs depuis Supabase. Rien d'autre à modifier.
// =========================================================

import { DEVISES } from './devises.js';
import { PAYS } from './tarifs.js';
import { PARAMETRES } from './parametres.js';

export async function chargerConfig() {
  // structuredClone = copie profonde, pour que personne ne modifie
  // les données d'origine par accident.
  return structuredClone({
    devises: DEVISES,
    pays: PAYS.filter((p) => p.actif),
    parametres: PARAMETRES,
  });
}

// Petit utilitaire : texte lisible d'un taux, ex. "1 MAD = 60 XAF"
export function texteTaux(taux, devisePays) {
  const autre = taux.unite === 'MAD' ? devisePays : 'MAD';
  return `1 ${taux.unite} = ${taux.valeur.toLocaleString('fr-FR')} ${autre}`;
}