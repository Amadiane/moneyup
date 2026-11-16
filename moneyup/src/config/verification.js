// =========================================================
// VÉRIFICATION DES TARIFS AVANT ENREGISTREMENT
// L'espace admin refuse d'enregistrer si cette fonction
// trouve une erreur : impossible de casser le simulateur
// avec une faute de frappe.
// Renvoie une liste de messages (vide = tout est bon).
// =========================================================

const estNombre = (v) => typeof v === 'number' && Number.isFinite(v);

export function verifierDonnees(donnees) {
  const erreurs = [];
  const p = donnees.parametres ?? {};

  if (p.whatsapp && !/^\d{8,15}$/.test(p.whatsapp)) {
    erreurs.push('Numéro WhatsApp : chiffres uniquement, avec l’indicatif (ex. 212751527863).');
  }
  if (!estNombre(p.montantMinimum) || p.montantMinimum <= 0) {
    erreurs.push('Montant minimum : doit être un nombre supérieur à 0.');
  }

  if (!donnees.pays?.some((pays) => pays.actif)) {
    erreurs.push('Au moins un pays doit rester actif.');
  }

  for (const pays of donnees.pays ?? []) {
    for (const [cle, corridor] of Object.entries(pays.corridors ?? {})) {
      const nom = cle === 'depuisMaroc' ? `Maroc → ${pays.nom}` : `${pays.nom} → Maroc`;
      const paliers = corridor.paliers ?? [];

      if (paliers.length === 0) {
        erreurs.push(`${nom} : il faut au moins un palier.`);
        continue;
      }
      if (paliers[0].aPartirDe !== 0) {
        erreurs.push(`${nom} : le premier palier doit commencer à 0.`);
      }

      paliers.forEach((palier, i) => {
        const ici = paliers.length > 1 ? `${nom}, palier ${i + 1}` : nom;

        if (i > 0 && !(estNombre(palier.aPartirDe) && palier.aPartirDe > paliers[i - 1].aPartirDe)) {
          erreurs.push(`${ici} : le seuil doit être plus grand que celui du palier précédent.`);
        }
        if (!estNombre(palier.taux?.valeur) || palier.taux.valeur <= 0) {
          erreurs.push(`${ici} : le taux doit être un nombre supérieur à 0.`);
        }

        let totalPourcentages = 0;
        for (const f of palier.frais ?? []) {
          if (!f.libelle?.trim()) erreurs.push(`${ici} : un frais n’a pas de nom.`);

          if (f.type === 'pourcentage') {
            if (!estNombre(f.valeur) || f.valeur < 0 || f.valeur >= 100) {
              erreurs.push(`${ici} : « ${f.libelle} » doit être un pourcentage entre 0 et 99.`);
            } else if (f.base === 'envoye') {
              totalPourcentages += f.valeur;
            }
          }

          if (f.type === 'bareme') {
            const tranches = f.bareme ?? [];
            if (tranches.length === 0) erreurs.push(`${ici} : le barème « ${f.libelle} » est vide.`);
            tranches.forEach((t, k) => {
              if (!Number.isInteger(t.jusqua) || t.jusqua <= 0) {
                erreurs.push(`${ici} : barème, ligne ${k + 1} : le plafond doit être un nombre entier positif.`);
              } else if (k > 0 && t.jusqua <= tranches[k - 1].jusqua) {
                erreurs.push(`${ici} : barème, ligne ${k + 1} : le plafond doit être plus grand que la ligne précédente.`);
              }
              if (!estNombre(t.frais) || t.frais < 0) {
                erreurs.push(`${ici} : barème, ligne ${k + 1} : les frais doivent être un nombre positif.`);
              }
            });
          }
        }
        if (totalPourcentages >= 100) {
          erreurs.push(`${ici} : le total des frais en % dépasse 100 %.`);
        }
      });
    }
  }
  return erreurs;
}