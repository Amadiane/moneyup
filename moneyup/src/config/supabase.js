// =========================================================
// CONNEXION À SUPABASE
// L'adresse et la clé publique viennent du fichier .env.local
// (jamais écrites en dur dans le code).
// Si elles manquent, "supabase" vaut null et le simulateur
// utilise les tarifs locaux de tarifs.js.
// =========================================================

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const cle = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Pendant les tests (npm test), on reste toujours sur les tarifs locaux.
const enTest = import.meta.env.MODE === 'test';

export const supabase = url && cle && !enTest ? createClient(url, cle) : null;