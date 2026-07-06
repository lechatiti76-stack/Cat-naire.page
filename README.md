# Registre des Vérifications de Matériel

Solution complète de gestion des vérifications de matériel de sécurité caténaire ferroviaire (perches isolantes, LED de signalisation, VAT, drapeaux, signaux d'arrêt à main) : listes SharePoint, application Power Apps, automatisations Power Automate et interface web de consultation.

Le modèle de données (`docs/01`) a été conçu à partir de l'analyse réelle des listes existantes (`VALIDITE`, `Source Application Dashboard Caténaire`, et les listes créées par équipement comme `LECBV2-2411-01154`), pour supprimer la pratique d'une liste SharePoint par équipement et fiabiliser le calcul des statuts.

## Contenu du dépôt

| Élément | Emplacement |
|---|---|
| Interface web (accueil à vignettes, catégories, tableau général, saisie de contrôle) | [`index.html`](index.html), [`css/styles.css`](css/styles.css), [`js/app.js`](js/app.js) |
| Jeu de données de démonstration (mode hors SharePoint) | [`js/data.js`](js/data.js) |
| Connexion SharePoint réelle (lecture des 4 listes + écriture d'un contrôle) | [`js/sharepoint.js`](js/sharepoint.js), [`js/sharepoint-config.js`](js/sharepoint-config.js) |
| Analyse & schéma final des listes SharePoint | [`docs/01-analyse-et-structure-sharepoint.md`](docs/01-analyse-et-structure-sharepoint.md) |
| Conception de l'application Power Apps (écrans, navigation, composants) | [`docs/02-conception-power-apps.md`](docs/02-conception-power-apps.md) |
| Formules Power Fx (Filter, Search, Patch, Switch…) | [`docs/03-formules-power-fx.md`](docs/03-formules-power-fx.md) |
| Flux Power Automate (rappels, tâches, e-mails, PDF, archivage) | [`docs/04-flux-power-automate.md`](docs/04-flux-power-automate.md) |
| Guide de mise en œuvre pas à pas | [`docs/05-guide-deploiement.md`](docs/05-guide-deploiement.md) |
| Conseils d'amélioration & bonnes pratiques Microsoft | [`docs/06-bonnes-pratiques.md`](docs/06-bonnes-pratiques.md) |
| Migration pas à pas de vos listes existantes vers le modèle final | [`docs/07-migration-listes-existantes.md`](docs/07-migration-listes-existantes.md) |

## Aperçu de l'interface web

Ouvrir `index.html` dans un navigateur (aucune installation requise). Parcours :

- **Accueil** : statistiques globales + une vignette par catégorie d'équipement (avec répartition de conformité) + une vignette "Tableau général".
- **Vue catégorie** : galerie des matériels de la catégorie choisie, avec accès à l'historique et au bouton **Nouveau contrôle**.
- **Tableau général** : recherche instantanée, filtres (catégorie, conformité, statut, contrôleur, plage de dates), tri par colonne, code couleur 🟢🟠🔴⚪, export CSV.
- **Fiche matériel** : historique complet des contrôles (accordéon), détail des points de contrôle par événement.
- **Écran de contrôle** : case à cocher Conforme/Non conforme par point, observations/actions correctives/commentaires, bouton **✅ Valider le contrôle**.
- Thème clair/sombre, responsive (poste de travail, tablette, mobile).

### Deux modes de fonctionnement

- **Mode démonstration** (par défaut, ex. aperçu local ou hébergement hors SharePoint) : les données viennent de `js/data.js` et le bouton "Valider le contrôle" simule l'enregistrement localement (rien n'est écrit dans SharePoint).
- **Mode connecté** (page ouverte depuis le site SharePoint lui-même, `js/sharepoint.js`) : les 4 listes (`Materiels`, `TypesPointControle`, `Controles`, `ResultatsPointsControle`) sont lues via l'API REST SharePoint, et le bouton "Valider le contrôle" **crée réellement** l'enregistrement dans `Controles` + une ligne par point dans `ResultatsPointsControle`, avec l'utilisateur SharePoint connecté comme contrôleur. Voir `js/sharepoint-config.js` pour l'URL du site et les noms de liste, et `docs/05-guide-deploiement.md` §5.6 pour l'hébergement.

## Par où commencer

1. Lire `docs/01` pour comprendre et créer le modèle de données SharePoint.
2. Suivre `docs/05` pour la mise en œuvre pas à pas (listes, Power Apps, connexions, publication, automatisations).
3. Utiliser `docs/02` et `docs/03` pendant la construction de l'application Power Apps.
4. Utiliser `docs/04` pour créer les flux Power Automate.
5. Consulter `docs/06` pour les bonnes pratiques de maintenance et de sécurité.
