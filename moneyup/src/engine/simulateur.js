// =========================================================
// MOTEUR DE SIMULATION MONEYUP
// ---------------------------------------------------------
// Une seule fonction publique : simuler(config, demande).
// Elle ne touche jamais à l'affichage (cahier des charges §6) :
// elle reçoit des données, elle renvoie un résultat.
//
// VOCABULAIRE
//   devise d'envoi  : celle de la personne qui envoie
//                     (MAD si depuisMaroc, devise du pays si versMaroc)
//   devise de réception : l'autre
//   montant envoyé  : le montant de départ, base des frais "envoye"
//   montant converti: ce qui arrive dans la devise de réception, avant frais opérateur
//   net reçu        : ce que le bénéficiaire touche réellement
//
// MODE DES FRAIS (choisi par le client)
//   'deduit' : il paie le montant envoyé, les frais sont retirés en chemin
//   'ajoute' : les frais s'ajoutent à ce qu'il paie, le bénéficiaire
//              reçoit le montant converti complet
//
// SAISIE : le montant saisi est TOUJOURS le montant de départ.
//   - saisi dans la devise d'envoi    -> utilisé tel quel
//   - saisi dans la devise de réception -> converti au taux MoneyUp
//     (100 EUR = 1 100 MAD), puis même calcul.
// =========================================================

import { Decimal, convertir, arrondir } from './conversion.js';
import { montantFrais } from './frais.js';

const MONTANT_MAXIMUM = 1_000_000_000;

export const MESSAGES = {
  PAYS_INCONNU: "Ce pays n'est pas disponible.",
  CORRIDOR_INACTIF: "Ce sens de transfert n'est pas disponible pour le moment.",
  DEVISE_INVALIDE: "Cette devise n'est pas disponible pour ce transfert.",
  MODE_INVALIDE: 'Mode de frais inconnu.',
  MONTANT_VIDE: 'Saisissez un montant.',
  MONTANT_INVALIDE: 'Le montant doit être un nombre (ex. 1500 ou 1500,50).',
  MONTANT_NEGATIF: 'Le montant ne peut pas être négatif.',
  MONTANT_TROP_PETIT: 'Le montant est trop petit.',
  MONTANT_TROP_GRAND: 'Le montant est trop élevé pour une simulation.',
  FRAIS_TROP_ELEVES: 'Le montant ne couvre pas les frais.',
  FRAIS_A_CONFIRMER: 'Les frais pour ce montant sont à confirmer avec MoneyUp.',
};

function erreur(code) {
  return { ok: false, code, message: MESSAGES[code] };
}

// ---------------------------------------------------------
// Lecture de la saisie : accepte "1 500", "1500,50", 1500…
// ---------------------------------------------------------
export function lireMontant(saisie) {
  const texte = String(saisie ?? '').replace(/[\s  ]/g, '').replace(',', '.');
  if (texte === '') return { code: 'MONTANT_VIDE' };
  if (texte.startsWith('-')) return { code: 'MONTANT_NEGATIF' };
  if (!/^\d+(\.\d+)?$/.test(texte)) return { code: 'MONTANT_INVALIDE' };
  return { valeur: new Decimal(texte) };
}

// ---------------------------------------------------------
// Palier : celui dont "aPartirDe" est le plus grand <= montant envoyé
// ---------------------------------------------------------
function paliersTries(corridor) {
  return [...corridor.paliers].sort((a, b) => a.aPartirDe - b.aPartirDe);
}

function choisirPalier(corridor, montantEnvoye) {
  const paliers = paliersTries(corridor);
  let choisi = paliers[0];
  for (const p of paliers) if (montantEnvoye.gte(p.aPartirDe)) choisi = p;
  return choisi;
}

// Somme des frais d'une liste, chaque frais arrondi à la devise.
// Renvoie { lignes, total } ou null si un frais n'est pas calculable.
function calculerFrais(listeFrais, base, devise, decimales) {
  const lignes = [];
  let total = new Decimal(0);
  for (const f of listeFrais) {
    const brut = montantFrais(f, base);
    if (brut === null) return null;
    const montant = arrondir(brut, decimales);
    total = total.plus(montant);
    lignes.push({
      id: f.id,
      libelle: f.libelle,
      categorie: f.categorie,
      type: f.type,
      pourcentage: f.type === 'pourcentage' ? f.valeur : null,
      montant,
      devise,
    });
  }
  return { lignes, total };
}

// ---------------------------------------------------------
// CALCUL DIRECT : à partir du montant envoyé
// ---------------------------------------------------------
function calculDirect(ctx, montantEnvoye) {
  const { corridor, mode, deviseEnvoi, deviseRecu, decEnvoi, decRecu } = ctx;
  const palier = choisirPalier(corridor, montantEnvoye);

  // 1. Frais calculés sur le montant envoyé (MoneyUp, Airtel côté envoi…)
  const fraisEnvoi = calculerFrais(
    palier.frais.filter((f) => f.base === 'envoye'), montantEnvoye, deviseEnvoi, decEnvoi,
  );
  if (!fraisEnvoi) return erreur('FRAIS_A_CONFIRMER');

  // 2. Montant réellement converti
  const aConvertir = mode === 'deduit' ? montantEnvoye.minus(fraisEnvoi.total) : montantEnvoye;
  if (aConvertir.lte(0)) return erreur('FRAIS_TROP_ELEVES');
  const converti = arrondir(convertir(aConvertir, palier.taux, deviseEnvoi, deviseRecu), decRecu);

  // 3. Frais calculés sur le montant converti (retrait Airtel, MTN, Mixx…)
  const fraisRecu = calculerFrais(
    palier.frais.filter((f) => f.base === 'recu'), converti, deviseRecu, decRecu,
  );
  if (!fraisRecu) return erreur('FRAIS_A_CONFIRMER');

  // 4. Ce que le bénéficiaire touche et ce que l'expéditeur paie
  let netRecu, totalAPayer, fraisRecuPayesEnEnvoi;
  if (mode === 'deduit') {
    netRecu = converti.minus(fraisRecu.total);
    totalAPayer = montantEnvoye;
    fraisRecuPayesEnEnvoi = new Decimal(0);
  } else {
    netRecu = converti;
    // les frais opérateur sont réglés par l'expéditeur, convertis dans sa devise
    fraisRecuPayesEnEnvoi = arrondir(
      convertir(fraisRecu.total, palier.taux, deviseRecu, deviseEnvoi), decEnvoi, 'haut',
    );
    totalAPayer = montantEnvoye.plus(fraisEnvoi.total).plus(fraisRecuPayesEnEnvoi);
  }
  if (netRecu.lte(0)) return erreur('FRAIS_TROP_ELEVES');

  return {
    ok: true,
    palier,
    montantEnvoye,
    fraisEnvoi: fraisEnvoi.lignes,
    montantConverti: converti,
    fraisRecu: fraisRecu.lignes,
    fraisRecuPayesEnEnvoi,
    netRecu,
    totalAPayer,
  };
}

// ---------------------------------------------------------
// SAISIE DANS LA DEVISE DE RÉCEPTION
// Règle validée par MoneyUp : le montant saisi est TOUJOURS le
// montant de départ, simplement exprimé dans l'autre devise.
//   100 EUR saisis (1 EUR = 11 MAD) = 1 100 MAD envoyés.
// On convertit donc la saisie en devise d'envoi, puis on fait
// exactement le même calcul qu'une saisie directe.
//   Déduits : 1 100 DH payés, 10 % retirés -> 90 EUR reçus
//   Ajoutés : 1 210 DH payés                -> 100 EUR reçus
// ---------------------------------------------------------
function calculDepuisDeviseRecu(ctx, montantSaisi) {
  const { corridor, deviseEnvoi, deviseRecu, decEnvoi } = ctx;
  const paliers = paliersTries(corridor);
  let retenu = null;

  // Le taux dépend du palier, et le palier dépend du montant envoyé :
  // on essaie chaque palier et on garde celui qui est cohérent.
  paliers.forEach((palier, i) => {
    let envoye = arrondir(convertir(montantSaisi, palier.taux, deviseRecu, deviseEnvoi), decEnvoi);
    if (envoye.lt(palier.aPartirDe)) envoye = new Decimal(palier.aPartirDe);
    const suivant = paliers[i + 1];
    if (suivant && envoye.gte(suivant.aPartirDe)) return;
    if (!retenu || envoye.lt(retenu)) retenu = envoye;
  });

  if (!retenu) return erreur('FRAIS_A_CONFIRMER');
  return calculDirect(ctx, retenu);
}

// ---------------------------------------------------------
// FONCTION PUBLIQUE
// demande = { paysId, sens: 'depuisMaroc'|'versMaroc', deviseSaisie, montant, modeFrais }
// ---------------------------------------------------------
export function simuler(config, demande) {
  const { paysId, sens, deviseSaisie, montant } = demande;
  const mode = demande.modeFrais ?? config.parametres.modeFraisParDefaut;

  const pays = config.pays.find((p) => p.id === paysId);
  if (!pays) return erreur('PAYS_INCONNU');
  const corridor = pays.corridors?.[sens];
  if (!corridor?.actif) return erreur('CORRIDOR_INACTIF');
  if (mode !== 'deduit' && mode !== 'ajoute') return erreur('MODE_INVALIDE');

  const deviseEnvoi = sens === 'depuisMaroc' ? 'MAD' : pays.devise;
  const deviseRecu = sens === 'depuisMaroc' ? pays.devise : 'MAD';
  if (deviseSaisie !== deviseEnvoi && deviseSaisie !== deviseRecu) return erreur('DEVISE_INVALIDE');

  const lu = lireMontant(montant);
  if (lu.code) return erreur(lu.code);
  const valeur = lu.valeur;
  if (valeur.lt(config.parametres.montantMinimum ?? 1)) return erreur('MONTANT_TROP_PETIT');
  if (valeur.gt(MONTANT_MAXIMUM)) return erreur('MONTANT_TROP_GRAND');

  const ctx = {
    corridor, mode, deviseEnvoi, deviseRecu,
    decEnvoi: config.devises[deviseEnvoi].decimales,
    decRecu: config.devises[deviseRecu].decimales,
  };

  const calcul = deviseSaisie === deviseEnvoi ? 'direct' : 'inverse';
  const saisieArrondie = arrondir(valeur, config.devises[deviseSaisie].decimales);
  const r = calcul === 'direct' ? calculDirect(ctx, saisieArrondie) : calculDepuisDeviseRecu(ctx, saisieArrondie);
  if (!r.ok) return r;

  // Résultat final en nombres simples, prêt pour l'affichage
  const n = (d) => d.toNumber();
  const ligne = (l) => ({ ...l, montant: n(l.montant) });
  return {
    ok: true,
    calcul,
    pays: { id: pays.id, nom: pays.nom, drapeau: pays.drapeau },
    sens,
    sensLibelle: sens === 'depuisMaroc' ? `Maroc → ${pays.nom}` : `${pays.nom} → Maroc`,
    moyenPaiement: corridor.moyenPaiement,
    modeFrais: mode,
    deviseSaisie,
    montantSaisi: n(saisieArrondie),
    deviseEnvoi,
    deviseRecu,
    taux: { ...r.palier.taux, autre: r.palier.taux.unite === 'MAD' ? pays.devise : 'MAD' },
    montantEnvoye: n(r.montantEnvoye),
    fraisEnvoi: r.fraisEnvoi.map(ligne),
    montantConverti: n(r.montantConverti),
    fraisRecu: r.fraisRecu.map(ligne),
    fraisRecuPayesEnEnvoi: n(r.fraisRecuPayesEnEnvoi),
    totalAPayer: n(r.totalAPayer),
    netRecu: n(r.netRecu),
  };
}