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
import { verifierCodePromo } from '../config/promo.js';

// ---- petits morceaux de HTML réutilisables ----

// Neutralise < > & " ' dans les textes saisis par l'admin (noms des frais, message…)
const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const drapeau = (fichier, alt = '') =>
  `<img class="drapeau" src="/drapeaux/${fichier}.svg" alt="${alt}" width="24" height="16" />`;


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
    promo: null, // code promo vérifié (jamais recopié dans le lien de partage)
  };
  lireLien(etat, config);

  const paysActuel = () => config.pays.find((p) => p.id === etat.paysId);
  // [devise d'envoi, devise de réception]
  const devisesCorridor = () => {
    const p = paysActuel();
    return etat.sens === 'depuisMaroc' ? ['MAD', p.devise] : [p.devise, 'MAD'];
  };
  const dateCourte = (iso) =>
    new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
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
          <label class="champ__label" for="montant" id="label-montant"></label>
          <div class="saisie">
            <input id="montant" name="montant" type="text" inputmode="decimal"
              autocomplete="off" />
            <!-- Choix de la devise de saisie, directement à côté du montant -->
            <select class="saisie__devise" id="devise-saisie" aria-label="Devise du montant saisi"></select>
          </div>
          <p class="champ__aide" id="aide-montant"></p>
        </div>

        <div class="champ">
          <span class="champ__label">Frais</span>
          <div class="choix choix--2" id="choix-mode"></div>
          <p class="champ__aide" id="aide-frais"></p>
        </div>

        <div class="champ">
          <label class="champ__label" for="code-promo">Code promo <span class="facultatif">(facultatif)</span></label>
          <div class="promo">
            <input id="code-promo" name="code-promo" class="promo__input" type="text" maxlength="30"
              autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Ex. CG-7K3PQX" />
            <button type="button" class="promo__btn" id="appliquer-promo">Appliquer</button>
          </div>
          <div class="promo__message" id="message-promo" aria-live="polite"></div>
        </div>
      </form>

      <aside class="simu__resultat">
        <h2 class="carte__titre">Estimation de votre transfert</h2>
        <div id="resultat" aria-live="polite"></div>
        <p class="avertissement">${esc(config.parametres.messageAvertissement)}</p>
      </aside>
    </div>`;

  const $ = (sel) => conteneur.querySelector(sel);

  // Valeur posée par propriété (et non dans le HTML) : un montant venu
  // du lien de partage ne peut ainsi jamais injecter de code dans la page.
  $('#montant').value = etat.montant;

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

    // Menu déroulant des 2 devises du corridor (ex. MAD / XOF)
    $('#devise-saisie').innerHTML = [envoi, recu]
      .map((code) => `<option value="${code}" ${code === etat.deviseSaisie ? 'selected' : ''}>${libelleDevise(code)}</option>`)
      .join('');

    // Le montant saisi est toujours le montant envoyé, dans l'une ou l'autre devise.
    const saisitEnvoi = etat.deviseSaisie === envoi;
    $('#label-montant').textContent = `Montant envoyé (en ${libelleDevise(etat.deviseSaisie)})`;
    $('#aide-montant').textContent = saisitEnvoi
      ? 'Saisissez le montant dans votre devise.'
      : `Converti en ${libelleDevise(envoi)} au taux MoneyUp, puis les frais sont appliqués.`;

    $('#choix-mode').innerHTML =
      bouton('modeFrais', 'deduit', etat.modeFrais === 'deduit', 'Déduits du montant') +
      bouton('modeFrais', 'ajoute', etat.modeFrais === 'ajoute', 'Ajoutés à mon paiement');
    $('#aide-frais').textContent = etat.modeFrais === 'deduit'
      ? 'Vous payez le montant saisi. Les frais en sont retirés : le bénéficiaire reçoit un peu moins.'
      : 'Les frais s’ajoutent à ce que vous payez : le bénéficiaire reçoit le montant complet.';
  }

  // ---------------------------------------------------------
  // CARTE DE RÉSULTAT
  // ---------------------------------------------------------
  function ligne(libelle, valeur, classe = '') {
    return `<div class="ligne ${classe}"><span>${libelle}</span><strong>${valeur}</strong></div>`;
  }

  const pct = (v) => `${String(v).replace('.', ',')} %`;
  function libelleFrais(f) {
    // Frais réduit par un code promo : « (3,5 % → offert) » ou « (10 % → 9 %) »
    if (f.valeurInitiale !== null && f.valeurInitiale !== undefined) {
      const avant = f.valeurInitiale === 'bareme' ? 'barème' : pct(f.valeurInitiale);
      const apres = f.pourcentage === 0 ? 'offert' : pct(f.pourcentage);
      return esc(`${f.libelle} (${avant} → ${apres})`);
    }
    return esc(f.pourcentage !== null ? `${f.libelle} (${pct(f.pourcentage)})` : f.libelle);
  }

  function rendreResultat() {
    ecrireLien(etat);
    const r = simuler(config, etat);
    rendreMessagePromo(r);

    if (!r.ok) {
      $('#resultat').innerHTML = `<div class="resultat resultat--vide"><p>${r.message}</p></div>`;
      return;
    }

    const env = r.deviseEnvoi;
    const rec = r.deviseRecu;

    // Saisie dans la devise de réception : on rappelle l'équivalence (100 € = 1 100 DH)
    const equivalence = r.calcul === 'inverse' ? ` (soit ${fm(r.montantSaisi, rec)})` : '';

    const entete = `
      <p class="resultat__label">Le bénéficiaire reçoit environ</p>
      <p class="resultat__montant">${fm(r.netRecu, rec)}</p>
      <p class="resultat__sous">Vous payez ${fm(r.totalAPayer, env)}</p>`;

    // Les frais sont signés et colorés : "−" s'ils sont retirés, "+" s'ils sont ajoutés
    const signe = r.modeFrais === 'deduit' ? '− ' : '+ ';
    const frais = (f, devise) => {
      const reduit = f.valeurInitiale !== null && f.valeurInitiale !== undefined;
      const valeur = reduit && f.montant === 0 ? 'Offert' : f.montant > 0 ? signe + fm(f.montant, devise) : fm(f.montant, devise);
      return ligne(libelleFrais(f), valeur, reduit ? 'ligne--frais ligne--reduit' : 'ligne--frais');
    };

    const lignes = [
      ...(r.promo?.applique ? [ligne('Code promo', esc(r.promo.code), 'ligne--promo')] : []),
      ligne('Taux appliqué', texteTaux(r.taux), 'ligne--taux'),
      ligne('Montant envoyé', fm(r.montantEnvoye, env) + equivalence),
      ...r.fraisEnvoi.map((f) => frais(f, env)),
      ligne('Montant converti', fm(r.montantConverti, rec)),
      ...r.fraisRecu.map((f) => frais(f, rec)),
    ];
    if (r.modeFrais === 'ajoute' && r.fraisRecuPayesEnEnvoi > 0) {
      lignes.push(ligne('Frais de retrait réglés par vous', '+ ' + fm(r.fraisRecuPayesEnEnvoi, env), 'ligne--frais'));
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
          ${ligne('Total à payer', fm(r.totalAPayer, env), 'ligne--fort ligne--total')}
          ${ligne('Net reçu par le bénéficiaire', fm(r.netRecu, rec), 'ligne--fort ligne--net')}
        </div>
        <p class="resultat__note">${note}</p>
        ${boutonWhatsApp(r)}
      </div>
      <div class="resultat__pied">
        <span>${config.misAJourLe ? `Taux en vigueur au ${dateCourte(config.misAJourLe)}` : ''}</span>
        <button type="button" class="btn-partage" id="partager">Partager cette simulation</button>
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

  $('#devise-saisie').addEventListener('change', (e) => {
    etat.deviseSaisie = e.target.value;
    rendreChoix();
    rendreResultat();
  });

  $('#montant').addEventListener('input', (e) => {
    etat.montant = e.target.value;
    rendreResultat();
  });

  // Entrée dans le champ ne doit pas recharger la page
  $('.simu__form').addEventListener('submit', (e) => e.preventDefault());

  // ---------------------------------------------------------
  // CODE PROMO
  // ---------------------------------------------------------
  function rendreMessagePromo(r) {
    const zone = $('#message-promo');
    if (!r.ok) return; // montant invalide : on ne touche pas au message du code
    if (!etat.promo) {
      if (zone.dataset.erreur) return; // une erreur de saisie reste affichée
      zone.innerHTML = '';
      zone.className = 'promo__message';
      return;
    }
    const applique = r?.promo?.applique;
    zone.className = `promo__message ${applique ? 'is-ok' : 'is-attention'}`;
    zone.innerHTML = `
      <span>${applique
        ? `✓ Code <strong>${esc(etat.promo.code)}</strong> appliqué : ${esc(etat.promo.libelle)}`
        : `Le code <strong>${esc(etat.promo.code)}</strong> est valable uniquement pour ${esc(r?.promo?.corridor ?? '')}.`}</span>
      <button type="button" class="promo__retirer" id="retirer-promo">Retirer</button>`;
  }

  function afficherErreurPromo(message) {
    const zone = $('#message-promo');
    zone.dataset.erreur = '1';
    zone.className = 'promo__message is-erreur';
    zone.textContent = message;
  }

  async function appliquerCode() {
    const bouton = $('#appliquer-promo');
    bouton.disabled = true;
    bouton.textContent = 'Vérification…';
    const { promo, erreur } = await verifierCodePromo($('#code-promo').value);
    bouton.disabled = false;
    bouton.textContent = 'Appliquer';
    delete $('#message-promo').dataset.erreur;

    if (erreur) return afficherErreurPromo(erreur);

    const pays = config.pays.find((p) => p.id === promo.paysId);
    if (!pays) return afficherErreurPromo("Ce code n'est pas utilisable pour le moment.");

    // On place le simulateur sur le pays (et le sens) du code
    etat.promo = promo;
    $('#code-promo').value = promo.code;
    if (etat.paysId !== pays.id || (promo.sens !== 'tous' && etat.sens !== promo.sens)) {
      etat.paysId = pays.id;
      const sensVoulu = promo.sens === 'tous' ? etat.sens : promo.sens;
      etat.sens = pays.corridors[sensVoulu]?.actif ? sensVoulu
        : pays.corridors.depuisMaroc?.actif ? 'depuisMaroc' : 'versMaroc';
      etat.deviseSaisie = devisesCorridor()[0];
    }
    rendreChoix();
    rendreResultat();
  }

  $('#appliquer-promo').addEventListener('click', appliquerCode);
  // Dès que le client retape son code, l'ancien message d'erreur disparaît
  $('#code-promo').addEventListener('input', () => {
    const zone = $('#message-promo');
    if (!zone.dataset.erreur) return;
    delete zone.dataset.erreur;
    zone.className = 'promo__message';
    zone.textContent = '';
  });
  $('#code-promo').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      appliquerCode();
    }
  });
  conteneur.addEventListener('click', (e) => {
    if (!e.target.closest('#retirer-promo')) return;
    etat.promo = null;
    $('#code-promo').value = '';
    rendreResultat();
  });

  // Bouton "Partager cette simulation" : partage natif sur téléphone,
  // sinon copie du lien dans le presse-papiers.
  conteneur.addEventListener('click', async (e) => {
    const btn = e.target.closest('#partager');
    if (!btn) return;
    const url = location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Simulation MoneyUp', url });
      } else {
        await navigator.clipboard.writeText(url);
        btn.textContent = '✓ Lien copié';
        setTimeout(() => (btn.textContent = 'Partager cette simulation'), 2000);
      }
    } catch {
      /* partage annulé par l'utilisateur : rien à faire */
    }
  });

  rendreChoix();
  rendreResultat();
}

// =========================================================
// LIEN DE PARTAGE
// ---------------------------------------------------------
// Les choix sont recopiés dans l'adresse de la page, ex. :
//   /?pays=togo&sens=envoi&montant=1000
// Ce lien rouvre le simulateur exactement sur cette simulation.
// MoneyUp peut ainsi partager un lien par pays dans ses groupes.
// =========================================================
const SENS_LIEN = { envoi: 'depuisMaroc', reception: 'versMaroc' };

function lireLien(etat, config) {
  const q = new URLSearchParams(location.search);
  const pays = config.pays.find((p) => p.id === q.get('pays'));
  if (!pays) return;
  etat.paysId = pays.id;

  const sens = SENS_LIEN[q.get('sens')];
  etat.sens = sens && pays.corridors[sens]?.actif
    ? sens
    : pays.corridors.depuisMaroc?.actif ? 'depuisMaroc' : 'versMaroc';

  const [envoi, recu] = etat.sens === 'depuisMaroc' ? ['MAD', pays.devise] : [pays.devise, 'MAD'];
  etat.deviseSaisie = q.get('devise') === recu ? recu : envoi;

  if (q.get('montant')) etat.montant = q.get('montant').slice(0, 20);
  if (['deduit', 'ajoute'].includes(q.get('frais'))) etat.modeFrais = q.get('frais');
}

function ecrireLien(etat) {
  const q = new URLSearchParams({
    pays: etat.paysId,
    sens: etat.sens === 'depuisMaroc' ? 'envoi' : 'reception',
    devise: etat.deviseSaisie,
    montant: etat.montant,
    frais: etat.modeFrais,
  });
  // replaceState change l'adresse SANS recharger la page ni remplir l'historique
  history.replaceState(null, '', `?${q}`);
}