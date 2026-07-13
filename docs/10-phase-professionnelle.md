# 10. Phase "application professionnelle" — permissions, journal, alertes, connexion individuelle, tableau de bord, galerie

Ce document couvre la demande de transformation en application de niveau entreprise. Vu l'ampleur du cahier des charges (authentification serveur, permissions détaillées, journal avec IP, galerie photos, bandeau d'alertes, tableau de bord, PWA, sauvegardes automatiques...), le travail est livré **par phases**. Tous les points sont livrés (voir §13 pour le solde nul "Ce qui reste").

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

### Création automatique de l'onglet Utilisateurs

Si l'onglet `Utilisateurs` n'existe pas encore dans le classeur (ou a été supprimé), l'ajout du premier utilisateur depuis l'écran Administration le crée automatiquement, avec ses en-têtes (`Email | Nom | Role | Permissions | Identifiant | MotDePasseHash`), avant d'y écrire la personne — plus besoin de créer l'onglet à la main. Il en va de même pour l'onglet `Journal` (§2) à la première action journalisée. Un onglet déjà présent n'est jamais touché (aucune création, aucun en-tête réécrit).

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

**Interprétation de "Utilisateurs connectés"** : sur une application 100% statique sans serveur, il n'existe pas de notion de session concurrente à observer (chaque navigateur a sa propre session Google indépendante). Le tableau de bord affiche donc plutôt le nombre de personnes **déclarées** dans l'onglet `Utilisateurs`, réparties par rôle. **"Dernière sauvegarde"** affichera la date du dernier export une fois la fonctionnalité de sauvegarde manuelle livrée (voir §8 ci-dessous) ; "Jamais" en attendant.

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
  - ⚠️ Stratégie **réseau d'abord, cache en secours** (pas l'inverse) : avec une connexion, la dernière version déployée est toujours utilisée ; le cache ne sert que hors-ligne. Une première version en "cache d'abord" a pu, pendant le développement actif, servir un `index.html` mis en cache pas encore synchronisé avec un `app.js` plus récent (un bouton qui semble "ne rien faire" en est un symptôme typique) — corrigé. Si un souci de ce type se reproduit après une mise à jour, un rechargement forcé (Ctrl+Maj+R / Cmd+Maj+R) le résout.
- **Notifications push** : non réalisables sans serveur (elles nécessitent un service capable de réveiller l'application même fermée) — hors de portée d'une architecture 100% statique.

## 7. Durcissement sécurité

- **Expiration de session** : l'écran Administration se reverrouille automatiquement après 10 minutes sans activité (souris, clavier, tactile, défilement) — un message en informe l'utilisateur et l'action est journalisée.
- **Anti-brute-force léger** : après 5 tentatives de connexion Administration incorrectes, un blocage de 60 secondes s'applique (compteur en `localStorage`, réinitialisé à la première connexion réussie). C'est une protection de confort, pas un dispositif de sécurité serveur : elle ralentit un essai manuel ou un script simple, mais reste contournable en vidant le stockage local du navigateur.
- **Liens Ressources** : les liens de l'onglet `Ressources` sont maintenant validés (seuls `http://`/`https://` sont acceptés) avant d'être utilisés comme `href`, ce qui bloque une URL `javascript:` malveillante qu'un simple échappement HTML ne suffit pas à neutraliser.
- **Revue XSS** : toutes les valeurs affichées provenant du classeur Google Sheets (noms, observations, e-mails, libellés, noms de fichiers de la galerie, entrées du journal...) passent par la fonction `escapeHtml()` avant insertion dans la page.

## 8. Sauvegarde

- **Exporter une sauvegarde complète (JSON)** (écran Administration) : télécharge un fichier horodaté contenant matériels, contrôles, utilisateurs, ressources, photos et journal. Chaque export est aussi noté dans un petit historique local (jusqu'à 10 dates, visible dans le même écran) et met à jour "Dernière sauvegarde" du tableau de bord.
- **Charger un fichier de sauvegarde (aperçu)** : relit un fichier exporté et affiche un résumé (nombre de matériels/contrôles/utilisateurs/ressources). Ce fichier n'est **volontairement pas réinjecté automatiquement** dans Google Sheets : un import automatique mal aligné (colonnes, doublons) pourrait corrompre des données réelles de sécurité. Il sert d'archive/de référence.
- **Restauration réelle recommandée** : l'historique de versions natif de Google Sheets (menu **Fichier → Historique des versions** dans le classeur) reste le moyen sûr de tout restaurer en un clic — c'est la "sauvegarde automatique" de fait de cette architecture, sans risque de désynchronisation de colonnes.

## 9. Actualisation des données sans reconnexion

Le bouton **"🔄 Actualiser"** (en-tête, à côté de "Se connecter avec Google") recharge Materiels/Controles/Utilisateurs/Ressources depuis le classeur **sans repasser par la connexion Google** — le jeton d'accès obtenu au moment de la connexion reste valide en mémoire le temps de la session du navigateur, inutile de tout recommencer pour voir une modification faite directement dans Google Sheets (ex. un contrôle ajouté par quelqu'un d'autre, un matériel désactivé).

Une actualisation automatique et silencieuse a également lieu toutes les 60 secondes en arrière-plan, sauf pendant une saisie de contrôle ou dans l'écran Administration (pour ne jamais faire perdre une saisie non enregistrée). Un clic manuel sur "Actualiser" pendant une saisie de contrôle demande confirmation avant de continuer, pour la même raison.

**Correctif** : si la fenêtre "Échéances" ou la fiche d'un matériel est ouverte au moment d'une actualisation (manuelle ou automatique), son contenu est maintenant rafraîchi en même temps que le reste de la page. Avant ce correctif, une fenêtre déjà ouverte restait figée sur son instantané du moment de l'ouverture — ce qui pouvait afficher un nombre de jours restants incohérent avec le bandeau d'alertes (rafraîchi, lui, avec la vue de fond) si un contrôle avait été validé entre-temps.

**Deuxième correctif (chevauchement d'actualisations)** : si l'actualisation automatique (toutes les 60 s) se déclenchait pendant qu'une actualisation manuelle était encore en cours (ou deux clics rapprochés sur "Actualiser"), les deux requêtes réseau pouvaient se chevaucher — celle qui terminait en DERNIER écrasait l'affichage avec ses données, même si elle avait été lancée avant l'autre, provoquant des incohérences entre le bandeau et une fenêtre modale ouverte au même moment. Un verrou empêche maintenant deux actualisations de tourner simultanément.

**Troisième correctif (contrôle non reflété immédiatement)** : après validation d'un contrôle en mode connecté (pas en démonstration), le contrôle est maintenant aussi ajouté à l'état local de l'application (bandeau, fenêtre Échéances, tableau de bord) immédiatement, sans attendre la prochaine actualisation — utile en particulier si plusieurs contrôles sont validés à la suite.

## 10. Fenêtre "Échéances" (liste complète, triée, colorée)

Une **bannière pleine largeur** sur l'accueil (au-dessus des vignettes, format volontairement différent — pas une vignette carrée) résume les échéances ("6 en retard · 2 urgents (≤ 7 j) · 1 à surveiller (≤ 30 j)") et ouvre, au clic, une fenêtre listant **tous** les matériels (pas seulement ceux en alerte), du plus urgent au plus tranquille : pastille et texte colorés (vert au-delà de 30 jours, orange entre 7 et 30, rouge en dessous de 7 ou en retard), et "Jamais contrôlé" pour un matériel sans historique. Un clic sur une ligne ouvre sa fiche (si la personne a la permission "Historique"). Complète le calendrier mensuel (§3) par une vue liste, plus rapide à parcourir pour un rappel global. Visible uniquement s'il y a du matériel et si la personne a la permission "Historique" ; le libellé "ALERTES" du bandeau défilant n'est plus cliquable (un seul point d'entrée, plus clair).

## 11. Photo de l'équipement le jour du contrôle (Google Drive)

Sur l'écran "Nouveau contrôle", un champ **"📷 Photo(s) de l'équipement"** permet de prendre une ou plusieurs photos avec l'appareil du téléphone (`capture="environment"` ouvre l'appareil photo arrière sur mobile) ou d'en choisir depuis la galerie — avec aperçu miniature et possibilité de retirer une photo avant de valider.

**Stockage** : Google Sheets ne sait pas stocker d'images. À la validation, chaque photo est envoyée dans un dossier Google Drive dédié (`GOOGLE_CONFIG.dossierPhotosControles`, **créé automatiquement** au premier envoi s'il n'existe pas encore, comme les onglets Utilisateurs/Journal). Les liens obtenus sont enregistrés dans la nouvelle colonne `Photos` de l'onglet `Controles` (plusieurs liens séparés par des virgules) et affichés dans l'historique du matériel et l'export PDF sous forme de liens "📷 Photo 1", "📷 Photo 2"...

**Prérequis technique (une fois)** :
1. Activer l'**API Google Drive** dans le même projet Google Cloud que l'API Sheets (Bibliothèque d'API → rechercher "Google Drive API" → Activer).
2. Se reconnecter une fois via "Se connecter avec Google" : l'application demande un nouveau droit (`drive.file`), limité aux seuls fichiers qu'elle crée elle-même — elle n'a **aucun accès** au reste du Drive de la personne connectée.

⚠️ **Partage du dossier** : le dossier Drive est créé dans le Drive de la première personne qui prend une photo. Pour que d'autres administrateurs/contrôleurs voient ces photos, partagez ce dossier depuis Google Drive (clic droit → Partager) comme vous l'avez fait pour le classeur Google Sheets — l'application ne peut pas le faire à votre place (le scope `drive.file` ne permet pas de gérer les partages d'un fichier créé par quelqu'un d'autre).

En mode démonstration, les photos restent visibles en aperçu local (non envoyées, aucun compte Google Drive n'étant connecté).

## 12. Fiche publique par QR code (fiche.html)

Nouvelle page autonome **`fiche.html`**, **sans connexion Google**, pensée pour être collée en QR code sur chaque équipement : un technicien scanne le code avec son téléphone, la page s'ouvre directement et affiche nom, catégorie, n° de série, date du dernier contrôle, date du prochain contrôle et **jours restants recalculés à chaque ouverture** (pas une valeur figée — scannez aujourd'hui "22 jours", demain "21 jours", automatiquement, sans rien recalculer ni vous connecter).

### ⚠️ Compromis de confidentialité (choix assumé)

Cette page fonctionne **sans authentification**, donc **sans les protections du reste de l'application** : quiconque possède le lien peut consulter la fiche, pas seulement en scannant physiquement le QR code (un lien peut être copié, transféré, retrouvé). Techniquement, cela impose de rendre certaines données du classeur **lisibles publiquement** sur le Web, via la fonctionnalité native de Google Sheets "Publier sur le Web" (indépendante du partage habituel du classeur) :

1. Dans Google Sheets, **Fichier → Partager → Publier sur le Web**.
2. Choisissez l'onglet **`Materiels`**, format **CSV**, cliquez sur "Publier". Copiez l'URL fournie.
3. Recommencez pour l'onglet **`Controles`**.
4. Collez les deux URL dans `js/google-config.js`, propriété `GOOGLE_CONFIG.fichePublique` (`urlCsvMateriels`, `urlCsvControles`).

**Ne publiez jamais** les onglets `Utilisateurs` (mots de passe hachés) ou `Journal` (adresses IP) de cette façon — seuls `Materiels` et `Controles` sont nécessaires à cette page, et ce sont les seuls qu'elle lit. Sachez cependant que publier `Controles` rend aussi publiques les observations/actions correctives/commentaires de vos contrôles, pas seulement les dates — si vous voulez restreindre davantage, un onglet dédié "Public" (recopiant juste les colonnes utiles via une formule) et publié à la place de `Controles` est possible sur demande.

### Générer un QR code

Dans la fiche d'un matériel (bouton **"🔗 QR code"**), l'application affiche une image de QR code (générée par le service public gratuit `api.qrserver.com`, à partir de l'URL de la fiche publique — aucune donnée de contrôle n'y est envoyée, seule l'URL) ainsi que le lien en texte, copiable, à coller vous-même dans un générateur d'étiquettes ou un traitement de texte pour l'imprimer et le coller sur l'équipement.

## 13. Ce qui reste

Rien d'identifié pour l'instant : tous les points du cahier des charges compatibles avec une architecture 100% statique (sans serveur) sont livrés. Les points explicitement hors de portée sans serveur (notifications push, sauvegarde automatique programmée côté serveur, sécurité serveur réelle pour les mots de passe/CSRF/injection SQL) sont documentés comme tels à chaque section concernée plutôt que simulés.

