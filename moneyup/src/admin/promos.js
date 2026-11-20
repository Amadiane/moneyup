// =========================================================
// ESPACE ADMIN – CODES PROMO
// ---------------------------------------------------------
// Section indépendante de l'éditeur de tarifs : chaque action
// (créer, activer/désactiver, supprimer) est enregistrée tout de
// suite dans la table "codes_promo" de Supabase.
//
// Les données sont gardées en mémoire dans "etat" : l'éditeur de
// tarifs redessine souvent la page, et cette section se redessine
// alors depuis la mémoire, sans tout recharger.
// =========================================================

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Réductions proposées en un clic (demande MoneyUp du 20/11/2026)
const MODELES = [
  { id: 'op0', nom: 'Frais opérateur offerts', fraisOperateur: 0, fraisService: null },
  { id: 'op0-s9', nom: 'Frais opérateur offerts + service à 9 %', fraisOperateur: 0, fraisService: 9 },
  { id: 'op0-s8', nom: 'Frais opérateur offerts + service à 8 %', fraisOperateur: 0, fraisService: 8 },
  { id: 'perso', nom: 'Personnalisée…', fraisOperateur: null, fraisService: null },
];

// Préfixe du code selon le pays : CG-7K3PQX pour le Congo
const PREFIXES = { gabon: 'GA', congo: 'CG', togo: 'TG', france: 'FR' };
// Sans 0/O ni 1/I : impossible de les confondre en recopiant le code
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const etat = {
  liste: [],
  charge: false,
  message: '',
  erreur: '',
  form: { paysId: 'congo', sens: 'tous', modele: 'op0-s9', op: '', service: '', note: '', expire: '' },
};

function genererCode(paysId) {
  const octets = crypto.getRandomValues(new Uint8Array(6));
  const suite = Array.from(octets, (o) => ALPHABET[o % ALPHABET.length]).join('');
  return `${PREFIXES[paysId] ?? paysId.slice(0, 2).toUpperCase()}-${suite}`;
}

const nombreOuNull = (v) => {
  const t = String(v ?? '').replace(',', '.').trim();
  return t === '' || isNaN(Number(t)) ? null : Number(t);
};

// « Frais opérateur offerts + service à 9 % »
export function libelleReduction(fraisOperateur, fraisService) {
  const pct = (v) => `${String(v).replace('.', ',')} %`;
  const parties = [];
  if (fraisOperateur !== null) parties.push(fraisOperateur === 0 ? 'Frais opérateur offerts' : `Frais opérateur à ${pct(fraisOperateur)}`);
  if (fraisService !== null) parties.push(fraisService === 0 ? 'service offert' : `service à ${pct(fraisService)}`);
  const texte = parties.join(' + ');
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

function corridor(code, pays) {
  const nom = pays.find((p) => p.id === code.pays_id)?.nom ?? code.pays_id;
  if (code.sens === 'depuisMaroc') return `Maroc → ${nom}`;
  if (code.sens === 'versMaroc') return `${nom} → Maroc`;
  return `${nom} (les deux sens)`;
}

const dateFr = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('fr-FR') : '—');
const expire = (c) => c.expire_le && c.expire_le < new Date().toISOString().slice(0, 10);

// =========================================================
// AFFICHAGE
// =========================================================
export function afficherPromos(zone, { supabase, pays }) {
  if (!etat.charge) {
    zone.innerHTML = '<h2>Codes promo</h2><p class="aide">Chargement…</p>';
    chargerCodes(supabase).then(() => afficherPromos(zone, { supabase, pays }));
    return;
  }
  if (!pays.some((p) => p.id === etat.form.paysId)) etat.form.paysId = pays[0]?.id;
  const f = etat.form;
  const perso = f.modele === 'perso';

  const lignes = etat.liste.map((c) => `
    <tr class="${c.actif && !expire(c) ? '' : 'is-off'}">
      <td><code class="code-promo">${esc(c.code)}</code>
        <button type="button" class="btn-lien" data-promo="copier" data-code="${esc(c.code)}">Copier</button></td>
      <td>${esc(corridor(c, pays))}</td>
      <td>${esc(c.libelle)}</td>
      <td>${esc(c.note || '—')}</td>
      <td>${expire(c) ? '<strong class="txt-rouge">Expiré</strong> ' : ''}${dateFr(c.expire_le)}</td>
      <td><label class="interrupteur"><input type="checkbox" data-promo="actif" data-code="${esc(c.code)}" ${c.actif ? 'checked' : ''} />
        <span>${c.actif ? 'Actif' : 'Désactivé'}</span></label></td>
      <td><button type="button" class="btn-icone" data-promo="supprimer" data-code="${esc(c.code)}" title="Supprimer ce code">✕</button></td>
    </tr>`);

  zone.innerHTML = `
    <h2>Codes promo</h2>
    <p class="aide">Créez un code pour un client : il le saisit dans le simulateur et voit ses frais réduits.
      Vous retrouvez le code dans son message WhatsApp.</p>

    <div class="promo-form">
      <label class="mini-champ"><span>Pays</span>
        <select class="admin-input" data-promo-champ="paysId">
          ${pays.map((p) => `<option value="${p.id}" ${p.id === f.paysId ? 'selected' : ''}>${esc(p.nom)}</option>`).join('')}
        </select></label>
      <label class="mini-champ"><span>Sens</span>
        <select class="admin-input" data-promo-champ="sens">
          <option value="tous" ${f.sens === 'tous' ? 'selected' : ''}>Les deux sens</option>
          <option value="depuisMaroc" ${f.sens === 'depuisMaroc' ? 'selected' : ''}>Depuis le Maroc</option>
          <option value="versMaroc" ${f.sens === 'versMaroc' ? 'selected' : ''}>Vers le Maroc</option>
        </select></label>
      <label class="mini-champ mini-champ--large"><span>Réduction</span>
        <select class="admin-input" data-promo-champ="modele">
          ${MODELES.map((m) => `<option value="${m.id}" ${m.id === f.modele ? 'selected' : ''}>${m.nom}</option>`).join('')}
        </select></label>
      ${perso ? `
        <label class="mini-champ"><span>Frais opérateur (%)</span>
          <input class="admin-input" type="text" inputmode="decimal" data-promo-champ="op" value="${esc(f.op)}" placeholder="vide = inchangé" /></label>
        <label class="mini-champ"><span>Frais de service (%)</span>
          <input class="admin-input" type="text" inputmode="decimal" data-promo-champ="service" value="${esc(f.service)}" placeholder="vide = inchangé" /></label>` : ''}
      <label class="mini-champ mini-champ--large"><span>Client / note (facultatif)</span>
        <input class="admin-input" type="text" data-promo-champ="note" value="${esc(f.note)}" placeholder="ex. M. Diallo" /></label>
      <label class="mini-champ"><span>Valable jusqu'au (facultatif)</span>
        <input class="admin-input" type="date" data-promo-champ="expire" value="${esc(f.expire)}" /></label>
      <button type="button" class="btn-principal" data-promo="creer">Générer le code</button>
    </div>

    ${etat.erreur ? `<p class="erreur">${esc(etat.erreur)}</p>` : ''}
    ${etat.message ? `<p class="succes">${etat.message}</p>` : ''}

    ${etat.liste.length ? `
      <div class="tableau-scroll">
        <table class="tableau-promos">
          <thead><tr><th>Code</th><th>Pour</th><th>Réduction</th><th>Client</th><th>Expire</th><th>Statut</th><th></th></tr></thead>
          <tbody>${lignes.join('')}</tbody>
        </table>
      </div>` : '<p class="aide">Aucun code pour l’instant.</p>'}`;

  brancher(zone, { supabase, pays });
}

// =========================================================
// ACTIONS
// =========================================================
async function chargerCodes(supabase) {
  const { data, error } = await supabase.from('codes_promo').select('*').order('cree_le', { ascending: false });
  etat.charge = true;
  etat.erreur = error ? `Impossible de charger les codes : ${error.message}` : '';
  etat.liste = data ?? [];
}

function brancher(zone, ctx) {
  const redessiner = () => afficherPromos(zone, ctx);

  // Les champs du formulaire sont mémorisés à chaque frappe
  zone.querySelectorAll('[data-promo-champ]').forEach((champ) => {
    const evenement = champ.tagName === 'SELECT' ? 'change' : 'input';
    champ.addEventListener(evenement, () => {
      etat.form[champ.dataset.promoChamp] = champ.value;
      if (champ.dataset.promoChamp === 'modele') redessiner(); // affiche ou masque les champs perso
    });
  });

  zone.querySelectorAll('[data-promo]').forEach((el) => {
    const action = el.dataset.promo;
    const evenement = action === 'actif' ? 'change' : 'click';
    el.addEventListener(evenement, async (e) => {
      e.stopPropagation();
      etat.message = '';
      etat.erreur = '';
      if (action === 'creer') await creer(ctx.supabase);
      if (action === 'actif') await basculer(ctx.supabase, el.dataset.code, el.checked);
      if (action === 'supprimer') await supprimer(ctx.supabase, el.dataset.code);
      if (action === 'copier') {
        await navigator.clipboard?.writeText(el.dataset.code);
        etat.message = `Code <strong>${esc(el.dataset.code)}</strong> copié.`;
      }
      redessiner();
    });
  });
}

async function creer(supabase) {
  const f = etat.form;
  const modele = MODELES.find((m) => m.id === f.modele);
  const fraisOperateur = modele.id === 'perso' ? nombreOuNull(f.op) : modele.fraisOperateur;
  const fraisService = modele.id === 'perso' ? nombreOuNull(f.service) : modele.fraisService;

  if (fraisOperateur === null && fraisService === null) {
    etat.erreur = 'Indiquez au moins une réduction (frais opérateur ou frais de service).';
    return;
  }
  for (const v of [fraisOperateur, fraisService]) {
    if (v !== null && (v < 0 || v > 100)) {
      etat.erreur = 'Les pourcentages doivent être entre 0 et 100.';
      return;
    }
  }

  const ligne = {
    libelle: libelleReduction(fraisOperateur, fraisService),
    pays_id: f.paysId,
    sens: f.sens,
    frais_operateur: fraisOperateur,
    frais_service: fraisService,
    note: f.note.trim() || null,
    expire_le: f.expire || null,
  };

  // Un code tiré au hasard peut (très rarement) exister déjà : on retente
  for (let essai = 0; essai < 3; essai++) {
    const code = genererCode(f.paysId);
    const { data, error } = await supabase.from('codes_promo').insert({ ...ligne, code }).select().single();
    if (!error) {
      etat.liste.unshift(data);
      etat.message = `✓ Code <strong>${esc(code)}</strong> créé. Copiez-le et envoyez-le à votre client.`;
      etat.form.note = '';
      return;
    }
    if (error.code !== '23505') {
      etat.erreur = `Création impossible : ${error.message}`;
      return;
    }
  }
  etat.erreur = 'Création impossible, réessayez.';
}

async function basculer(supabase, code, actif) {
  const { error } = await supabase.from('codes_promo').update({ actif }).eq('code', code);
  if (error) {
    etat.erreur = `Modification impossible : ${error.message}`;
    return;
  }
  const c = etat.liste.find((x) => x.code === code);
  if (c) c.actif = actif;
}

async function supprimer(supabase, code) {
  if (!confirm(`Supprimer définitivement le code ${code} ? Il ne fonctionnera plus.`)) return;
  const { error } = await supabase.from('codes_promo').delete().eq('code', code);
  if (error) {
    etat.erreur = `Suppression impossible : ${error.message}`;
    return;
  }
  etat.liste = etat.liste.filter((x) => x.code !== code);
  etat.message = `Code ${esc(code)} supprimé.`;
}