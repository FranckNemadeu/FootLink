const express = require("express");
const cors = require("cors");
const path = require("path");
// express → créer un serveur web
//cors → autoriser ton frontend (React) à parler au backend
const app = express();
const PORT = process.env.PORT || 5000;
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const isAllowedVercelPreview = (origin) => {
  try {
    const { hostname, protocol } = new URL(origin);

    return (
      protocol === "https:" &&
      /^foot-link(-git-[a-z0-9-]+)?-[a-z0-9-]+-franck-nemadeu-s-projects\.vercel\.app$/.test(hostname)
    );
  } catch {
    return false;
  }
};

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin) || isAllowedVercelPreview(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origine non autorisee par CORS"));
    },
  })
);
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

//cors() → permet à React (port 3000) de parler à ton serveur (5000)
//express.json() → permet de lire les données JSON envoyées
app.get("/", (req, res) => {
  res.send("API FootLink OK 🚀");
});

/* GET / = quand quelqu’un va sur :
http://localhost:5000
req = requête (ce que le client envoie)
res = réponse (ce que tu renvoies) */
require("dotenv").config();
/* dotenv → lire les variables d’environnement dans .env
/require("dotenv").config() → charge les variables d’environnement depuis le fichier .env
/Ça permet d’accéder à process.env.DB_HOST, process.env.DB_USER, etc. dans ton code
/Tu peux aussi accéder à process.env.JWT_SECRET pour la clé secrète du JWT
/Tu peux mettre des infos sensibles (comme les infos de la base de données ou la clé secrète du JWT) dans le fichier .env pour ne pas les exposer dans ton code
/Tu peux aussi ajouter d’autres variables d’environnement dans .env si tu en as besoin (par exemple une variable pour le port du serveur, ou une variable pour l’URL de ton frontend)
//N’oublie pas de mettre .env dans ton .gitignore pour ne pas le pousser sur GitHub
*/

const authRoutes = require("./routes/auth");
//authRoutes → les routes d’authentification (inscription, connexion)

app.use("/api/auth", authRoutes);
//app.use("/api/auth", authRoutes) → utilise les routes d’authentification pour toutes les requêtes commençant par /api/auth
//Par exemple, POST /api/auth/register va utiliser la route d’inscription définie dans routes/auth.js

const playerRoutes = require("./routes/player");
app.use("/api/player", playerRoutes);
//playerRoutes → les routes pour gérer le profil de joueur
//app.use("/api/player", playerRoutes) → utilise les routes de joueur pour toutes les requêtes commençant par /api/player
//Par exemple, POST /api/player va utiliser la route pour créer un profil de joueur définie dans routes/player.js

const matchRoutes = require("./routes/match");
app.use("/api/match", matchRoutes);
//matchRoutes → les routes pour gérer les matchs et les stats
//app.use("/api/match", matchRoutes) → utilise les routes de match pour toutes les requêtes commençant par /api/match
//Par exemple, POST /api/match va utiliser la route pour créer un match définie dans routes/match.js

const teamRoutes = require("./routes/team");
app.use("/api/team", teamRoutes);

app.listen(PORT, () => {
  console.log(`Server lance sur ${PORT}`);
});
// Lance le serveur sur le port 5000

