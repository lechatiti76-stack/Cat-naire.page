# 9. Rôles, calendrier, ressources et export PDF

Ce document couvre les fonctionnalités ajoutées après la mise en service initiale : gestion des rôles, sélection du contrôleur, calendrier des échéances, ressources documentaires, export PDF, et personnalisation (logo, pied de page).

## 9.1 Gestion des rôles

Un nouvel onglet optionnel **`Utilisateurs`** peut être ajouté au classeur Google Sheets :

```
Email                          | Nom              | Role
julien.marchand@example.com    | Julien Marchand  | Contrôleur
amandine.roy@example.com       | Amandine Roy     | Administrateur
```

- **Rôles reconnus** : `Administrateur`, `Contrôleur`, `Utilisateur`. Chaque rôle combine deux droits (`js/google-config.js`, `ROLES_CONFIG`) :

  | Rôle | Peut créer/valider un contrôle | Accès Tableau général / Calendrier / Ressources / Historique / Export PDF |
  |---|---|---|
  | **Administrateur** | Oui | Oui — accès à tout |
  | **Contrôleur** | Oui | **Non** — voit uniquement les vignettes de catégorie et le bouton "Nouveau contrôle" |
  | **Utilisateur** | Non (boutons masqués) | Oui — consultation complète, sans pouvoir créer de contrôle |

- Le nom affiché dans l'application (contrôleur présélectionné, en-tête) est celui de la colonne **`Nom`** de l'onglet `Utilisateurs` (ex. "PATON ROMUALD"), pas le nom du compte Google — pratique si le nom du compte Google diffère du nom d'usage.
- Si l'onglet `Utilisateurs` est **absent ou vide**, ou si l'adresse e-mail de la personne connectée n'y figure pas, elle est traitée comme **Contrôleur** par défaut (pour ne pas bloquer l'usage tant que la liste n'est pas complétée). Ajustable dans `js/google-config.js` (`ROLE_PAR_DEFAUT`).
- Le rôle est affiché dans un badge en haut à droite de la page une fois connecté. Toute tentative d'atteindre une section non autorisée (ex. URL directe, ancien signet) affiche un message d'avertissement et renvoie à l'accueil.

## 9.1bis Écran Administration (gestion des utilisateurs)

La vignette "Administration" est visible sur l'accueil pour **tout le monde**, mais son contenu est protégé par un **second verrou identifiant/mot de passe** (`ADMIN_AUTH` dans `js/google-config.js`), volontairement indépendant du rôle détecté via l'onglet `Utilisateurs` — cela évite qu'un souci de lecture de cet onglet (en-tête mal orthographié, e-mail non reconnu...) bloque l'accès à l'administration elle-même. Changez `identifiant`/`motDePasse` dans `js/google-config.js` avant mise en production.

⚠️ Ce mot de passe est visible dans le code source de la page (Affichage → Code source du navigateur) : c'est un verrou pratique contre un clic accidentel, pas une protection contre une personne technique malveillante. Le verrou se réinitialise à chaque rechargement de page (non mémorisé).

Une fois déverrouillé, cet écran permet de gérer l'onglet `Utilisateurs` directement depuis l'application, sans toucher au classeur à la main :
- **Ajouter** une personne (e-mail, nom affiché, rôle).
- **Modifier** le nom ou le rôle d'une personne existante (bouton "Enregistrer" sur sa ligne).
- **Supprimer** une personne (bouton "Supprimer").

Ces actions écrivent directement dans l'onglet `Utilisateurs` de votre classeur, avec les droits d'écriture de l'Administrateur actuellement connecté — aucun compte de service ni mot de passe séparé n'est nécessaire. C'est l'alternative retenue à un système identifiant/mot de passe indépendant, qui aurait nécessité un petit serveur pour rester sécurisé (voir note ci-dessous).

### Reconnexion automatique

Après une première connexion réussie, le navigateur retient que vous vous êtes déjà connecté (`localStorage`). À la prochaine ouverture de la page, l'application retente une connexion Google **sans que vous ayez besoin de cliquer** sur le bouton — cela ne fonctionne que si votre session Google est toujours active dans le navigateur ; un bref affichage de la fenêtre de compte Google est possible (Google ne garantit pas un enchaînement 100% invisible). En cas d'échec silencieux, l'application reste simplement en mode démonstration, avec le bouton "Se connecter avec Google" disponible comme avant.

### Pourquoi pas un vrai identifiant/mot de passe indépendant de Google ?

Un tableau identifiant/mot de passe "à la SharePoint SCADA" (comme les systèmes de supervision industrielle) nécessiterait un compte de service Google caché derrière un petit serveur (Cloudflare Worker ou équivalent) pour rester sécurisé — sans quoi les identifiants de connexion à Google Sheets seraient visibles dans le code de la page, accessibles à quiconque via "Afficher le code source". Cette voie a été explorée mais bloquée par une politique de sécurité de l'organisation Google du compte utilisé (`iam.disableServiceAccountKeyCreation`, désactivation de la création de clés de compte de service). La solution retenue (connexion Google individuelle + gestion des rôles dans l'application) offre une sécurité réelle sans dépendre d'une infrastructure supplémentaire.

**⚠️ Important — ceci n'est PAS une sécurité réelle** : c'est un confort d'affichage côté navigateur (masquer des boutons). Un utilisateur techniquement averti pourrait contourner ces masquages puisque tout le code s'exécute dans son propre navigateur. La vraie sécurité reste le **partage du classeur Google Sheets** : seules les personnes ayant un accès **Éditeur** peuvent réellement écrire des données, quel que soit ce que montre l'interface. Pour restreindre réellement l'écriture, gérez les accès du classeur (Partager → Éditeur / Lecteur) en cohérence avec les rôles déclarés dans l'onglet `Utilisateurs`.

## 9.2 Sélection du contrôleur

Sur l'écran "Nouveau contrôle", le champ Contrôleur est désormais une **liste déroulante** peuplée à partir de l'onglet `Utilisateurs` (personnes avec le rôle Administrateur ou Contrôleur). L'utilisateur actuellement connecté est présélectionné s'il figure dans la liste ; sinon il est ajouté en tête de liste avec la mention "(vous)". Ça permet à un contrôleur de déclarer un contrôle réalisé par un collègue sans que ce dernier ait besoin de se connecter lui-même.

## 9.3 Calendrier des contrôles à venir

Nouvelle vue accessible depuis la vignette **"Calendrier"** sur l'accueil : affiche un mois à la fois, avec chaque équipement positionné sur le jour de son **prochain contrôle** (calculé à partir du dernier contrôle enregistré + périodicité du matériel). Couleur de la pastille = statut (🟢🟠🔴⚪, cohérent avec le reste de l'application). Navigation mois précédent/suivant. Un clic sur une échéance ouvre la fiche du matériel concerné.

## 9.4 Ressources documentaires

Nouvel onglet optionnel **`Ressources`** :

```
Titre                                          | Lien                              | Categorie
Procédure de contrôle des perches isolantes    | https://drive.google.com/...      | Procédures
Fiche de sécurité VAT                          | https://drive.google.com/...      | Sécurité
```

- `Lien` peut pointer vers n'importe quelle URL : fichier Google Drive (partagé en lecture aux personnes concernées), page web, PDF hébergé ailleurs, etc.
- `Categorie` est optionnelle ; les documents sont regroupés par catégorie dans la vue "Ressources" de l'application.
- Vignette "Ressources" sur l'accueil, indiquant le nombre de documents disponibles.

## 9.5 Export PDF par équipement

Depuis la fiche d'un matériel (bouton **🖨️ Exporter en PDF**), l'application génère une vue imprimable propre (informations du matériel + historique complet des contrôles + détail des points de contrôle) et ouvre directement la boîte d'impression du navigateur. Choisissez **"Enregistrer au format PDF"** comme imprimante dans cette boîte de dialogue pour obtenir un fichier PDF.

Ce choix (impression navigateur plutôt que génération directe) évite d'ajouter une bibliothèque JavaScript supplémentaire au projet ; il fonctionne dans tous les navigateurs modernes sans configuration.

## 9.6 Logo et pied de page

- Le logo en haut à gauche est actuellement un badge texte **"LHTE"** (`index.html`, classe `.icon--logo-lhte`), en attendant le fichier image du vrai logo. Pour l'intégrer : remplacez le `<span>` par une balise `<img src="assets/logo-lhte.png" alt="LHTE">` et déposez le fichier dans un dossier `assets/`.
- Le pied de page affiche les coordonnées de l'organisation (Terminal Multimodal du Havre — Service Circulation Ferroviaire — Agent caténaire · Habilitation Agent E CH1CB1), modifiables directement dans `index.html` (section `<footer>`) ou via `GOOGLE_CONFIG.organisation` dans `js/google-config.js` si vous préférez centraliser cette information.
