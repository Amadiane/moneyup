// Point d'entrée de l'application MoneyUp.
// Étape 4 : on charge la configuration puis on monte le simulateur
// dans la zone #simulateur.

import './style.css';
import { chargerConfig } from './config/index.js';
import { simuler } from './engine/simulateur.js';
import { monterSimulateur } from './ui/simulateur.js';

const app = document.querySelector('#app');

app.innerHTML = `
  <header class="header">
    <div class="container header__inner">
      <a href="/" class="brand">
        <img src="/logo-moneyup.jpg" alt="MoneyUp Transfert" class="brand__logo" />
        <span class="brand__text">
          <strong>MONEY<span class="accent">UP</span></strong>
          <small>Transfert d'argent · Simulateur</small>
        </span>
      </a>
      <span class="badge">Simple · Rapide · Fiable</span>
    </div>
  </header>

  <main class="container">
    <section class="hero">
      <p class="eyebrow">Votre transfert, en toute clarté</p>
      <h1>Combien allez-vous envoyer ou recevoir ?</h1>
      <p class="hero__text">
        Choisissez le pays, le sens du transfert et le montant.
        Notre simulateur estime la conversion selon les paramètres MoneyUp affichés.
      </p>
    </section>

    <section id="simulateur">
      <p class="chargement">Chargement des tarifs…</p>
    </section>
  </main>

  <footer class="footer">
    <div class="container footer__inner">
      <span><strong>MONEYUP</strong> · Votre transfert, notre priorité.</span>
      <span>Simulateur informatif · Aucun transfert n'est déclenché sur cette page.</span>
    </div>
  </footer>
`;

async function demarrer() {
  const zone = document.querySelector('#simulateur');
  try {
    const config = await chargerConfig();
    monterSimulateur(zone, config);

    // Toujours disponible dans la console (F12) pour tester le moteur :
    //   tester({ paysId: 'togo', sens: 'depuisMaroc', deviseSaisie: 'MAD', montant: 1000 })
    window.tester = (demande) => simuler(config, demande);
  } catch (err) {
    console.error(err);
    zone.innerHTML = `<p class="chargement">Impossible de charger les tarifs. Réessayez dans un instant.</p>`;
  }
}

demarrer();