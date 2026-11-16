// Configuration de Vite : le site a 2 pages.
//   index.html        -> le simulateur  (/)
//   admin/index.html  -> l'espace admin (/admin/)
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        simulateur: fileURLToPath(new URL('./index.html', import.meta.url)),
        admin: fileURLToPath(new URL('./admin/index.html', import.meta.url)),
      },
    },
  },
});