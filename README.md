# Actes de cession — Commune de Tivaouane Peulh-Niaga

Application web statique (HTML/CSS/JS, aucune compilation) + base Supabase (gratuite) + hébergement Vercel (gratuit).
Elle fonctionne sans Claude et sans votre ordinateur allumé. Un seul acte par lot est garanti par la base de données.

## 1. Créer la base (Supabase, gratuit)
1. Créez un compte sur https://supabase.com puis « New project » (choisissez une région proche, ex. Paris). Notez le mot de passe de la base.
2. Menu **SQL Editor** → « New query » → collez le contenu de `supabase/schema.sql` → **Run**.
3. Nouvelle requête → collez le contenu de `seed.sql` (les 40 lots, fichier fourni À PART, jamais dans GitHub) → **Run**.
4. Menu **Authentication → Users → Add user** : saisissez votre e-mail et un mot de passe solide, cochez « Auto confirm user ».
5. **Authentication → Sign In / Providers → Email** : désactivez « Allow new users to sign up » (personne d'autre ne doit pouvoir créer de compte).
6. **Project Settings → API** : copiez « Project URL » et la clé « anon public ».

## 2. Configurer
Ouvrez `config.js` et remplacez les deux valeurs par celles copiées. (La clé anon est publique par conception : la sécurité vient des règles RLS de `schema.sql`, qui exigent une connexion.)

## 3. Mettre en ligne (GitHub + Netlify)
1. Envoyez le dossier dans le dépôt GitHub (sans `seed.sql`, déjà exclu par `.gitignore`).
2. Sur https://app.netlify.com : « Add new site → Import an existing project → GitHub » → choisissez le dépôt.
3. Build command : laisser vide. Publish directory : `.` (déjà réglé par `netlify.toml`) → **Deploy**.
4. Adresse `https://xxx.netlify.app` (modifiable dans Site configuration → Change site name). Chaque modification poussée sur GitHub redéploie le site.

## Utilisation
Connexion → choisir le **lot** → le propriétaire (cédant) s'affiche → saisir acquéreur et témoins → enregistrer. Le lot est alors verrouillé ; Word (.docx), impression et export CSV du registre sont disponibles. Pour le lot 133, Tamsir LO est l'acquéreur ; saisissez le cédant.

## À savoir
- Supabase gratuit met le projet en pause après ~1 semaine sans activité : connectez-vous de temps en temps, ou cliquez « Restore » dans le tableau de bord.
- Sauvegarde : exportez régulièrement le registre en CSV depuis l'onglet Registre.
