// =========================================================
// POINT D'ACCÈS UNIQUE À LA CONFIGURATION
// ---------------------------------------------------------
// Étape 6 : les tarifs sont lus en priorité dans Supabase
// (là où l'admin les modifie). Si Supabase est injoignable,
// on utilise les tarifs locaux (tarifs.js / parametres.js)
// pour que le simulateur ne tombe jamais en panne.
// =========================================================

import { DEVISES } from './devises.js';
import { PAYS } from './tarifs.js';
import { PARAMETRES } from './parametres.js';
import { supabase } from './supabase.js';

async function lireTarifsEnLigne() {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('configuration')
      .select('donnees')
      .eq('id', 1)
      .single();
    if (error) throw error;
    return data?.donnees?.pays ? data.donnees : null;
  } catch (err) {
    console.warn('Tarifs en ligne indisponibles : utilisation des tarifs locaux.', err);
    return null;
  }
}

export async function chargerConfig() {
  const enLigne = await lireTarifsEnLigne();
  const pays = enLigne?.pays ?? PAYS;
  const parametres = { ...PARAMETRES, ...(enLigne?.parametres ?? {}) };

  // structuredClone = copie profonde, pour que personne ne modifie
  // les données d'origine par accident.
  return structuredClone({
    devises: DEVISES,
    pays: pays.filter((p) => p.actif),
    parametres,
    source: enLigne ? 'supabase' : 'local',
  });
}

// Petit utilitaire : texte lisible d'un taux, ex. "1 MAD = 60 XAF"
export function texteTaux(taux, devisePays) {
  const autre = taux.unite === 'MAD' ? devisePays : 'MAD';
  return `1 ${taux.unite} = ${taux.valeur.toLocaleString('fr-FR')} ${autre}`;
}