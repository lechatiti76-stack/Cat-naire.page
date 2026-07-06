# 5. Documentation — guide de mise en œuvre pas à pas

## 5.1 Créer les listes SharePoint

1. Sur le site SharePoint cible, cliquer **Nouveau → Liste → Liste vierge**.
2. Créer la liste **`Materiels`** puis ajouter les colonnes du §1.3 (docs/01) une par une : **Paramètres de la liste → Créer une colonne**, en choisissant le type exact indiqué (Choice, Person, Date only, Image, Number, Yes/No).
3. Créer la liste **`TypesPointControle`** : colonnes `Categorie` (Choice, mêmes valeurs que `Materiels.Categorie`), `Title` (libellé du point), `Ordre` (Number). La remplir une fois par catégorie (ex. saisir les 6 points "LED signalisation" observés dans votre ancienne liste `LECBV2-2411-01154`).
4. Pour les colonnes **Choice** (Categorie, Etat, Statut), saisir les valeurs autorisées dans "Choix" et cocher "Valeur par défaut" si pertinent.
5. Créer la liste **`Controles`** avec les colonnes correspondantes.
6. Sur `Controles`, créer la colonne **`Materiel`** en type **Lookup**, pointant vers `Materiels`, colonne affichée `Title`, "Autoriser plusieurs valeurs" = **Non**, et ajouter en colonnes de projection `NumSerie`, `Categorie`, `Reference`, `Photo`.
7. Créer la liste **`ResultatsPointsControle`** avec une colonne **Lookup** `Controle` → `Controles.Title` et une colonne **Lookup** `PointControle` → `TypesPointControle.Title`, plus `Effectue` (Yes/No), `Rapport` (Choice), `Statut` (Choice), `Observation` (texte).
8. **Indexer les colonnes** utilisées en filtre : Paramètres de la liste → Colonnes d'index → Créer un index, pour `NumSerie`, `Categorie`, `Etat` (sur `Materiels`) et `DateControle`, `DateProchainControle`, `Materiel` (sur `Controles`), `Controle` (sur `ResultatsPointsControle`).
9. Définir les **permissions** : Paramètres de la liste → Autorisations pour cette liste → arrêter l'héritage → attribuer "Contribuer" aux contrôleurs, "Lecture" aux autres collaborateurs, "Contrôle total" aux administrateurs.
10. Vérifier l'unicité du n° de série via un flux Power Automate qui bloque la création si `NumSerie` existe déjà (action "Obtenir les éléments" + condition avant `Create Item`).
11. **Migration des données existantes** : reprendre le contenu de `VALIDITE` pour peupler `Controles` (dernier contrôle connu par équipement), et le contenu de chaque liste par équipement (`LECBV2-2411-01154`, `PerchePI56C2505005`…) pour peupler `TypesPointControle` (une fois par catégorie, en dédoublonnant) puis `ResultatsPointsControle` (en les reliant au contrôle correspondant). Cette migration peut se faire manuellement pour un faible volume, ou via un flux Power Automate ponctuel pour un grand nombre d'équipements.

## 5.2 Créer l'application Power Apps

1. Depuis [make.powerapps.com](https://make.powerapps.com), **Créer → Application vide → Canvas → Format téléphone**.
2. **Données → Ajouter une source de données → SharePoint**, se connecter au site, sélectionner `Materiels` et `Controles`.
3. Créer les écrans listés en 2.1 (docs/02) : clic droit dans le volet Écrans → **Nouvel écran** (choisir les modèles "Liste", "Détail", "Formulaire" proposés par Power Apps pour gagner du temps, puis les adapter).
4. Renseigner **App.OnStart** avec les variables/collections du §2.2 (docs/03), puis **Fichier → Paramètres → OnStart au lancement** doit être activé (ou déclencher manuellement `App.OnStart` via un bouton lors des tests, comportement standard de l'éditeur).
5. Construire chaque écran en suivant les composants détaillés en §2.3 à §2.7 : ajouter les contrôles (Gallery, Dropdown, DatePicker, Form, Pen Input, Camera), les nommer explicitement (`galListe`, `ddCategorie`, etc.) pour que les formules du §3 fonctionnent telles quelles.
6. Appliquer la charte graphique du §2.8 (couleurs, rayons, police) via le thème de l'application (**Accueil → Thèmes**) ou directement sur les propriétés `Fill`/`Color`/`BorderRadius` des contrôles.

## 5.3 Connecter SharePoint

- L'ajout de la source de données (étape 5.2.2) crée automatiquement la connexion. Vérifier dans **Fichier → Paramètres → Connexions à la source de données** que les deux listes apparaissent.
- Si l'application doit être partagée avec d'autres utilisateurs, s'assurer qu'ils disposent au minimum des droits de **Lecture** sur le site SharePoint, et que la connexion SharePoint utilisée est de type "à la demande de l'utilisateur connecté" (comportement par défaut du connecteur SharePoint dans Power Apps).

## 5.4 Publier l'application

1. **Fichier → Enregistrer**, choisir un nom de version clair (ex. "1.0 — mise en production").
2. **Fichier → Publier → Publier cette version**.
3. **Partager l'application** : Fichier → Partager → ajouter les utilisateurs/groupes Entra ID concernés avec le rôle "Utilisateur" (ou "Peut modifier" pour les futurs mainteneurs), et cocher "Envoyer un e-mail d'invitation".
4. Vérifier que les utilisateurs disposent d'une licence Power Apps (incluse dans de nombreux forfaits Microsoft 365, ou licence Power Apps par utilisateur/par application selon le volume).
5. Pour un usage terrain (contrôleurs en atelier), recommander l'installation de l'application **Power Apps mobile** (iOS/Android) et l'épinglage de l'application depuis celle-ci.

## 5.5 Mettre en place les automatisations

1. Depuis [make.powerautomate.com](https://make.powerautomate.com), **Créer** un flux pour chacun des 7 flux décrits en docs/04, en choisissant le bon type de déclencheur (automatisé pour les flux liés à un événement SharePoint, planifié pour les flux périodiques). Créer le flux 4.1 (génération des points de contrôle) en premier et le tester avant les autres : c'est lui qui remplace le geste manuel de création d'une liste par équipement.
2. Configurer la connexion SharePoint (même site, mêmes listes) puis la connexion Outlook/Teams pour les notifications.
3. Tester chaque flux avec **Tester → Manuellement** avant activation, en créant un enregistrement de test dans `Controles`.
4. Activer les flux (**Activé** en haut de l'éditeur) et vérifier dans **Historique des exécutions** après quelques jours d'utilisation réelle.
5. Pour le flux de génération PDF (§4.6), vérifier la disponibilité d'un connecteur de conversion PDF dans votre licence Microsoft 365/Power Automate (certains connecteurs premium nécessitent un plan Power Automate dédié).

## 5.6 Mettre en ligne l'interface HTML (avec écriture SharePoint réelle)

L'interface (`index.html`, `css/`, `js/`) inclut `js/sharepoint.js`, qui lit et **écrit réellement** dans les 4 listes SharePoint via l'API REST — mais uniquement si la page est ouverte depuis le site SharePoint lui-même (authentification par cookie de session de l'utilisateur connecté). Ouverte ailleurs (aperçu local, GitHub Pages...), l'application bascule automatiquement en mode démonstration.

### Étapes pour héberger la page sur `lhte76.sharepoint.com`

1. **Récupérer les fichiers** : depuis GitHub, ouvrir la branche `claude/equipment-verification-solution-l7y0rh` du dépôt → bouton **Code → Download ZIP** → extraire sur votre poste. Vous devez obtenir `index.html`, le dossier `css/` et le dossier `js/`.
2. **Créer une bibliothèque dédiée** sur le site : **Contenu du site → Nouveau → Bibliothèque de documents**, nommez-la par exemple `RegistreVerifications`.
3. **Glisser-déposer** dans cette bibliothèque : le fichier `index.html` à la racine, puis le dossier `css` et le dossier `js` complets (le glisser-déposer d'un dossier dans une bibliothèque moderne SharePoint conserve l'arborescence automatiquement — pas besoin de recréer les sous-dossiers à la main).
4. **Ouvrir `index.html`** : cliquez dessus dans la bibliothèque. Si SharePoint affiche un avertissement de sécurité avant ouverture, validez — c'est normal pour un fichier `.html`. Copiez ensuite l'URL de la page ouverte et ajoutez-la en favori, ou ajoutez un lien vers elle sur la page d'accueil du site (**Modifier la page → Ajouter une section → Web Part "Lien"**).
5. **Vérifier la connexion** : le bandeau sous l'en-tête doit indiquer *« Connecté à SharePoint — données en direct »*. S'il affiche à la place *« Mode démonstration »* ou un message d'erreur, voir le dépannage ci-dessous.

### Si la page ne s'exécute pas (avertissement de script bloqué)

Certains sites SharePoint Online ont l'option **« Empêcher l'exécution de script personnalisé »** activée par défaut (paramètre de sécurité anti-XSS), ce qui peut empêcher le JavaScript de la page de s'exécuter correctement lorsqu'elle est ouverte directement depuis une bibliothèque. Si c'est le cas :
- Un **administrateur SharePoint** peut lever cette restriction pour ce site précis via SharePoint Online Management Shell :
  ```powershell
  Connect-SPOService -Url https://lhte76-admin.sharepoint.com
  Set-SPOSite -Identity https://lhte76.sharepoint.com -DenyAddAndCustomizePages 0
  ```
- Si vous n'avez pas ces droits, contactez votre administrateur Microsoft 365/SharePoint en lui indiquant ce paramètre.

### Sécurité d'accès

La page hérite des **permissions de la bibliothèque** `RegistreVerifications` : donnez l'accès en lecture/écriture aux contrôleurs habilités à créer des contrôles (mêmes personnes que celles ayant "Contribuer" sur les listes `Controles`/`ResultatsPointsControle`, voir §5.1.9), et en lecture seule aux autres.

### Alternative sans écriture réelle

Si vous préférez d'abord valider l'ergonomie sans toucher aux listes réelles, la page fonctionne aussi telle quelle sur un **hébergement statique** (GitHub Pages, Azure Static Web Apps — c'est la configuration actuelle de ce dépôt) : le mode démonstration s'active automatiquement, avec simulation locale du bouton "Valider le contrôle".
