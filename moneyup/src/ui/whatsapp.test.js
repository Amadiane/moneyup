// Tests du message WhatsApp (cahier des charges §8 et §12)
import { describe, it, expect, beforeAll } from 'vitest';
import { chargerConfig } from '../config/index.js';
import { simuler } from '../engine/simulateur.js';
import { construireMessage, lienWhatsApp } from './whatsapp.js';

let config;
beforeAll(async () => {
  config = await chargerConfig();
});

describe('Message WhatsApp', () => {
  it('Togo : contient frais MoneyUp ET frais Mixx by Yas', () => {
    const r = simuler(config, { paysId: 'togo', sens: 'depuisMaroc', deviseSaisie: 'MAD', montant: 1000, modeFrais: 'deduit' });
    const msg = construireMessage(r, config);
    expect(msg).toContain('Pays : Togo');
    expect(msg).toContain('Sens : Maroc → Togo');
    expect(msg).toContain('Montant de départ : 1 000 MAD');
    expect(msg).toContain('Montant estimé à recevoir : 56 600 XOF');
    expect(msg).toContain('Taux : 1 MAD = 60 XOF');
    expect(msg).toContain('Frais MoneyUp : 4 % (40 MAD)');
    expect(msg).toContain('Frais de retrait Mixx by Yas : 1 000 XOF');
  });

  it('Gabon : le frais MoneyUp à 0 % n\'apparaît pas', () => {
    const r = simuler(config, { paysId: 'gabon', sens: 'depuisMaroc', deviseSaisie: 'MAD', montant: 1000, modeFrais: 'deduit' });
    const msg = construireMessage(r, config);
    expect(msg).not.toContain('Frais MoneyUp');
    expect(msg).toContain('Frais de retrait Airtel Money : 1 800 XAF');
  });

  it('France : pas de frais opérateur, mode ajouté indiqué', () => {
    const r = simuler(config, { paysId: 'france', sens: 'versMaroc', deviseSaisie: 'EUR', montant: 100, modeFrais: 'ajoute' });
    const msg = construireMessage(r, config);
    expect(msg).toContain('Sens : France → Maroc');
    expect(msg).toContain('Frais : ajoutés à mon paiement');
    expect(msg).toContain('Total à payer : 105 EUR');
    expect(msg).not.toContain('Moyen :');
  });

  it('lien wa.me : numéro nettoyé et message encodé', () => {
    const lien = lienWhatsApp('+212 751 527 863', 'Bonjour MoneyUp,\nTest');
    expect(lien).toBe('https://wa.me/212751527863?text=Bonjour%20MoneyUp%2C%0ATest');
  });
});