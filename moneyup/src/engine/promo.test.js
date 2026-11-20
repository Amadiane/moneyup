// =========================================================
// TESTS DES CODES PROMO
// Les 3 codes demandés par MoneyUp pour le Congo (20/11/2026).
// =========================================================

import { describe, it, expect, beforeAll } from 'vitest';
import { chargerConfig } from '../config/index.js';
import { simuler } from './simulateur.js';

let config;
beforeAll(async () => {
  config = await chargerConfig();
});

const code = (fraisOperateur, fraisService, paysId = 'congo', sens = 'tous') => ({
  code: 'TEST-123456', libelle: 'Code de test', paysId, sens, fraisOperateur, fraisService,
});
const sim = (paysId, sens, deviseSaisie, montant, promo, modeFrais = 'deduit') =>
  simuler(config, { paysId, sens, deviseSaisie, montant, modeFrais, promo });
const frais = (r, id) => [...r.fraisEnvoi, ...r.fraisRecu].find((f) => f.id === id);

describe('Congo → Maroc, 61 000 XAF (MTN 3,5 % + MoneyUp 10 %)', () => {
  it('sans code : 865 DH', () => {
    expect(sim('congo', 'versMaroc', 'XAF', 61000, null).netRecu).toBe(865);
  });

  it('code 1 : frais MTN offerts → 900 DH', () => {
    const r = sim('congo', 'versMaroc', 'XAF', 61000, code(0, null));
    expect(frais(r, 'operateur').montant).toBe(0);
    expect(frais(r, 'operateur').valeurInitiale).toBe(3.5);
    expect(frais(r, 'service').montant).toBe(6100);
    expect(r.netRecu).toBe(900);
    expect(r.promo.applique).toBe(true);
  });

  it('code 2 : frais MTN offerts + service à 9 % → 910 DH', () => {
    const r = sim('congo', 'versMaroc', 'XAF', 61000, code(0, 9));
    expect(frais(r, 'service').montant).toBe(5490);
    expect(frais(r, 'service').valeurInitiale).toBe(10);
    expect(r.netRecu).toBe(910);
  });

  it('code 3 : frais MTN offerts + service à 8 % → 920 DH', () => {
    const r = sim('congo', 'versMaroc', 'XAF', 61000, code(0, 8));
    expect(r.netRecu).toBe(920);
  });

  it('frais ajoutés : le total à payer baisse aussi', () => {
    const sans = sim('congo', 'versMaroc', 'XAF', 61000, null, 'ajoute');
    const avec = sim('congo', 'versMaroc', 'XAF', 61000, code(0, 8), 'ajoute');
    expect(sans.totalAPayer).toBe(69235); // 61 000 + 2 135 + 6 100
    expect(avec.totalAPayer).toBe(65880); // 61 000 + 0 + 4 880
  });
});

describe('Règles de sécurité des codes', () => {
  it('Maroc → Congo : le retrait MTN est offert, le service à 0 % ne remonte PAS à 9 %', () => {
    const r = sim('congo', 'depuisMaroc', 'MAD', 1000, code(0, 9));
    expect(frais(r, 'retrait').montant).toBe(0);
    expect(frais(r, 'service').montant).toBe(0);
    expect(r.netRecu).toBe(60000);
  });

  it('un code du Congo ne change rien au Gabon', () => {
    const r = sim('gabon', 'depuisMaroc', 'MAD', 1000, code(0, 0));
    expect(r.netRecu).toBe(58200);
    expect(r.promo.applique).toBe(false);
    expect(r.promo.corridor).toBe('Congo-Brazzaville (les deux sens)');
  });

  it('un code limité à Congo → Maroc ne s\'applique pas à Maroc → Congo', () => {
    const r = sim('congo', 'depuisMaroc', 'MAD', 1000, code(0, null, 'congo', 'versMaroc'));
    expect(r.promo.applique).toBe(false);
    expect(r.netRecu).toBe(57900);
  });

  it('un barème (Mixx by Yas) peut être offert', () => {
    const r = sim('togo', 'depuisMaroc', 'MAD', 1000, code(0, null, 'togo'));
    expect(frais(r, 'retrait').montant).toBe(0);
    expect(r.netRecu).toBe(57600); // 960 MAD × 60, sans les 1 000 XOF de Mixx
  });

  it('sans code, le résultat ne contient pas de promo', () => {
    expect(sim('congo', 'versMaroc', 'XAF', 61000, null).promo).toBe(null);
  });
});