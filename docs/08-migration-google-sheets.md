# 8. Connexion réelle via Google Sheets (alternative à SharePoint)

Suite au blocage du script personnalisé rencontré sur le site SharePoint (docs/05 §5.6), l'interface web se connecte désormais à un classeur **Google Sheets** pour la lecture et l'écriture réelles, via `js/google-sheets.js` et `js/google-config.js`. Le modèle de données SharePoint (docs/01 à 07) reste valide comme référence si vous reprenez un jour ce chantier sous Power Apps ; cette section documente uniquement le nouveau backend Google Sheets utilisé par la page HTML.

## 8.1 Pourquoi Google Sheets fonctionne sans blocage

Contrairement à SharePoint (qui refuse d'exécuter du script personnalisé sur les sites modernes sans intervention d'un administrateur), l'API Google Sheets est prévue pour être appelée depuis n'importe quel site web via OAuth : l'utilisateur clique sur **« Se connecter avec Google »**, autorise l'accès dans une fenêtre Google standard, et la page peut ensuite lire/écrire dans le classeur en son nom — aucun hébergement particulier n'est requis (GitHub Pages convient).

## 8.2 Créer le classeur

1. Allez sur **https://sheets.new** (crée un classeur vierge dans votre Drive).
2. Renommez le classeur, par exemple `RegistreVerifications - Base de données`.
3. Renommez le premier onglet (clic droit sur l'onglet en bas → Renommer) en **`Materiels`**, puis saisissez cette ligne d'en-tête en ligne 1 :
   ```
   NumSerie | Title | Reference | Categorie | Etat | PeriodiciteMois | Responsable | Actif
   ```
4. Ajoutez 3 onglets supplémentaires (bouton **+** en bas), avec ces en-têtes exacts en ligne 1 :
   - **`TypesPointControle`** : `Categorie | Title | Ordre` (`Title` = libellé du point de contrôle)
   - **`Controles`** : `ControleId | NumSerie | DateControle | DateProchainControle | Controleur | Conforme | Statut | Observations | ActionsCorrectives | Commentaires`
   - **`ResultatsPointsControle`** : `Title | Controle | Effectue | Observation | PointControle | Rapport | Statut` (`Controle` = identifiant du contrôle parent, `PointControle` = libellé du point)
5. Remplissez `Materiels` (une ligne par équipement) et `TypesPointControle` (une ligne par point de contrôle et par catégorie — voir la liste en §1.3/docs/01 pour LED signalisation, VAT, etc.). Les onglets `Controles` et `ResultatsPointsControle` peuvent rester vides : ils se remplissent automatiquement via le bouton "Valider le contrôle" de la page.
6. Copiez l'**identifiant du classeur** dans l'URL : `https://docs.google.com/spreadsheets/d/`**`CET_IDENTIFIANT`**`/edit` et collez-le dans `js/google-config.js`, propriété `spreadsheetId`.

> Les noms d'onglets doivent correspondre EXACTEMENT à ceux configurés dans `GOOGLE_CONFIG.feuilles` (`js/google-config.js`). Des colonnes supplémentaires (ex. `Item Type`, `Path` issues d'un export SharePoint) ne posent aucun problème : seules les colonnes listées ci-dessus sont utilisées.
> Sur `Controles`, les 10 colonnes ci-dessus doivent exister avec ces noms exacts — si cet onglet a été créé à partir d'un ancien export (type liste `VALIDITE`), remplacez sa ligne d'en-tête et videz les anciennes lignes de données avant de l'utiliser.

## 8.3 Configuration Google Cloud déjà réalisée

- Projet Google Cloud créé, API **Google Sheets API** activée.
- Écran de consentement OAuth configuré (type Externe, votre e-mail ajouté en utilisateur test).
- Identifiant OAuth (type Application Web) créé, avec comme origines JavaScript autorisées :
  - `https://lechatiti76-stack.github.io` (hébergement final GitHub Pages)
  - `http://localhost:8080` (tests locaux)
- Client ID renseigné dans `js/google-config.js` (`clientId`).

## 8.4 Fonctionnement de la page

- **Au chargement** : la page démarre toujours en **mode démonstration** (données de `js/data.js`), aucune connexion automatique n'est tentée (les navigateurs bloquent l'ouverture automatique d'une fenêtre d'authentification sans clic utilisateur).
- **Clic sur « Se connecter avec Google »** : ouvre la fenêtre d'autorisation Google, puis charge les 4 onglets réels et bascule l'interface en mode connecté (bandeau vert, sous-titre "Connecté à Google Sheets — *Nom*").
- **Bouton « Valider le contrôle »** : en mode connecté, ajoute une ligne dans `Controles` puis une ligne par point dans `ResultatsPointsControle`, avec un identifiant de contrôle généré (`C` + horodatage) — pas de risque de doublon, pas de colonne à auto-incrémenter à gérer côté tableur.
- **Reconnexion** : à chaque nouvelle session (fermeture/réouverture du navigateur), il faut recliquer sur « Se connecter avec Google » — le jeton d'accès n'est pas conservé après fermeture de l'onglet (choix volontaire, plus sûr qu'un jeton stocké en local).

## 8.5 Déploiement

1. Activer **GitHub Pages** sur ce dépôt : Paramètres du dépôt → Pages → Source = la branche contenant ces fichiers (fusionner vers la branche par défaut si nécessaire, GitHub Pages ne publie généralement qu'une seule branche désignée).
2. Une fois en ligne à `https://lechatiti76-stack.github.io/Cat-naire.page/`, vérifier que cette URL correspond bien à celle enregistrée comme origine JavaScript autorisée (§8.3) — sinon la connexion Google échouera avec une erreur `redirect_uri_mismatch` ou similaire.
3. Partager cette URL avec les contrôleurs habilités ; chacun se connecte avec son propre compte Google lors de sa première utilisation.

## 8.6 Limites à connaître

- **Accès au classeur** : chaque personne qui doit pouvoir écrire des contrôles doit avoir un accès **Éditeur** au classeur Google Sheets lui-même (partage du fichier, comme n'importe quel Google Sheet). Sans cet accès, la connexion OAuth réussit mais l'écriture échouera (erreur 403).
- **Écran de consentement en mode "Test"** : tant que l'application n'est pas soumise à validation Google (ce qui n'est pas nécessaire pour un usage interne restreint), seuls les comptes ajoutés comme "utilisateurs test" (§8.3) peuvent se connecter. Pour ouvrir l'outil à toute l'équipe, ajoutez chaque adresse e-mail concernée dans l'écran de consentement OAuth (jusqu'à 100 utilisateurs test).
- **Concurrence** : deux contrôleurs qui valident un contrôle au même instant n'entrent pas en conflit (chaque écriture est un ajout de ligne indépendant), contrairement à une modification simultanée d'une même cellule.
