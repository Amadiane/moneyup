// =========================================================
// DEVISES
// "decimales" = règle d'arrondi pour l'affichage et les calculs.
// XAF et XOF sont DEUX devises distinctes (cahier des charges §2).
// =========================================================

export const DEVISES = {
  MAD: { code: 'MAD', nom: 'Dirham marocain', symbole: 'DH', decimales: 2 },
  XAF: { code: 'XAF', nom: 'Franc CFA (Afrique centrale)', symbole: 'FCFA', decimales: 0 },
  XOF: { code: 'XOF', nom: "Franc CFA (Afrique de l'Ouest)", symbole: 'FCFA', decimales: 0 },
  EUR: { code: 'EUR', nom: 'Euro', symbole: '€', decimales: 2 },
};