# 6. Conseils d'amélioration & bonnes pratiques Microsoft

## 6.1 Expérience utilisateur (Fluent Design)

- **Cohérence des couleurs** : le même code couleur (🟢🟠🔴⚪) est utilisé sur les trois surfaces (HTML, Power Apps, colonne de mise en forme SharePoint) — ne jamais dévier de cette palette pour ne pas casser la reconnaissance visuelle des utilisateurs terrain.
- **Densité d'information adaptée au support** : tableau dense sur le poste de travail (HTML), cartes larges et boutons tactiles ≥ 44px sur mobile (Power Apps en atelier, souvent utilisé avec des gants).
- **Accessibilité** : contraste AA minimum sur tous les textes/badges (vérifié sur la palette retenue), navigation clavier complète sur la page HTML (`tabindex`, `Échap` pour fermer la modale), libellés explicites sur tous les champs de formulaire Power Apps (`AccessibleLabel`).
- **Retour utilisateur immédiat** : `Notify()` systématique après toute action d'écriture (succès/erreur), état de chargement visible pendant les appels réseau.

## 6.2 Performance & délégation Power Apps

- Toujours vérifier l'absence du triangle d'avertissement de délégation sur les formules `Filter`/`Search` ; au-delà de 2000 éléments, indexer les colonnes filtrées et augmenter la limite de délégation dans les paramètres de l'app si besoin (jusqu'à 2000 max recommandé, au-delà repenser le modèle de données).
- Charger le référentiel `Materiels` en collection locale (`ClearCollect` à `App.OnStart`) plutôt que de le relire à chaque écran.
- Éviter les galeries imbriquées profondes ; préférer une galerie plate avec panneau de détail extensible (comme conçu en §2.5).
- Limiter le nombre de colonnes remontées par les `Lookup` SharePoint aux seules colonnes réellement affichées (chaque colonne de projection ajoute un appel réseau).
- **Ne jamais utiliser une colonne calculée SharePoint référençant `[Aujourd'hui]`/`TODAY()` pour un statut ou un compte à rebours** : ce type de colonne ne se recalcule qu'à la prochaine modification manuelle de la ligne, pas chaque jour (c'est ce qui a été constaté sur `Jours restant`/`Statut` de l'ancienne liste `VALIDITE`, avec la colonne `STATUTCONTROLE` comme rustine manuelle). Toujours calculer ces valeurs via un flux planifié qui écrit dans une colonne **normale** (docs/04, flux 4.2).

## 6.3 Maintenance et gouvernance des données

- Verrouiller les colonnes **Choice** (Catégorie, État, Statut) en écriture directe SharePoint pour les utilisateurs finaux ; seules les interfaces (Power Apps, flux) doivent les modifier, afin de garantir la cohérence du référentiel de valeurs.
- Documenter dans la description de chaque colonne SharePoint sa **règle de calcul** ou sa **source** (ex. "Calculé automatiquement par le flux 'Calcul statut', ne pas modifier manuellement").
- Prévoir une revue annuelle des `Choice` (catégories, localisations) pour éviter la prolifération de valeurs obsolètes.
- Mettre en place une **archive** (flux §4.7) pour garder la liste active performante sur la durée.
- **Ne plus créer de liste SharePoint par équipement physique** (comme les anciennes listes `LECBV2-2411-01154`, `PerchePI56C2505005`…) : tout nouveau protocole de contrôle doit être ajouté dans `TypesPointControle`, jamais dans une liste dédiée à un numéro de série.
- Clarifier et documenter le rôle exact de la liste `Bris de barrières` avant de décider si elle doit être fusionnée dans `Materiels` (nouvelle catégorie) ou conservée séparément (autre nature de suivi).

## 6.4 Sécurité

- Toujours restreindre les permissions au niveau liste (jamais "Modifier" pour tous par défaut) : contrôleurs = Contribuer, direction/lecture seule = Lecture, administrateurs = Contrôle total.
- Utiliser `User().Email` côté Power Apps uniquement comme confort d'affichage/filtre — la sécurité réelle repose sur les permissions SharePoint, pas sur la logique applicative Power Apps (une formule Power Fx peut être contournée par un utilisateur qui modifierait l'app ; les permissions de liste, non).
- Pour les flux Power Automate déclenchés par un utilisateur, utiliser une **connexion de service dédiée** (compte applicatif) plutôt que le compte personnel du créateur du flux, afin d'éviter une rupture du flux si ce compte est désactivé.

## 6.5 Évolutions possibles

- Ajouter un **QR code** sur chaque matériel physique (référence `NumSerie`) et un scanner Power Apps (`Barcode Scanner` control) pour ouvrir directement la fiche détail depuis le terrain.
- Ajouter une **carte / plan de site** interactif situant chaque matériel (composant Power Apps + coordonnées dans `Materiels`).
- Étendre le tableau de bord avec **Power BI** (via le connecteur SharePoint) pour des analyses plus poussées et un partage direction plus riche que les graphiques Power Apps natifs.
- Ajouter une notification **push Teams/Power Automate** en plus de l'e-mail pour les contrôles urgents (< 7 jours).
