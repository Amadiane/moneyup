// =========================================================
// CODES PROMO
// ---------------------------------------------------------
// Un code promo (créé dans l'espace admin) ressemble à :
//   {
//     code: 'CG-7K3PQX',
//     libelle: 'Frais opérateur offerts + service à 9 %',
//     paysId: 'congo',
//     sens: 'tous' | 'depuisMaroc' | 'versMaroc',
//     fraisOperateur: 0,    // nouveau % des frais opérateur (0 = offerts), null = inchangé
//     fraisService: 9,      // nouveau % des frais de service MoneyUp, null = inchangé
//   }
//
// RÈGLES
// - Le code ne s'applique qu'à son pays et à son (ou ses) sens.
// - Une réduction ne peut JAMAIS augmenter un frais :
//   "service à 9 %" ne change rien là où le service est déjà à 0 %.
// - Un frais en barème (Mixx by Yas) peut seulement être offert (0).
// =========================================================

export function promoApplicable(promo, paysId, sens) {
  return Boolean(promo) && promo.paysId === paysId && (promo.sens === 'tous' || promo.sens === sens);
}

/**
 * Renvoie la liste des frais d'un palier après application du code.
 * Les frais réduits gardent leur valeur d'origine dans "valeurInitiale"
 * pour pouvoir afficher « 3,5 % → offert ».
 */
export function appliquerPromo(listeFrais, promo) {
  if (!promo) return listeFrais;

  return listeFrais.map((f) => {
    const nouveau =
      f.categorie === 'operateur' ? promo.fraisOperateur
      : f.categorie === 'moneyup' ? promo.fraisService
      : null;
    if (nouveau === null || nouveau === undefined) return f;

    if (f.type === 'pourcentage' && nouveau < f.valeur) {
      return { ...f, valeur: nouveau, valeurInitiale: f.valeur };
    }
    if (f.type === 'bareme' && nouveau === 0) {
      return { ...f, type: 'pourcentage', valeur: 0, valeurInitiale: 'bareme' };
    }
    return f;
  });
}

/** Texte lisible du corridor d'un code : « Congo-Brazzaville (les deux sens) » */
export function corridorPromo(promo, config) {
  const pays = config.pays.find((p) => p.id === promo.paysId);
  const nom = pays?.nom ?? promo.paysId;
  if (promo.sens === 'depuisMaroc') return `Maroc → ${nom}`;
  if (promo.sens === 'versMaroc') return `${nom} → Maroc`;
  return `${nom} (les deux sens)`;
}