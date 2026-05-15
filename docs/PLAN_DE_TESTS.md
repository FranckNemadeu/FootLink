# Plan de tests - FootLink

Date : 15 mai 2026

## 1. Objectif

Verifier que les fonctionnalites principales de FootLink fonctionnent avant une mise en production ou apres un deploiement.

## 2. Environnement de test

- Frontend local : `http://localhost:3001` ou domaine Vercel.
- Backend local ou Render.
- Base MariaDB de test ou production controlee.
- Compte email accessible.
- Cloudinary configure.
- Resend configure.

## 3. Tests critiques

### Authentification

| Test | Etapes | Resultat attendu |
| --- | --- | --- |
| Inscription joueur | Creer un compte joueur | Le compte est cree et un email de verification est envoye |
| Inscription club | Creer un compte club | Le compte club est cree |
| Verification email | Cliquer sur le lien recu | L'adresse email est verifiee |
| Connexion | Se connecter avec email/mot de passe | Acces au bon dashboard |
| Mot de passe oublie | Demander un lien de reset | Email recu et mot de passe modifiable |
| Deconnexion | Cliquer sur deconnexion | Retour a l'accueil |

### Joueur

| Test | Etapes | Resultat attendu |
| --- | --- | --- |
| Modifier profil | Changer poste, ville, bio | Les donnees sont sauvegardees |
| Upload photo | Ajouter une image | L'image apparait et reste disponible |
| Demande club | Choisir un club et envoyer | La demande arrive cote club |
| Multi-clubs | Rejoindre un second club | Le club est ajoute sans supprimer l'ancien |
| Invitation | Accepter/refuser invitation | La liste se met a jour |
| Supprimer compte | Confirmer avec mot de passe | Le compte est supprime |

### Club

| Test | Etapes | Resultat attendu |
| --- | --- | --- |
| Upload logo | Changer le logo | Le logo apparait |
| Galerie | Ajouter/supprimer photo | La galerie est mise a jour |
| Demandes | Accepter/refuser demande | Le joueur est ajoute ou refuse |
| Recherche joueur | Filtrer et inviter | Invitation envoyee |
| Role joueur | Changer role | Le role est sauvegarde |
| Retirer joueur | Retirer de l'effectif | Le joueur quitte l'effectif actif |
| Match | Creer un match | Le match apparait |
| Stats | Ajouter stats et homme du match | Classements mis a jour |

### Pages publiques

| Test | Etapes | Resultat attendu |
| --- | --- | --- |
| Homepage | Ouvrir la page d'accueil | Landing moderne et responsive |
| Liste clubs | Rechercher un club | Resultats filtres |
| Fiche club | Ouvrir un club | Stats, effectif, matchs, galerie visibles |
| Fiche joueur | Ouvrir un joueur | Profil et stats visibles |

### Interface

| Test | Etapes | Resultat attendu |
| --- | --- | --- |
| Contraste | Verifier formulaires et boutons | Texte et champs toujours lisibles |
| Mobile | Tester largeur mobile | Pas de chevauchement, boutons accessibles |
| Empty states | Tester sans donnees | Messages propres et lisibles |
| Listes longues | Ajouter plusieurs items | Les pages ne sont pas surchargees |

## 4. Tests apres deploiement

- Ouvrir `https://www.footlink.ca`.
- Ouvrir `https://footlink.ca`.
- Verifier que les deux domaines montrent la derniere version.
- Tester inscription et connexion.
- Tester email verification.
- Tester reset password.
- Tester upload image.
- Tester une demande joueur vers club.

## 5. Critere de validation

Le deploiement est valide si :

- Le build frontend passe.
- Le backend Render est accessible.
- La base de donnees repond.
- Les emails partent.
- Les uploads Cloudinary fonctionnent.
- Les workflows joueur et club sont complets.
