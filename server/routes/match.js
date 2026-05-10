const express = require("express");
const router = express.Router();

const matchController = require("../controllers/matchController");
const verifyToken = require("../middlewares/authMiddleware");

console.log("MATCH ROUTES LOADED ✅");

// CREATE MATCH
router.post("/", verifyToken, matchController.createMatch);

// ADD STATS
router.post("/stats", verifyToken, matchController.addStats);

// GET MATCH STATS
router.get("/:matchId", verifyToken, matchController.getMatchStats);

module.exports = router;

/* Ce fichier définit les routes pour gérer les matchs et les stats
Il utilise le contrôleur matchController pour la logique métier et le middleware verifyToken pour protéger les routes
Les routes définies sont :
POST /api/match → créer un match (protégé par verifyToken)
POST /api/match/stats → ajouter des stats à un match (protégé par verifyToken)
GET /api/match/:matchId → récupérer les stats d’un match (protégé par verifyToken)
*/ 