// =========================================================
// INTÉGRATION WHATSAPP (cahier des charges §8)
// ---------------------------------------------------------
// On construit un message texte à partir du résultat de simuler(),
// puis un lien https://wa.me/<numéro>?text=<message>.
// Ce lien ouvre WhatsApp (application ou web) avec le message
// déjà écrit : le client n'a plus qu'à appuyer sur "Envoyer".
// =========================================================

import { formatNombre, texteTaux } from './format.js';

// Dans un message WhatsApp, on écrit les codes devises (MAD, XAF…)
// et des espaces normaux (certains téléphones affichent mal les espaces spéciaux).
function montantTexte(valeur, code, decimales) {
  return `${formatNombre(valeur, decimales).replace(/[  ]/g, ' ')} ${code}`;
}

/**
 * Construit le texte du message à partir d'un résultat de simulation.
 * Seuls les frais utiles au corridor apparaissent (un frais à 0 est omis).
 */
export function construireMessage(r, config) {
  const dec = (code) => config.devises[code].decimales;
  const m = (valeur, code) => montantTexte(valeur, code, dec(code));

  const lignes = [
    'Bonjour MoneyUp,',
    'Je souhaite effectuer un transfert.',
    '',
    `Pays : ${r.pays.nom}`,
    `Sens : ${r.sensLibelle}`,
  ];
  if (r.moyenPaiement) lignes.push(`Moyen : ${r.moyenPaiement}`);

  lignes.push(
    `Montant de départ : ${m(r.montantEnvoye, r.deviseEnvoi)}`,
    `Montant estimé à recevoir : ${m(r.netRecu, r.deviseRecu)}`,
    `Taux : ${texteTaux(r.taux).replace(/[  ]/g, ' ')}`,
  );

  for (const f of r.fraisEnvoi) {
    if (f.montant === 0) continue; // frais nul ou offert par un code promo
    const nom = f.categorie === 'moneyup' ? 'Frais MoneyUp' : f.libelle;
    const pct = f.pourcentage !== null ? `${String(f.pourcentage).replace('.', ',')} % ` : '';
    lignes.push(`${nom} : ${pct}(${m(f.montant, r.deviseEnvoi)})`);
  }
  for (const f of r.fraisRecu) {
    if (f.montant === 0) continue;
    lignes.push(`${f.libelle} : ${m(f.montant, r.deviseRecu)}`);
  }

  if (r.promo?.applique) lignes.push(`Code promo : ${r.promo.code} (${r.promo.libelle})`);

  lignes.push(
    `Frais : ${r.modeFrais === 'deduit' ? 'déduits du montant' : 'ajoutés à mon paiement'}`,
    `Total à payer : ${m(r.totalAPayer, r.deviseEnvoi)}`,
    '',
    'Merci de me confirmer les modalités du transfert.',
  );

  return lignes.join('\n');
}

/** Lien wa.me. Le numéro doit être au format international sans "+" ni espaces. */
export function lienWhatsApp(numero, message) {
  const propre = String(numero).replace(/\D/g, '');
  return `https://wa.me/${propre}?text=${encodeURIComponent(message)}`;
}