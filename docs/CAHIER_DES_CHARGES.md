# Cahier des charges - FootLink

Date : 15 mai 2026

## 1. Presentation du projet

FootLink est une plateforme web sportive qui connecte joueurs, clubs et visiteurs autour de profils publics, de statistiques, de demandes d'adhesion et de vitrines de clubs.

Le site permet aux joueurs de creer un profil sportif, de rejoindre un ou plusieurs clubs, de suivre leurs statistiques et d'etre visibles. Les clubs peuvent creer une page officielle, gerer leur effectif, accepter des demandes, inviter des joueurs, publier une galerie et renseigner les statistiques des matchs.

## 2. Objectifs

- Donner aux joueurs locaux une vitrine professionnelle.
- Permettre aux clubs de presenter leur equipe et leur effectif.
- Faciliter le recrutement et les demandes d'adhesion.
- Centraliser les statistiques sportives par joueur, club et saison.
- Offrir une experience premium, moderne et mobile.

## 3. Public cible

- Joueurs de soccer/football locaux.
- Clubs amateurs, semi-competitifs ou communautaires.
- Coachs, assistants, managers et recruteurs.
- Visiteurs qui veulent decouvrir clubs et joueurs.

## 4. Fonctionnalites principales

### Visiteur

- Consulter la page d'accueil.
- Voir les clubs mis en avant.
- Ouvrir la liste de tous les clubs.
- Consulter une fiche club publique.
- Consulter une fiche joueur publique.

### Joueur

- Creer un compte joueur.
- Verifier son adresse email.
- Se connecter.
- Modifier son profil.
- Ajouter/changer une photo de profil.
- Voir ses statistiques.
- Voir ses clubs.
- Demander a rejoindre un autre club.
- Recevoir et accepter/refuser une invitation de club.
- Supprimer son compte.

### Club

- Creer un compte club.
- Verifier son adresse email.
- Se connecter au dashboard equipe.
- Modifier le logo du club.
- Ajouter des photos dans la galerie.
- Voir et gerer les demandes recues.
- Inviter des joueurs.
- Gerer les roles : joueur, coach, assistant coach, manager, staff.
- Retirer un joueur de l'effectif actif.
- Consulter les anciens membres.
- Creer des matchs.
- Ajouter des statistiques.
- Choisir l'homme du match.
- Supprimer le compte club.

## 5. Fonctionnalites existantes a conserver

- Authentification joueur/club.
- Verification email.
- Mot de passe oublie.
- Upload Cloudinary.
- Emails via Resend.
- Routes React actuelles.
- API backend existante.
- Dashboards joueur et equipe.
- Pages publiques joueurs/clubs.
- Systeme de demandes et invitations.

## 6. Contraintes

- Ne pas casser l'authentification.
- Ne pas modifier les APIs sans migration controlee.
- Conserver la compatibilite mobile.
- Ne pas stocker les images uniquement sur le serveur de deploiement.
- Proteger les routes privees par token.
- Eviter les pages surchargees : limiter les listes visibles et utiliser des listes deroulantes/details.

## 7. Design attendu

- Style dark premium sportif.
- Couleurs principales : rouge, noir, blanc.
- Interface moderne inspiree de OneFootball, Hudl, SofaScore et EA Sports FC.
- Cards propres, boutons visibles, formulaires lisibles.
- Responsive mobile.
- Hierarchie claire des informations.

## 8. Livrables

- Application React.
- API Node/Express.
- Base de donnees MariaDB.
- Integration Cloudinary.
- Integration Resend.
- Documentation projet.
- Plan de tests.
- Checklist de lancement.

## 9. Criteres d'acceptation

- Un utilisateur peut s'inscrire, verifier son email et se connecter.
- Un joueur peut modifier son profil et demander a rejoindre un club.
- Un club peut accepter une demande et gerer son effectif.
- Les images restent accessibles apres deploiement.
- Les emails de verification et de mot de passe oublie fonctionnent.
- Le site est lisible sur mobile et desktop.
- Les pages publiques affichent les clubs et profils sans saturer l'ecran.
