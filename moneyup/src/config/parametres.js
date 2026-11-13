// =========================================================
// PARAMÈTRES GÉNÉRAUX
// =========================================================

export const PARAMETRES = {
  // Numéro WhatsApp officiel au format international, SANS "+" ni espaces.
  whatsapp: '212751527863',

  // Choix proposé au client dans le simulateur :
  //   'deduit'  -> les frais sont retirés du montant (le bénéficiaire reçoit moins)
  //   'ajoute'  -> les frais s'ajoutent à ce que l'expéditeur paie
  //               (le bénéficiaire reçoit le montant converti complet)
  modeFraisParDefaut: 'deduit',

  // Montant minimum accepté dans le champ de saisie (toutes devises).
  montantMinimum: 1,

  messageAvertissement:
    "Cette simulation est indicative. Les conditions applicables et le montant définitif sont confirmés par MoneyUp avant validation du transfert.",
};