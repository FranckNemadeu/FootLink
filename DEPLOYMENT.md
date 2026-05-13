# Deploiement FootLink

Architecture recommandee:

- Frontend React: Vercel
- Backend Express: Render
- Base MariaDB: Railway

## 1. Railway MariaDB

1. Cree un projet Railway.
2. Ajoute un service MariaDB.
3. Recupere les variables de connexion:
   - `DB_HOST`
   - `DB_PORT`
   - `DB_USER`
   - `DB_PASSWORD`
   - `DB_NAME`

MariaDB utilise souvent le port `3306`. Le backend FootLink utilise le package
`mysql2`, qui fonctionne avec MariaDB pour les requetes SQL utilisees dans ce
projet.

## 2. Render Backend

1. Cree un Web Service depuis le repo.
2. Root directory: `server`
3. Build command: `npm install`
4. Start command: `npm start`
5. Ajoute les variables:

```env
PORT=10000
FRONTEND_URL=https://ton-site.vercel.app
DB_HOST=...
DB_PORT=...
DB_USER=...
DB_PASSWORD=...
DB_NAME=...
JWT_SECRET=une-longue-valeur-secrete
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
RESEND_API_KEY=...
EMAIL_FROM="FootLink <onboarding@resend.dev>"
```

Alternative sans domaine Resend: utilise SMTP avec un compte Gmail et un mot de passe d'application.

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=ton-adresse@gmail.com
SMTP_PASS=ton-mot-de-passe-application-gmail
EMAIL_FROM=FootLink <ton-adresse@gmail.com>
```

Apres deploiement, note l'URL Render, par exemple:

```text
https://footlink-api.onrender.com
```

## 3. Vercel Frontend

1. Cree un projet Vercel depuis le repo.
2. Root directory: `client`
3. Framework preset: Create React App
4. Build command: `npm run build`
5. Output directory: `build`
6. Ajoute la variable:

```env
REACT_APP_API_URL=https://ton-backend-render.onrender.com
```

## 4. Connexion finale

Quand Vercel donne l'URL du frontend, retourne dans Render et mets:

```env
FRONTEND_URL=https://ton-site.vercel.app
```

Redeploie Render, puis teste:

- inscription joueur
- inscription equipe
- login
- dashboards
- pages publiques
- upload photo

## Note importante

Les fichiers uploades localement dans `server/uploads` ne sont pas un stockage durable sur Render. En production, FootLink utilise Cloudinary si les variables `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` et `CLOUDINARY_API_SECRET` sont configurees dans Render. Sans ces variables, le serveur garde le mode local pour le developpement.

Pour les emails de mot de passe oublie, FootLink utilise SMTP si `SMTP_HOST`, `SMTP_USER` et `SMTP_PASS` sont configures. Sinon il utilise Resend si `RESEND_API_KEY` est configuree. Sans ces variables, les liens sont affiches dans les logs du serveur pour faciliter les tests locaux.

Avec l'adresse par defaut `onboarding@resend.dev`, Resend limite l'envoi aux emails de test de ton propre compte Resend. Pour envoyer a tous les joueurs et clubs, verifie un domaine dans Resend puis remplace `EMAIL_FROM` par une adresse de ce domaine, par exemple `FootLink <noreply@ton-domaine.com>`.
