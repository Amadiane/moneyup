// =========================================================
// INTERFACE DU SIMULATEUR
// ---------------------------------------------------------
// Principe : un objet "etat" contient les choix du client.
// À chaque changement : on met à jour l'état, puis on redessine
// les boutons (rendreChoix) et la carte de résultat (rendreResultat).
// Aucun calcul ici : tout passe par simuler() du moteur.
// =========================================================

import { simuler } from '../engine/simulateur.js';
import { formatMontant, libelleDevise, texteTaux } from './format.js';
import { construireMessage, lienWhatsApp } from './whatsapp.js';

// ---- petits morceaux de HTML réutilisables ----
const drapeau = (fichier, alt = '') =>
  `<img class="drapeau" src="/drapeaux/${fichier}.svg" alt="${alt}" width="24" height="16" />`;

// Drapeau associé à une devise dans le corridor choisi
const drapeauDevise = (code, pays) => drapeau(code === 'MAD' ? 'maroc' : pays.id);

function bouton(champ, valeur, actif, contenu, desactive = false) {
  return `
    <button type="button" class="choix__btn${actif ? ' is-actif' : ''}"
      data-champ="${champ}" data-valeur="${valeur}"
      aria-pressed="${actif}" ${desactive ? 'disabled' : ''}>
      ${contenu}
    </button>`;
}

export function monterSimulateur(conteneur, config) {
  // ---------------------------------------------------------
  // ÉTAT : les choix actuels du client
  // ---------------------------------------------------------
  const etat = {
    paysId: config.pays[0].id,
    sens: 'depuisMaroc',
    deviseSaisie: 'MAD',
    montant: '1000',
    modeFrais: config.parametres.modeFraisParDefaut,
  };

  const paysActuel = () => config.pays.find((p) => p.id === etat.paysId);
  // [devise d'envoi, devise de réception]
  const devisesCorridor = () => {
    const p = paysActuel();
    return etat.sens === 'depuisMaroc' ? ['MAD', p.devise] : [p.devise, 'MAD'];
  };
  const fm = (valeur, code) => formatMontant(valeur, code, config.devises[code].decimales);

  // ---------------------------------------------------------
  // SQUELETTE (dessiné une seule fois)
  // ---------------------------------------------------------
  conteneur.innerHTML = `
    <div class="simu">
      <form class="carte simu__form" novalidate>
        <h2 class="carte__titre">Configurez votre transfert</h2>

        <div class="champ">
          <span class="champ__label">Pays concerné</span>
          <div class="choix choix--pays" id="choix-pays"></div>
        </div>

        <div class="champ">
          <span class="champ__label">Sens du transfert</span>
          <div class="choix choix--2" id="choix-sens"></div>
          <p class="champ__aide" id="aide-sens"></p>
        </div>

        <div class="champ">
          <span class="champ__label">Je saisis le montant en</span>
          <div class="choix choix--2" id="choix-devise"></div>
        </div>

        <div class="champ">
          <label class="champ__label" for="montant" id="label-montant"></label>
          <div class="saisie">
            <input id="montant" name="montant" type="text" inputmode="decimal"
              autocomplete="off" value="${etat.montant}" />
            <span class="saisie__devise" id="suffixe-montant"></span>
          </div>
          <p class="champ__aide" id="aide-montant"></p>
        </div>

        <div class="champ">
          <span class="champ__label">Frais</span>
          <div class="choix choix--2" id="choix-mode"></div>
        </div>
      </form>

      <aside class="simu__resultat">
        <h2 class="carte__titre">Estimation de votre transfert</h2>
        <div id="resultat" aria-live="polite"></div>
        <p class="avertissement">${config.parametres.messageAvertissement}</p>
      </aside>
    </div>`;

  const $ = (sel) => conteneur.querySelector(sel);

  // ---------------------------------------------------------
  // BOUTONS DE CHOIX
  // ---------------------------------------------------------
  function rendreChoix() {
    const p = paysActuel();
    const [envoi, recu] = devisesCorridor();

    $('#choix-pays').innerHTML = config.pays
      .map((pays) => bouton('paysId', pays.id, pays.id === etat.paysId, `${drapeau(pays.id)}<span>${pays.nom}</span>`))
      .join('');

    $('#choix-sens').innerHTML =
      bouton('sens', 'depuisMaroc', etat.sens === 'depuisMaroc', "J'envoie de l'argent", !p.corridors.depuisMaroc?.actif) +
      bouton('sens', 'versMaroc', etat.sens === 'versMaroc', "Je reçois de l'argent", !p.corridors.versMaroc?.actif);

    const moyen = p.corridors[etat.sens]?.moyenPaiement;
    $('#aide-sens').textContent =
      (etat.sens === 'depuisMaroc' ? `Depuis le Maroc vers ${p.nom}` : `Depuis ${p.nom} vers le Maroc`) +
      (moyen ? ` · via ${moyen}` : '');

    $('#choix-devise').innerHTML = [envoi, recu]
      .map((code) => bouton('deviseSaisie', code, code === etat.deviseSaisie,
        `${drapeauDevise(code, p)}<span>${config.devises[code].nom} (${libelleDevise(code)})</span>`))
      .join('');

    const saisitEnvoi = etat.deviseSaisie === envoi;
    $('#label-montant').textContent = saisitEnvoi
      ? 'Montant envoyé'
      : 'Montant que le bénéficiaire doit recevoir';
    $('#aide-montant').textContent = saisitEnvoi
      ? 'On calcule ce que le bénéficiaire reçoit.'
      : 'On calcule combien il faut envoyer.';
    $('#suffixe-montant').textContent = etat.deviseSaisie;

    $('#choix-mode').innerHTML =
      bouton('modeFrais', 'deduit', etat.modeFrais === 'deduit', 'Déduits du montant') +
      bouton('modeFrais', 'ajoute', etat.modeFrais === 'ajoute', 'Ajoutés à mon paiement');
  }

  // ---------------------------------------------------------
  // CARTE DE RÉSULTAT
  // ---------------------------------------------------------
  function ligne(libelle, valeur, classe = '') {
    return `<div class="ligne ${classe}"><span>${libelle}</span><strong>${valeur}</strong></div>`;
  }

  function libelleFrais(f) {
    return f.pourcentage !== null ? `${f.libelle} (${String(f.pourcentage).replace('.', ',')} %)` : f.libelle;
  }

  function rendreResultat() {
    const r = simuler(config, etat);

    if (!r.ok) {
      $('#resultat').innerHTML = `<div class="resultat resultat--vide"><p>${r.message}</p></div>`;
      return;
    }

    const env = r.deviseEnvoi;
    const rec = r.deviseRecu;

    const entete = r.calcul === 'direct'
      ? `<p class="resultat__label">Le bénéficiaire reçoit environ</p>
         <p class="resultat__montant">${fm(r.netRecu, rec)}</p>
         <p class="resultat__sous">Vous payez ${fm(r.totalAPayer, env)}</p>`
      : `<p class="resultat__label">Vous devez payer environ</p>
         <p class="resultat__montant">${fm(r.totalAPayer, env)}</p>
         <p class="resultat__sous">pour que le bénéficiaire reçoive ${fm(r.netRecu, rec)}</p>`;

    const lignes = [
      ligne('Taux appliqué', texteTaux(r.taux)),
      ligne('Montant envoyé', fm(r.montantEnvoye, env)),
      ...r.fraisEnvoi.map((f) => ligne(libelleFrais(f), fm(f.montant, env))),
      ligne('Montant converti', fm(r.montantConverti, rec)),
      ...r.fraisRecu.map((f) => ligne(libelleFrais(f), fm(f.montant, rec))),
    ];
    if (r.modeFrais === 'ajoute' && r.fraisRecuPayesEnEnvoi > 0) {
      lignes.push(ligne('Frais de retrait réglés par vous', fm(r.fraisRecuPayesEnEnvoi, env)));
    }

    const note = r.modeFrais === 'deduit'
      ? 'Les frais sont déduits : le bénéficiaire reçoit le montant net ci-dessus.'
      : 'Les frais sont ajoutés à votre paiement : le bénéficiaire reçoit le montant converti complet.';

    $('#resultat').innerHTML = `
      <div class="resultat">
        ${entete}
        <div class="resultat__lignes">
          ${lignes.join('')}
          <div class="resultat__sep"></div>
          ${ligne('Total à payer', fm(r.totalAPayer, env), 'ligne--fort')}
          ${ligne('Net reçu par le bénéficiaire', fm(r.netRecu, rec), 'ligne--fort')}
        </div>
        <p class="resultat__note">${note}</p>
        ${boutonWhatsApp(r)}
      </div>`;
  }

  // ---------------------------------------------------------
  // BOUTON WHATSAPP (étape 5)
  // Masqué si aucun numéro n'est configuré.
  // ---------------------------------------------------------
  function boutonWhatsApp(r) {
    const numero = config.parametres.whatsapp;
    if (!numero) return '';
    const lien = lienWhatsApp(numero, construireMessage(r, config));
    return `
      <a class="btn-whatsapp" href="${lien}" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path fill="currentColor" d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm3 6.5a1.5 1.5 0 1 0 0 .01zm5 0a1.5 1.5 0 1 0 0 .01zm5 0a1.5 1.5 0 1 0 0 .01z"/>
        </svg>
        Continuer sur WhatsApp
      </a>`;
  }

  // ---------------------------------------------------------
  // ÉVÉNEMENTS
  // ---------------------------------------------------------
  conteneur.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-champ]');
    if (!btn || btn.disabled) return;
    const { champ, valeur } = btn.dataset;
    etat[champ] = valeur;

    // nouveau pays ou nouveau sens : on revient à la devise d'envoi
    if (champ === 'paysId' || champ === 'sens') {
      const p = paysActuel();
      if (!p.corridors[etat.sens]?.actif) {
        etat.sens = etat.sens === 'depuisMaroc' ? 'versMaroc' : 'depuisMaroc';
      }
      etat.deviseSaisie = devisesCorridor()[0];
    }
    rendreChoix();
    rendreResultat();
  });

  $('#montant').addEventListener('input', (e) => {
    etat.montant = e.target.value;
    rendreResultat();
  });

  // Entrée dans le champ ne doit pas recharger la page
  $('.simu__form').addEventListener('submit', (e) => e.preventDefault());

  rendreChoix();
  rendreResultat();
}