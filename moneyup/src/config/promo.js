// =========================================================
// VÉRIFICATION D'UN CODE PROMO
// Le simulateur demande à Supabase si UN code précis est valable
// (fonction verifier_code_promo). Il ne peut jamais lister les codes.
// =========================================================

import { supabase } from './supabase.js';

export async function verifierCodePromo(saisie) {
  const code = String(saisie ?? '').trim().toUpperCase();
  if (!code) return { erreur: 'Saisissez un code promo.' };
  if (!supabase) return { erreur: 'Les codes promo ne sont pas disponibles pour le moment.' };

  const { data, error } = await supabase.rpc('verifier_code_promo', { p_code: code });
  if (error) return { erreur: 'Vérification impossible. Réessayez dans un instant.' };
  if (!data) return { erreur: 'Ce code est invalide ou a expiré.' };

  // les pourcentages arrivent comme texte ou nombre selon la base : on normalise
  const nombre = (v) => (v === null || v === undefined ? null : Number(v));
  return { promo: { ...data, fraisOperateur: nombre(data.fraisOperateur), fraisService: nombre(data.fraisService) } };
}