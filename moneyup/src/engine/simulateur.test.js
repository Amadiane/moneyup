// =========================================================
// TESTS DU MOTEUR (cahier des charges §12)
// Lancer :  npm test
// =========================================================

import { describe, it, expect, beforeAll } from 'vitest';
import { chargerConfig } from '../config/index.js';
import { BAREME_MIXX_BY_YAS } from '../config/tarifs.js';
import { simuler } from './simulateur.js';
import { fraisBareme } from './frais.js';

let config;
beforeAll(async () => {
  config = await chargerConfig();
});

// raccourci : simule et renvoie le résultat
const sim = (paysId, sens, deviseSaisie, montant, modeFrais = 'deduit') =>
  simuler(config, { paysId, sens, deviseSaisie, montant, modeFrais });

const frais = (r, id) => [...r.fraisEnvoi, ...r.fraisRecu].find((f) => f.id === id)?.montant;

// ---------------------------------------------------------
describe('Gabon', () => {
  it('Maroc → Gabon, 1 000 MAD, frais déduits (exemple du client)', () => {
    const r = sim('gabon', 'depuisMaroc', 'MAD', 1000);
    expect(r.montantConverti).toBe(60000);
    expect(frais(r, 'service')).toBe(0);
    expect(frais(r, 'retrait')).toBe(1800);
    expect(r.netRecu).toBe(58200);
    expect(r.totalAPayer).toBe(1000);
  });

  it('Maroc → Gabon, 1 000 MAD, frais ajoutés', () => {
    const r = sim('gabon', 'depuisMaroc', 'MAD', 1000, 'ajoute');
    expect(r.netRecu).toBe(60000);
    expect(r.fraisRecuPayesEnEnvoi).toBe(30); // 1 800 XAF = 30 MAD
    expect(r.totalAPayer).toBe(1030);
  });

  it('Gabon → Maroc : juste sous 50 000 XAF (1,5 % et 68)', () => {
    const r = sim('gabon', 'versMaroc', 'XAF', 49999);
    expect(r.taux.valeur).toBe(68);
    expect(frais(r, 'operateur')).toBe(750);
    expect(r.netRecu).toBe(724.25);
  });

  it('Gabon → Maroc : exactement 50 000 XAF (1 % et 67)', () => {
    const r = sim('gabon', 'versMaroc', 'XAF', 50000);
    expect(r.taux.valeur).toBe(67);
    expect(frais(r, 'operateur')).toBe(500);
    expect(r.netRecu).toBe(738.81);
  });

  it('Gabon → Maroc : juste au-dessus de 50 000 XAF', () => {
    const r = sim('gabon', 'versMaroc', 'XAF', 50001);
    expect(r.taux.valeur).toBe(67);
    expect(r.netRecu).toBe(738.82);
  });

  it('Calcul inverse : je veux que le bénéficiaire reçoive 58 200 XAF', () => {
    const r = sim('gabon', 'depuisMaroc', 'XAF', 58200);
    expect(r.calcul).toBe('inverse');
    expect(r.montantEnvoye).toBe(1000);
    expect(r.netRecu).toBe(58200);
  });
});

// ---------------------------------------------------------
describe('Congo-Brazzaville', () => {
  it('Maroc → Congo, 1 000 MAD : retrait MTN 3,5 %', () => {
    const r = sim('congo', 'depuisMaroc', 'MAD', 1000);
    expect(frais(r, 'retrait')).toBe(2100);
    expect(r.netRecu).toBe(57900);
  });

  it('Congo → Maroc, 10 000 XAF : MTN 3,5 % et MoneyUp 10 % sur le montant de départ', () => {
    const r = sim('congo', 'versMaroc', 'XAF', 10000);
    expect(frais(r, 'operateur')).toBe(350);
    expect(frais(r, 'service')).toBe(1000);
    expect(r.montantConverti).toBe(141.8); // 8 650 / 61
    expect(r.netRecu).toBe(141.8);
  });
});

// ---------------------------------------------------------
describe('Togo', () => {
  it('Maroc → Togo, 1 000 MAD : MoneyUp 4 % puis Mixx by Yas', () => {
    const r = sim('togo', 'depuisMaroc', 'MAD', 1000);
    expect(frais(r, 'service')).toBe(40);
    expect(r.montantConverti).toBe(57600);
    expect(frais(r, 'retrait')).toBe(1000);
    expect(r.netRecu).toBe(56600);
  });

  it('Togo → Maroc, 60 000 XOF : MoneyUp 4 %', () => {
    const r = sim('togo', 'versMaroc', 'XOF', 60000);
    expect(frais(r, 'service')).toBe(2400);
    expect(r.netRecu).toBe(960);
  });

  it('Calcul inverse Togo : je veux 56 600 XOF nets', () => {
    const r = sim('togo', 'depuisMaroc', 'XOF', 56600);
    expect(r.montantEnvoye).toBe(1000);
  });

  it.each([
    [500, 50], [501, 100],
    [5000, 100], [5001, 300],
    [20000, 300], [20001, 600],
    [50000, 600], [50001, 1000],
    [100000, 1000], [100001, 3100],
    [200000, 3100], [200001, 3700],
    [300000, 3700], [300001, 4200],
    [500000, 4200], [500001, 4400],
    [850000, 4400], [850001, 4600],
    [900000, 4600], [900001, 4900],
    [950000, 4900], [950001, 5100],
    [1000000, 5100], [1000001, 5150],
    [1500000, 9300], [2000000, 10200],
  ])('Barème Mixx by Yas : %i XOF → %i XOF de frais', (montant, attendu) => {
    expect(fraisBareme(montant, BAREME_MIXX_BY_YAS, true).toNumber()).toBe(attendu);
  });
});

// ---------------------------------------------------------
describe('France (taux différents selon le sens)', () => {
  it('Maroc → France, 1 100 MAD : 1 EUR = 11 MAD, 10 %', () => {
    const r = sim('france', 'depuisMaroc', 'MAD', 1100);
    expect(frais(r, 'service')).toBe(110);
    expect(r.netRecu).toBe(90);
  });

  it('France → Maroc, 100 EUR : 1 EUR = 10,7 MAD, 5 %', () => {
    const r = sim('france', 'versMaroc', 'EUR', 100);
    expect(frais(r, 'service')).toBe(5);
    expect(r.netRecu).toBe(1016.5);
  });
});

// ---------------------------------------------------------
describe('Saisies invalides', () => {
  it.each([
    ['', 'MONTANT_VIDE'],
    ['abc', 'MONTANT_INVALIDE'],
    ['-50', 'MONTANT_NEGATIF'],
    ['0', 'MONTANT_TROP_PETIT'],
    ['99999999999', 'MONTANT_TROP_GRAND'],
  ])('« %s » → %s', (saisie, code) => {
    const r = sim('gabon', 'depuisMaroc', 'MAD', saisie);
    expect(r.ok).toBe(false);
    expect(r.code).toBe(code);
  });

  it('accepte « 1 500,50 » (espace et virgule)', () => {
    expect(sim('france', 'depuisMaroc', 'MAD', '1 500,50').montantEnvoye).toBe(1500.5);
  });

  it('refuse une devise hors corridor', () => {
    expect(sim('gabon', 'depuisMaroc', 'EUR', 100).code).toBe('DEVISE_INVALIDE');
  });
});

// ---------------------------------------------------------
// Cohérence direct ↔ inverse sur TOUS les corridors, les deux
// modes et beaucoup de montants : si j'envoie A et que le
// bénéficiaire reçoit N, alors demander N doit donner un montant
// à envoyer <= A, et le net obtenu doit être >= N.
// ---------------------------------------------------------
describe('Cohérence calcul direct / calcul inverse', () => {
  const montants = [10, 99.99, 500, 833.33, 1000, 7500, 12345.67, 50000, 250000];
  for (const paysId of ['gabon', 'congo', 'togo', 'france']) {
    for (const sens of ['depuisMaroc', 'versMaroc']) {
      for (const mode of ['deduit', 'ajoute']) {
        it(`${paysId} ${sens} (${mode})`, () => {
          for (const m of montants) {
            const direct = sim(paysId, sens, sens === 'depuisMaroc' ? 'MAD' : config.pays.find((p) => p.id === paysId).devise, m, mode);
            // on ignore les nets sous le minimum de saisie (1)
            if (!direct.ok || direct.netRecu < config.parametres.montantMinimum) continue;
            const inverse = sim(paysId, sens, direct.deviseRecu, direct.netRecu, mode);
            expect(inverse.ok).toBe(true);
            expect(inverse.netRecu).toBeGreaterThanOrEqual(direct.netRecu);
            expect(inverse.montantEnvoye).toBeLessThanOrEqual(direct.montantEnvoye);
          }
        });
      }
    }
  }
});