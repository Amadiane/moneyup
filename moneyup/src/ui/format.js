// =========================================================
// MISE EN FORME DES MONTANTS (affichage uniquement)
// On formate "à la main" plutôt qu'avec Intl.NumberFormat :
// le résultat est ainsi identique sur tous les téléphones,
// y compris les anciens Android.
// =========================================================

const ESPACE = ' '; // espace insécable : "1 000" ne sera jamais coupé en fin de ligne

// Ce qu'on affiche après un montant : "DH", "€", ou le code (XAF / XOF,
// pour ne jamais confondre les deux francs CFA).
export function libelleDevise(code) {
  return { MAD: 'DH', EUR: '€' }[code] ?? code;
}

// 1000 -> "1 000"   724.25 -> "724,25"   141.8 -> "141,80"
export function formatNombre(valeur, decimales) {
  const texte = Number.isInteger(valeur) ? String(valeur) : valeur.toFixed(decimales);
  const [entier, decimal] = texte.split('.');
  const groupe = entier.replace(/\B(?=(\d{3})+(?!\d))/g, ESPACE);
  return decimal ? `${groupe},${decimal}` : groupe;
}

export function formatMontant(valeur, code, decimales) {
  return `${formatNombre(valeur, decimales)} ${libelleDevise(code)}`;
}

// { unite: 'MAD', valeur: 60, autre: 'XAF' } -> "1 MAD = 60 XAF"
// { unite: 'EUR', valeur: 10.7, autre: 'MAD' } -> "1 EUR = 10,7 MAD"
export function texteTaux(taux) {
  return `1 ${taux.unite} = ${String(taux.valeur).replace('.', ',')} ${taux.autre}`;
}