# Registre des Vérifications de Matériel

Solution complète de gestion des vérifications de matériel de sécurité caténaire ferroviaire (perches isolantes, LED de signalisation, VAT, drapeaux, signaux d'arrêt à main). L'interface web se connecte en écriture réelle à un classeur **Google Sheets** (voir docs/08) ; la conception complète SharePoint / Power Apps / Power Automate (docs/01 à 07) reste disponible comme référence si ce chantier est repris un jour sous Power Apps.

## Contenu du dépôt

| Élément | Emplacement |
|---|---|
| Interface web (accueil à vignettes, catégories, tableau général, saisie de contrôle) | [`index.html`](index.html), [`css/styles.css`](css/styles.css), [`js/app.js`](js/app.js) |
| Jeu de données de démonstration (mode avant connexion) | [`js/data.js`](js/data.js) |
| Connexion Google Sheets réelle (lecture des 4 onglets + écriture d'un contrôle) | [`js/google-sheets.js`](js/google-sheets.js), [`js/google-config.js`](js/google-config.js) |
| Guide Google Sheets : création du classeur, OAuth, déploiement | [`docs/08-migration-google-sheets.md`](docs/08-migration-google-sheets.md) |
| *(Référence)* Connexion SharePoint réelle (non utilisée par défaut) | [`js/sharepoint.js`](js/sharepoint.js), [`js/sharepoint-config.js`](js/sharepoint-config.js) |
| Analyse & schéma final des listes SharePoint | [`docs/01-analyse-et-structure-sharepoint.md`](docs/01-analyse-et-structure-sharepoint.md) |
| Conception de l'application Power Apps (écrans, navigation, composants) | [`docs/02-conception-power-apps.md`](docs/02-conception-power-apps.md) |
| Formules Power Fx (Filter, Search, Patch, Switch…) | [`docs/03-formules-power-fx.md`](docs/03-formules-power-fx.md) |
| Flux Power Automate (rappels, tâches, e-mails, PDF, archivage) | [`docs/04-flux-power-automate.md`](docs/04-flux-power-automate.md) |
| Guide de mise en œuvre pas à pas (SharePoint/Power Apps) | [`docs/05-guide-deploiement.md`](docs/05-guide-deploiement.md) |
| Conseils d'amélioration & bonnes pratiques Microsoft | [`docs/06-bonnes-pratiques.md`](docs/06-bonnes-pratiques.md) |
| Migration pas à pas de vos listes existantes vers le modèle final | [`docs/07-migration-listes-existantes.md`](docs/07-migration-listes-existantes.md) |
| Rôles, calendrier, ressources, export PDF, personnalisation | [`docs/09-roles-et-fonctionnalites.md`](docs/09-roles-et-fonctionnalites.md) |

## Aperçu de l'interface web

Ouvrir `index.html` dans un navigateur (aucune installation requise). Parcours :

- **Accueil** : statistiques globales + une vignette par catégorie d'équipement (avec répartition de conformité) + vignettes "Tableau général", "Calendrier" et "Ressources".
- **Vue catégorie** : galerie des matériels de la catégorie choisie, avec accès à l'historique et au bouton **Nouveau contrôle** (masqué pour le rôle Utilisateur).
- **Tableau général** : recherche instantanée, filtres (catégorie, conformité, statut, contrôleur, plage de dates), tri par colonne, code couleur 🟢🟠🔴⚪, export CSV.
- **Calendrier** : vue mensuelle des prochains contrôles par équipement, navigable mois par mois.
- **Ressources** : liste de documents/liens regroupés par catégorie (onglet `Ressources`, voir docs/09).
- **Fiche matériel** : historique complet des contrôles (accordéon), détail des points de contrôle par événement, export PDF.
- **Écran de contrôle** : sélection du contrôleur, case à cocher Conforme/Non conforme par point, observations/actions correctives/commentaires, bouton **✅ Valider le contrôle**.
- Gestion des rôles (Administrateur/Contrôleur/Utilisateur, voir docs/09), thème clair/sombre, responsive (poste de travail, tablette, mobile).

### Deux modes de fonctionnement

- **Mode démonstration** (par défaut, tant que vous n'êtes pas connecté) : les données viennent de `js/data.js` et le bouton "Valider le contrôle" simule l'enregistrement localement (rien n'est écrit dans Google Sheets).
- **Mode connecté** (après clic sur **🔑 Se connecter avec Google**) : les 4 onglets (`Materiels`, `TypesPointControle`, `Controles`, `ResultatsPointsControle`) d'un classeur Google Sheets sont lus via l'API Google Sheets, et le bouton "Valider le contrôle" **crée réellement** une ligne dans `Controles` + une ligne par point dans `ResultatsPointsControle`, avec l'utilisateur Google connecté comme contrôleur. Voir `js/google-config.js` pour l'identifiant du classeur et le Client ID, et `docs/08-migration-google-sheets.md` pour la création du classeur et le déploiement.

## Par où commencer

1. Lire `docs/08` pour créer le classeur Google Sheets et connecter la page.
2. *(Optionnel, référence SharePoint)* Lire `docs/01` à `docs/07` si vous souhaitez reprendre la voie SharePoint/Power Apps/Power Automate plus tard.
