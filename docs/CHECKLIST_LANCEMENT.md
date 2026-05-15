# Checklist de lancement - FootLink

Date : 15 mai 2026

## 1. Domaine et deploiement

- [ ] `https://footlink.ca` fonctionne.
- [ ] `https://www.footlink.ca` fonctionne.
- [ ] Le frontend Vercel affiche la derniere version.
- [ ] Le backend Render est actif.
- [ ] Les variables d'environnement Vercel sont correctes.
- [ ] Les variables d'environnement Render sont correctes.

## 2. Emails

- [ ] Domaine Resend verifie.
- [ ] `EMAIL_FROM` utilise le domaine verifie.
- [ ] Verification email recue.
- [ ] Reset password recu.
- [ ] Les emails ne tombent pas en spam pendant les tests.

## 3. Images

- [ ] Upload photo joueur fonctionne.
- [ ] Upload logo club fonctionne.
- [ ] Upload galerie fonctionne.
- [ ] Les images restent accessibles apres redeploiement.

## 4. Parcours joueur

- [ ] Inscription joueur.
- [ ] Verification email.
- [ ] Connexion.
- [ ] Modification profil.
- [ ] Demande a rejoindre un club.
- [ ] Acceptation invitation.
- [ ] Suppression compte.

## 5. Parcours club

- [ ] Inscription club.
- [ ] Verification email.
- [ ] Connexion dashboard equipe.
- [ ] Logo.
- [ ] Galerie.
- [ ] Recherche joueur.
- [ ] Invitation joueur.
- [ ] Acceptation demande.
- [ ] Creation match.
- [ ] Ajout statistiques.
- [ ] Homme du match.
- [ ] Suppression compte.

## 6. UI/UX

- [ ] Homepage lisible desktop.
- [ ] Homepage lisible mobile.
- [ ] Dashboard joueur lisible mobile.
- [ ] Dashboard equipe lisible mobile.
- [ ] Tous les boutons sont visibles.
- [ ] Tous les champs de formulaire sont lisibles.
- [ ] Empty states propres.
- [ ] Textes sans fautes visibles.

## 7. Securite minimale

- [ ] Pas de secrets dans Git.
- [ ] `.env` non commite.
- [ ] CORS limite aux bons domaines.
- [ ] Routes privees protegees.
- [ ] Suppression compte confirmee par mot de passe.

## 8. Avant annonce publique

- [ ] Creer 2 a 3 clubs de demonstration.
- [ ] Creer 5 a 10 joueurs de demonstration.
- [ ] Ajouter photos/logos propres.
- [ ] Tester sur telephone.
- [ ] Tester dans un navigateur prive.
- [ ] Preparer un court texte de presentation.
