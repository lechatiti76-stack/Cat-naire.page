# 10. Phase "application professionnelle" — permissions, journal, alertes, connexion individuelle, tableau de bord, galerie

Ce document couvre la demande de transformation en application de niveau entreprise. Vu l'ampleur du cahier des charges (authentification serveur, permissions détaillées, journal avec IP, galerie photos, bandeau d'alertes, tableau de bord, PWA, sauvegardes automatiques...), le travail est livré **par phases**. Les points listés en §1 à §6 sont livrés ; les autres (§7 "Ce qui reste") suivront dans une prochaine phase.

## 0. Un principe qui traverse tout le document

L'application reste **100% statique** (GitHub Pages + Google Sheets, sans serveur) — un choix fait plus tôt dans le projet car la politique de sécurité de l'organisation Google bloquait la création d'un compte de service nécessaire à un vrai serveur. Toute fonctionnalité présentée ci-dessous est donc un **best effort compatible avec cette contrainte**, pas une reproduction à l'identique d'une suite logicielle d'entreprise avec base de données serveur.

## 1. Permissions détaillées par personne

L'onglet `Utilisateurs` gagne une 4ᵉ colonne facultative **`Permissions`**. Chaque personne a désormais un jeu de permissions indépendantes (cases à cocher dans l'écran Administration), plutôt qu'un simple rôle figé :

| Permission | Ce qu'elle autorise |
|---|---|
| Tableau général | Recherche, filtres, tri dans la liste complète des contrôles |
| Calendrier | Vue calendrier des contrôles à venir |
| Ressources | Consultation des documents de l'onglet `Ressources` |
| Galerie photos | Consultation de la galerie photos |
| Historique | Ouvrir la fiche d'un matériel et son historique de contrôles |
| Nouveau contrôle | Créer/valider un contrôle |
| Export PDF | Bouton "Exporter en PDF" sur une fiche matériel |
| Export CSV | Bouton "Exporter CSV" du tableau général |

Le **rôle** (Administrateur / Contrôleur / Utilisateur) ne sert plus qu'à **préremplir** ces cases à cocher pour une nouvelle personne, ou en confort quand on change son rôle dans l'écran Administration (les cases se recochent avec les valeurs par défaut du rôle, modifiables avant d'enregistrer). Une fois enregistrées, les permissions d'une personne sont celles cochées, indépendamment de son rôle affiché.

**Simplification volontaire par rapport à une liste-type générique de 18 permissions** : pas de "Modifier/Supprimer un contrôle" (les contrôles sont en ajout seul — un historique de vérification de sécurité ne doit pas pouvoir être réécrit après coup), pas de "Ajouter/Modifier/Supprimer du matériel" ni "Importer/Exporter Excel" (le référentiel de matériel se gère directement dans le classeur Google Sheets, pas dans l'application). Ajouter des cases à cocher pour des actions que l'application ne sait pas faire aurait été trompeur.

## 1bis. Connexion individuelle (identifiant + mot de passe haché)

Le verrou partagé unique (`ADMIN_AUTH`) devient un **identifiant de secours** utilisé seulement pour démarrer (avant que quiconque n'ait ses propres identifiants). L'onglet `Utilisateurs` gagne deux colonnes supplémentaires, facultatives :

```
Email | Nom | Role | Permissions | Identifiant | MotDePasseHash
```

- Depuis l'écran Administration, on peut donner à chaque personne un **Identifiant** et un **mot de passe** (champ "Nouveau mot de passe" — laissé vide, le mot de passe existant n'est pas modifié). Le mot de passe n'est **jamais stocké en clair** : l'application calcule un hachage SHA-256 (`identifiant:motDePasse`, via l'API native `crypto.subtle` du navigateur, sans bibliothèque tierce) et c'est ce hachage qui part dans le classeur.
- Une fois connecté, chacun peut **changer son propre mot de passe** (carte "Changer mon mot de passe" en haut de l'écran Administration) — indisponible pour l'identifiant de secours, qui n'a pas de ligne à modifier (voir `js/google-config.js`, `ADMIN_AUTH`).
- **"Mot de passe oublié ?"** : structure prévue (lien sur l'écran de connexion) mais sans envoi d'e-mail, impossible sans serveur. Le texte affiché explique la marche à suivre réelle : un administrateur réinitialise un mot de passe temporaire depuis l'écran Administration (champ "Nouveau mot de passe" sur la ligne de la personne).
- Un bouton **"🔒 Verrouiller"** referme l'écran Administration (déconnexion du second facteur), indépendamment de la session Google.

⚠️ Comme pour l'ancien verrou partagé, ceci reste une protection de confort côté navigateur (voir §0) : le hachage empêche la lecture directe d'un mot de passe dans le classeur, mais n'importe qui avec un accès Éditeur au classeur pourrait remplacer le hachage par un hachage qu'il connaît. La vraie barrière reste le partage du classeur Google Sheets.

## 2. Journal des actions

Nouvel onglet optionnel **`Journal`** (créé automatiquement au premier événement si absent), consultable dans l'écran Administration :

```
Date       | Heure    | Utilisateur      | Action                                    | Adresse IP
2026-07-08 | 09:52:14 | Julien Marchand  | Contrôle validé — LED bleu n°55 (Conforme) | 90.12.34.56
```

Actions journalisées : connexion, ajout/modification/suppression d'un utilisateur, validation d'un contrôle.

⚠️ **L'adresse IP est déclarative, pas une preuve légale.** Le navigateur ne connaît pas sa propre adresse IP publique : elle est obtenue via un service tiers gratuit (`api.ipify.org`), sans clé ni compte. Si ce service est indisponible ou bloqué par un pare-feu, l'action est quand même journalisée, sans IP. Une personne technique pourrait aussi la falsifier (VPN, proxy) — ce journal aide à la traçabilité normale, ce n'est pas un dispositif de preuve inviolable (cela nécessiterait un serveur).

## 3. Bandeau d'alertes défilant

Bandeau fixé en bas de l'écran (façon bandeau d'actualités), qui liste les matériels dont le prochain contrôle approche (fenêtre de 60 jours, réglable via `GOOGLE_CONFIG.seuilBandeauJours`) :

- 🟢 vert : plus de 30 jours restants
- 🟠 orange : entre 7 et 30 jours
- 🔴 rouge : moins de 7 jours
- 🔴 rouge clignotant : moins de 48 heures, ou déjà en retard

Il disparaît automatiquement s'il n'y a aucune échéance dans la fenêtre. Un clic sur une alerte ouvre la fiche du matériel concerné (si la personne a la permission "Historique").

## 4. Tableau de bord enrichi

La vue "Tableau général" affiche désormais, au-dessus de la recherche/filtres, des indicateurs complémentaires (contrôles réalisés, contrôles en retard, matériel en alerte, échéances du mois, utilisateurs déclarés par rôle, dernière sauvegarde) et deux graphiques en barres (répartition du matériel par catégorie, contrôles par statut). Les graphiques sont des barres CSS simples (largeur proportionnelle à la valeur max), pas une bibliothèque de graphiques tierce — suffisant pour ce volume de données et cohérent avec le thème clair/sombre.

**Interprétation de "Utilisateurs connectés"** : sur une application 100% statique sans serveur, il n'existe pas de notion de session concurrente à observer (chaque navigateur a sa propre session Google indépendante). Le tableau de bord affiche donc plutôt le nombre de personnes **déclarées** dans l'onglet `Utilisateurs`, réparties par rôle. **"Dernière sauvegarde"** affichera la date du dernier export une fois la fonctionnalité de sauvegarde manuelle livrée (voir §7 ci-dessous) ; "Jamais" en attendant.

## 5. Galerie photos automatique

Dossier `assets/photos/` : déposez-y des fichiers `.jpg`, `.jpeg`, `.png` ou `.webp` (par exemple via "Add file → Upload files" sur GitHub, ou en les copiant avant un `git push`) — **rien d'autre à faire**. Une GitHub Action (`.github/workflows/photos-manifest.yml`) régénère automatiquement `assets/photos/manifest.json` (la liste des fichiers) à chaque envoi dans ce dossier ; l'application lit ce fichier et affiche les photos, sans aucune modification de code. Vignette "Galerie photos" sur l'accueil, avec le nombre de photos disponibles.

Diaporama (clic sur une vignette) : lecture automatique, pause, précédent/suivant, vitesse réglable (2 s / 4 s / 8 s), zoom (clic sur l'image), plein écran (API native du navigateur), fermeture (bouton ou touche Échap). Message "Aucune photo disponible" si le dossier est vide.

Si l'action GitHub ne peut pas s'exécuter (dépôt sans Actions activées, permissions insuffisantes), le manifeste peut aussi être modifié à la main — un simple tableau JSON de noms de fichiers.

## 6. Responsive et PWA installable

- **Tableau général** : sur petit écran (≤560px), le tableau devient une liste de cartes (une carte par ligne, libellé + valeur), au lieu de forcer un défilement horizontal illisible.
- **Grilles** (vignettes d'accueil, cartes de matériel) : une seule colonne sur mobile.
- **Formulaires et cases à cocher** (Administration) : empilés verticalement, boutons et cases à cocher agrandis pour une utilisation tactile confortable (cibles ≥ 44 px).
- **Menu** : l'application n'a pas de menu de navigation complexe à transformer en tiroir latéral (la navigation se fait par vignettes + fil d'Ariane, identique bureau/mobile) ; les actions d'en-tête (connexion, export, thème) s'empilent proprement sur petit écran.
- **PWA installable** : `manifest.webmanifest` + `sw.js` (service worker) permettent l'installation sur l'écran d'accueil (Android/iPhone/PC) et le fonctionnement plein écran. Le service worker met en cache uniquement la coquille statique (HTML/CSS/JS/icônes) — jamais les appels à Google Sheets ou à l'authentification, qui doivent toujours être à jour. Sans connexion, l'application s'ouvre donc en mode démonstration plutôt que de planter.
- **Notifications push** : non réalisables sans serveur (elles nécessitent un service capable de réveiller l'application même fermée) — hors de portée d'une architecture 100% statique.

## 7. Ce qui reste (prochaine phase)

- **Durcissement sécurité** : expiration de session par inactivité, anti-brute-force léger sur le verrou Administration.
- **Sauvegarde** : export/import JSON manuel depuis l'application, en complément de l'historique de versions natif de Google Sheets (Fichier → Historique des versions), qui sert déjà de sauvegarde automatique de fait.
