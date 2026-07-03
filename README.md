# Registre des Vérifications de Matériel

Solution complète de gestion des vérifications de matériel de sécurité caténaire ferroviaire (perches isolantes, LED de signalisation, VAT, drapeaux, signaux d'arrêt à main) : listes SharePoint, application Power Apps, automatisations Power Automate et interface web de consultation.

Le modèle de données (`docs/01`) a été conçu à partir de l'analyse réelle des listes existantes (`VALIDITE`, `Source Application Dashboard Caténaire`, et les listes créées par équipement comme `LECBV2-2411-01154`), pour supprimer la pratique d'une liste SharePoint par équipement et fiabiliser le calcul des statuts.

## Contenu du dépôt

| Élément | Emplacement |
|---|---|
| Interface web de consultation (HTML/CSS/JS, autonome) | [`index.html`](index.html), [`css/styles.css`](css/styles.css), [`js/app.js`](js/app.js), [`js/data.js`](js/data.js) |
| Analyse & schéma final des listes SharePoint | [`docs/01-analyse-et-structure-sharepoint.md`](docs/01-analyse-et-structure-sharepoint.md) |
| Conception de l'application Power Apps (écrans, navigation, composants) | [`docs/02-conception-power-apps.md`](docs/02-conception-power-apps.md) |
| Formules Power Fx (Filter, Search, Patch, Switch…) | [`docs/03-formules-power-fx.md`](docs/03-formules-power-fx.md) |
| Flux Power Automate (rappels, tâches, e-mails, PDF, archivage) | [`docs/04-flux-power-automate.md`](docs/04-flux-power-automate.md) |
| Guide de mise en œuvre pas à pas | [`docs/05-guide-deploiement.md`](docs/05-guide-deploiement.md) |
| Conseils d'amélioration & bonnes pratiques Microsoft | [`docs/06-bonnes-pratiques.md`](docs/06-bonnes-pratiques.md) |
| Migration pas à pas de vos listes existantes vers le modèle final | [`docs/07-migration-listes-existantes.md`](docs/07-migration-listes-existantes.md) |

## Aperçu de l'interface web

Ouvrir `index.html` dans un navigateur (aucune installation requise). Fonctionnalités :

- statistiques de conformité en temps réel (total, conformes, non conformes, à vérifier prochainement, hors service, taux de conformité) ;
- recherche instantanée + filtres (catégorie, conformité, statut, contrôleur, plage de dates) ;
- tableau trié par colonne, code couleur 🟢🟠🔴⚪ sur chaque ligne ;
- fiche de détail en modale (observations, actions correctives, commentaires) ;
- export CSV des résultats affichés ;
- thème clair/sombre ;
- responsive (poste de travail, tablette, mobile).

Le jeu de données (`js/data.js`) est un jeu de démonstration reproduisant exactement le schéma SharePoint final (voir `docs/01`). Pour connecter vos données réelles, voir la section correspondante dans `docs/05-guide-deploiement.md`.

## Par où commencer

1. Lire `docs/01` pour comprendre et créer le modèle de données SharePoint.
2. Suivre `docs/05` pour la mise en œuvre pas à pas (listes, Power Apps, connexions, publication, automatisations).
3. Utiliser `docs/02` et `docs/03` pendant la construction de l'application Power Apps.
4. Utiliser `docs/04` pour créer les flux Power Automate.
5. Consulter `docs/06` pour les bonnes pratiques de maintenance et de sécurité.
