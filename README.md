# Plateforme de formation en ligne

Site statique HTML/JavaScript. Les données et l'accès sont gérés par Supabase, l'hébergement se fait sur Cloudflare Pages.

## Installation
1. Supabase > SQL Editor : exécuter `supabase/schema.sql`, puis `supabase/seed_admin.sql` après avoir remplacé `0XXXXXXXXX`.
2. Renseigner `SUPABASE_URL` et `SUPABASE_ANON_KEY` dans `config.js`.
3. Test local : `python3 -m http.server 8080`, puis ouvrir http://localhost:8080 (les modules ES ne fonctionnent pas en ouvrant le fichier directement).

## Accès
- Connexion : numéro + code à usage unique (8 caractères, valable 24 h, utilisable une seule fois).
- Admin : le menu « Inviter un membre » génère les codes (l'admin peut aussi s'en générer un pour son propre numéro). L'espace Administration permet d'ajouter et de supprimer des vidéos.

## Déploiement Cloudflare Pages
- Dashboard : Workers & Pages > Create > Pages > connecter ce dépôt GitHub, sans commande de build, dossier de sortie `/`.
- Ou en ligne de commande : `npx wrangler pages deploy . --project-name formation-en-ligne`
