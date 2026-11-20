// =========================================================
// ESPACE ADMIN MONEYUP  (/admin/)
// ---------------------------------------------------------
// 1. Connexion (e-mail + mot de passe, via Supabase Auth)
// 2. Vérification que le compte est bien dans la table "admins"
// 3. Formulaire de modification des tarifs
// 4. Vérification puis enregistrement dans Supabase
//
// PRINCIPE DU FORMULAIRE
// Chaque champ porte un attribut data-chemin qui indique où
// écrire sa valeur dans l'objet "brouillon". Exemple :
//   data-chemin="pays.0.corridors.depuisMaroc.paliers.0.taux.valeur"
// Ainsi, un seul écouteur gère TOUS les champs.
// =========================================================

import '../style.css';
import './admin.css';
import { supabase } from '../config/supabase.js';
import { DEVISES } from '../config/devises.js';
import { verifierDonnees } from '../config/verification.js';
import { afficherPromos } from './promos.js';

const racine = document.querySelector('#admin');

// ---------- utilitaires ----------
const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const lire = (obj, chemin) => (chemin ? chemin.split('.').reduce((o, k) => o?.[k], obj) : obj);

function ecrire(obj, chemin, valeur) {
  const cles = chemin.split('.');
  const derniere = cles.pop();
  lire(obj, cles.join('.'))[derniere] = valeur;
}

const dateFr = (iso) =>
  new Date(iso).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });

function cadre(contenu, avecDeconnexion = false) {
  racine.innerHTML = `
    <header class="header">
      <div class="container header__inner">
        <span class="brand">
          <img src="/logo-moneyup.jpg" alt="MoneyUp" class="brand__logo" />
          <span class="brand__text">
            <strong>MONEY<span class="accent">UP</span></strong>
            <small>Espace administrateur</small>
          </span>
        </span>
        <span class="admin-entete">
          <a href="/" class="lien-clair" target="_blank" rel="noopener">Voir le simulateur</a>
          ${avecDeconnexion ? '<button type="button" class="btn-clair" id="deconnexion">Déconnexion</button>' : ''}
        </span>
      </div>
    </header>
    <main class="container admin">${contenu}</main>`;

  racine.querySelector('#deconnexion')?.addEventListener('click', async () => {
    if (etat.modifie && !confirm('Des modifications ne sont pas enregistrées. Se déconnecter quand même ?')) return;
    await supabase.auth.signOut();
    etat.modifie = false;
    afficherConnexion();
  });
}

// ---------- état de la page ----------
const etat = {
  original: null,   // tarifs tels qu'enregistrés
  brouillon: null,  // tarifs en cours de modification
  modifieLe: null,
  modifie: false,
};

window.addEventListener('beforeunload', (e) => {
  if (etat.modifie) e.preventDefault();
});

// =========================================================
// 1. CONNEXION
// =========================================================
function afficherConnexion(message = '') {
  cadre(`
    <form class="carte connexion" id="form-connexion">
      <h1>Connexion</h1>
      <p class="aide">Réservé à l'équipe MoneyUp.</p>
      <label class="champ">
        <span class="champ__label">E-mail</span>
        <input class="admin-input" type="email" name="email" autocomplete="username" required />
      </label>
      <label class="champ">
        <span class="champ__label">Mot de passe</span>
        <input class="admin-input" type="password" name="motdepasse" autocomplete="current-password" required />
      </label>
      <p class="erreur" id="erreur-connexion">${esc(message)}</p>
      <button class="btn-principal" type="submit">Se connecter</button>
    </form>`);

  const form = racine.querySelector('#form-connexion');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const bouton = form.querySelector('button');
    bouton.disabled = true;
    bouton.textContent = 'Connexion…';
    const { error } = await supabase.auth.signInWithPassword({
      email: form.email.value.trim(),
      password: form.motdepasse.value,
    });
    if (error) {
      form.querySelector('#erreur-connexion').textContent = 'E-mail ou mot de passe incorrect.';
      bouton.disabled = false;
      bouton.textContent = 'Se connecter';
      return;
    }
    ouvrirEspace();
  });
}

// =========================================================
// 2. VÉRIFICATION DU RÔLE + CHARGEMENT DES TARIFS
// =========================================================
async function ouvrirEspace() {
  cadre('<p class="chargement">Chargement…</p>', true);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return afficherConnexion();

  const { data: admin } = await supabase.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
  if (!admin) {
    await supabase.auth.signOut();
    return afficherConnexion("Ce compte n'a pas les droits d'administration.");
  }

  const { data, error } = await supabase
    .from('configuration')
    .select('donnees, modifie_le')
    .eq('id', 1)
    .single();
  if (error) {
    cadre(`<p class="erreur">Impossible de charger les tarifs : ${esc(error.message)}</p>`, true);
    return;
  }

  etat.original = data.donnees;
  etat.brouillon = structuredClone(data.donnees);
  etat.modifieLe = data.modifie_le;
  etat.modifie = false;
  afficherEditeur();
}

// =========================================================
// 3. FORMULAIRE
// =========================================================

// Champs génériques. "type" sert à convertir la saisie : nombre, texte ou case à cocher.
function champNombre(chemin, valeur, { suffixe = '', lectureSeule = false, label = '' } = {}) {
  return `
    <label class="mini-champ">
      ${label ? `<span>${label}</span>` : ''}
      <span class="mini-saisie">
        <input class="admin-input" type="text" inputmode="decimal" data-chemin="${chemin}" data-type="nombre"
          value="${esc(valeur)}" ${lectureSeule ? 'readonly' : ''} />
        ${suffixe ? `<em>${suffixe}</em>` : ''}
      </span>
    </label>`;
}

function champTexte(chemin, valeur, label, placeholder = '') {
  return `
    <label class="mini-champ mini-champ--large">
      <span>${label}</span>
      <input class="admin-input" type="text" data-chemin="${chemin}" data-type="texte"
        value="${esc(valeur)}" placeholder="${esc(placeholder)}" />
    </label>`;
}

function interrupteur(chemin, actif, label) {
  return `
    <label class="interrupteur">
      <input type="checkbox" data-chemin="${chemin}" data-type="bool" ${actif ? 'checked' : ''} />
      <span>${label}</span>
    </label>`;
}

function editeurBareme(chemin, frais, devise) {
  const lignes = frais.bareme.map((t, k) => {
    const min = k === 0 ? 1 : frais.bareme[k - 1].jusqua + 1;
    return `
      <tr>
        <td>${Number.isFinite(min) ? min.toLocaleString('fr-FR') : '?'}</td>
        <td>${champNombre(`${chemin}.bareme.${k}.jusqua`, t.jusqua)}</td>
        <td>${champNombre(`${chemin}.bareme.${k}.frais`, t.frais, { suffixe: devise })}</td>
        <td><button type="button" class="btn-icone" data-action="supprimer" data-chemin="${chemin}.bareme.${k}"
          title="Supprimer la ligne" ${frais.bareme.length <= 1 ? 'disabled' : ''}>✕</button></td>
      </tr>`;
  });
  return `
    <div class="bareme">
      <table>
        <thead><tr><th>De</th><th>Jusqu'à (${devise})</th><th>Frais</th><th></th></tr></thead>
        <tbody>${lignes.join('')}</tbody>
      </table>
      <button type="button" class="btn-lien" data-action="ajouter-tranche" data-chemin="${chemin}.bareme">+ Ajouter une ligne</button>
      ${interrupteur(`${chemin}.cycle`, frais.cycle, 'Au-delà du dernier plafond, reprendre le barème depuis le début')}
    </div>`;
}

function editeurCorridor(pays, i, sens) {
  const corridor = pays.corridors[sens];
  if (!corridor) return '';
  const base = `pays.${i}.corridors.${sens}`;
  const titre = sens === 'depuisMaroc' ? `Maroc → ${pays.nom}` : `${pays.nom} → Maroc`;
  const deviseEnvoi = sens === 'depuisMaroc' ? 'MAD' : pays.devise;
  const deviseRecu = sens === 'depuisMaroc' ? pays.devise : 'MAD';

  const paliers = corridor.paliers.map((palier, j) => {
    const cp = `${base}.paliers.${j}`;
    const autre = palier.taux.unite === 'MAD' ? pays.devise : 'MAD';
    const frais = palier.frais.map((f, k) => {
      const cf = `${cp}.frais.${k}`;
      const devise = f.base === 'envoye' ? deviseEnvoi : deviseRecu;
      const badge = f.categorie === 'moneyup' ? 'MoneyUp' : 'Opérateur';
      if (f.type === 'bareme') {
        return `
          <div class="frais">
            <div class="frais__tete"><span class="badge-cat">${badge}</span>${champTexte(`${cf}.libelle`, f.libelle, 'Nom affiché')}</div>
            ${editeurBareme(cf, f, devise)}
          </div>`;
      }
      return `
        <div class="frais">
          <div class="frais__tete">
            <span class="badge-cat">${badge}</span>
            ${champTexte(`${cf}.libelle`, f.libelle, 'Nom affiché')}
            ${champNombre(`${cf}.valeur`, f.valeur, { suffixe: '%', label: 'Valeur' })}
          </div>
        </div>`;
    });

    return `
      <div class="palier">
        <div class="palier__tete">
          ${corridor.paliers.length > 1 || j > 0
            ? champNombre(`${cp}.aPartirDe`, palier.aPartirDe, { suffixe: deviseEnvoi, label: 'À partir de', lectureSeule: j === 0 })
            : ''}
          ${champNombre(`${cp}.taux.valeur`, palier.taux.valeur, { label: `Taux : 1 ${palier.taux.unite} =`, suffixe: autre })}
          ${j > 0 ? `<button type="button" class="btn-icone" data-action="supprimer" data-chemin="${cp}" title="Supprimer ce palier">✕</button>` : ''}
        </div>
        ${frais.join('')}
      </div>`;
  });

  return `
    <div class="corridor ${corridor.actif ? '' : 'is-inactif'}">
      <div class="corridor__tete">
        <h3>${titre}</h3>
        ${interrupteur(`${base}.actif`, corridor.actif, 'Actif')}
      </div>
      ${champTexte(`${base}.moyenPaiement`, corridor.moyenPaiement ?? '', 'Moyen de paiement (optionnel)', 'ex. Airtel Money')}
      ${paliers.join('')}
      <button type="button" class="btn-lien" data-action="ajouter-palier" data-chemin="${base}.paliers">
        + Ajouter un palier (taux ou frais différents à partir d'un montant)
      </button>
    </div>`;
}

function afficherEditeur() {
  const d = etat.brouillon;
  const p = d.parametres;

  const pays = d.pays.map((pays, i) => `
    <section class="carte pays-admin ${pays.actif ? '' : 'is-inactif'}">
      <div class="pays-admin__tete">
        <h2><img class="drapeau" src="/drapeaux/${pays.id}.svg" alt="" width="30" height="20" /> ${esc(pays.nom)}
          <small>${pays.devise} · ${DEVISES[pays.devise]?.nom ?? ''}</small></h2>
        ${interrupteur(`pays.${i}.actif`, pays.actif, 'Pays visible sur le simulateur')}
      </div>
      <div class="corridors">
        ${editeurCorridor(pays, i, 'depuisMaroc')}
        ${editeurCorridor(pays, i, 'versMaroc')}
      </div>
    </section>`);

  cadre(`
    <div class="barre-enregistrement" id="barre">
      <div>
        <strong id="statut"></strong>
        <small>Dernier enregistrement : ${dateFr(etat.modifieLe)}</small>
      </div>
      <div class="barre-enregistrement__boutons">
        <button type="button" class="btn-secondaire" id="annuler">Annuler les modifications</button>
        <button type="button" class="btn-principal" id="enregistrer">Enregistrer</button>
      </div>
    </div>
    <ul class="erreurs" id="erreurs"></ul>

    <section class="carte">
      <h2>Paramètres généraux</h2>
      <div class="grille-params">
        ${champTexte('parametres.whatsapp', p.whatsapp, 'Numéro WhatsApp (avec indicatif, sans +)', '212751527863')}
        ${champNombre('parametres.montantMinimum', p.montantMinimum, { label: 'Montant minimum de saisie' })}
        <label class="mini-champ">
          <span>Frais par défaut</span>
          <select class="admin-input" data-chemin="parametres.modeFraisParDefaut" data-type="texte">
            <option value="deduit" ${p.modeFraisParDefaut === 'deduit' ? 'selected' : ''}>Déduits du montant</option>
            <option value="ajoute" ${p.modeFraisParDefaut === 'ajoute' ? 'selected' : ''}>Ajoutés au paiement</option>
          </select>
        </label>
      </div>
      <label class="mini-champ mini-champ--large">
        <span>Message d'avertissement sous le résultat</span>
        <textarea class="admin-input" rows="2" data-chemin="parametres.messageAvertissement" data-type="texte">${esc(p.messageAvertissement)}</textarea>
      </label>
    </section>

    <section class="carte" id="section-promos"></section>

    ${pays.join('')}`, true);

  mettreAJourBarre();
  // Codes promo : section indépendante, enregistrée directement dans Supabase
  afficherPromos(racine.querySelector('#section-promos'), { supabase, pays: etat.brouillon.pays });
}

// Met à jour le bouton Enregistrer et la liste des erreurs, SANS redessiner le formulaire
// (sinon le champ en cours de saisie perdrait le focus).
function mettreAJourBarre(message = '') {
  const erreurs = verifierDonnees(etat.brouillon);
  const statut = racine.querySelector('#statut');
  racine.querySelector('#erreurs').innerHTML = erreurs.map((e) => `<li>${esc(e)}</li>`).join('');
  racine.querySelector('#enregistrer').disabled = !etat.modifie || erreurs.length > 0;
  racine.querySelector('#annuler').disabled = !etat.modifie;
  racine.querySelector('#barre').classList.toggle('is-modifie', etat.modifie);

  if (message) statut.textContent = message;
  else if (erreurs.length) statut.textContent = `${erreurs.length} erreur(s) à corriger`;
  else statut.textContent = etat.modifie ? 'Modifications non enregistrées' : 'Tarifs à jour';
}

// =========================================================
// ÉVÉNEMENTS (un seul écouteur pour tout le formulaire)
// =========================================================
function convertir(champ) {
  const type = champ.dataset.type;
  if (type === 'bool') return champ.checked;
  if (type === 'nombre') {
    const texte = champ.value.replace(/\s/g, '').replace(',', '.');
    return texte === '' || isNaN(Number(texte)) ? null : Number(texte);
  }
  return champ.value;
}

function surSaisie(e) {
  const champ = e.target.closest('[data-chemin][data-type]');
  if (!champ || champ.readOnly) return;
  ecrire(etat.brouillon, champ.dataset.chemin, convertir(champ));
  etat.modifie = true;

  // Les interrupteurs changent l'apparence (grisé) : on redessine.
  if (champ.dataset.type === 'bool') {
    const y = window.scrollY;
    afficherEditeur();
    window.scrollTo(0, y);
  } else {
    mettreAJourBarre();
  }
}

// "input" pour les champs texte (à chaque frappe),
// "change" pour les cases à cocher et les listes déroulantes.
const estChoix = (el) => el.type === 'checkbox' || el.tagName === 'SELECT';
racine.addEventListener('input', (e) => { if (!estChoix(e.target)) surSaisie(e); });
racine.addEventListener('change', (e) => { if (estChoix(e.target)) surSaisie(e); });

racine.addEventListener('click', async (e) => {
  const cible = e.target.closest('button');
  if (!cible) return;

  // Ajout / suppression de lignes
  const action = cible.dataset.action;
  if (action) {
    const chemin = cible.dataset.chemin;
    if (action === 'supprimer') {
      const cles = chemin.split('.');
      const index = Number(cles.pop());
      lire(etat.brouillon, cles.join('.')).splice(index, 1);
    }
    if (action === 'ajouter-tranche') {
      const liste = lire(etat.brouillon, chemin);
      const derniere = liste[liste.length - 1];
      liste.push({ jusqua: (derniere?.jusqua ?? 0) + 1000, frais: derniere?.frais ?? 0 });
    }
    if (action === 'ajouter-palier') {
      const liste = lire(etat.brouillon, chemin);
      const copie = structuredClone(liste[liste.length - 1]);
      copie.aPartirDe = (copie.aPartirDe ?? 0) + 10000;
      liste.push(copie);
    }
    etat.modifie = true;
    const y = window.scrollY;
    afficherEditeur();
    window.scrollTo(0, y);
    return;
  }

  if (cible.id === 'annuler') {
    if (!confirm('Annuler toutes les modifications non enregistrées ?')) return;
    etat.brouillon = structuredClone(etat.original);
    etat.modifie = false;
    afficherEditeur();
  }

  if (cible.id === 'enregistrer') await enregistrer(cible);
});

// =========================================================
// 4. ENREGISTREMENT
// =========================================================
async function enregistrer(bouton) {
  if (verifierDonnees(etat.brouillon).length) return;
  bouton.disabled = true;
  bouton.textContent = 'Enregistrement…';

  const { data, error } = await supabase
    .from('configuration')
    .update({ donnees: etat.brouillon })
    .eq('id', 1)
    .select('modifie_le')
    .maybeSingle();

  bouton.textContent = 'Enregistrer';

  // Sans droit, Supabase ne renvoie pas d'erreur mais aucune ligne modifiée
  if (error || !data) {
    mettreAJourBarre(error ? `Erreur : ${error.message}` : 'Enregistrement refusé (droits insuffisants).');
    bouton.disabled = false;
    return;
  }

  etat.original = structuredClone(etat.brouillon);
  etat.modifieLe = data.modifie_le;
  etat.modifie = false;
  afficherEditeur();
  mettreAJourBarre('✓ Tarifs enregistrés : ils sont déjà en ligne sur le simulateur.');
}

// =========================================================
// DÉMARRAGE
// =========================================================
async function demarrer() {
  if (!supabase) {
    cadre(`<div class="carte"><h1>Configuration manquante</h1>
      <p>Le fichier <code>.env.local</code> est absent ou incomplet. Voir <code>.env.example</code>.</p></div>`);
    return;
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (session) ouvrirEspace();
  else afficherConnexion();
}

demarrer();