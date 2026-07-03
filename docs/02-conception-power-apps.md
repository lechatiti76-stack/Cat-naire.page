# 2. Conception complète de l'application Power Apps

Application **Canvas**, connectée aux quatre listes SharePoint `Materiels`, `TypesPointControle`, `Controles` et `ResultatsPointsControle` (voir docs/01). Format téléphone (mobile-first), adaptable tablette pour un usage terrain (agents caténaire).

## 2.1 Structure des écrans et navigation

```
scrAccueil  ──▶  scrListe  ──▶  scrDetail  ──▶  scrModification (en-tête du contrôle)
    │                │              │                  │
    ▼                ▼              ▼                  ▼
scrTableauDeBord  (retour)   Historique des        scrPointsControle (saisie des
                              contrôles +            points de contrôle un par un,
                              détail des points       générés depuis TypesPointControle)
```

| Écran | Rôle | Accès depuis |
|---|---|---|
| `scrAccueil` | Statistiques globales + boutons de navigation | Démarrage de l'app |
| `scrListe` | Galerie filtrable de tous les contrôles (jointure Controles + Materiels) | `scrAccueil`, barre de navigation |
| `scrDetail` | Fiche complète d'un matériel : photo, infos, historique des contrôles, détail des points par contrôle | Clic sur un élément de `scrListe` |
| `scrModification` | En-tête d'un contrôle (date, contrôleur, conformité globale, photos, signature) | Bouton "+" de `scrListe`/`scrDetail` |
| `scrPointsControle` | Liste des points de contrôle générés pour ce contrôle (cases Effectué/Rapport/Statut) | Depuis `scrModification`, après création de l'en-tête |
| `scrTableauDeBord` | Indicateurs et graphiques de conformité | `scrAccueil` |

Navigation gérée par `Navigate(scrCible, ScreenTransition.Fade, {paramètres})` ; bouton retour (`Icon.ChevronLeft`) sur tous les écrans sauf l'accueil, appelant `Back()`.

## 2.2 Variables et collections globales (`App.OnStart`)

```powerapps
Set(gColorOk, ColorValue("#107C10"));
Set(gColorWarn, ColorValue("#CA5010"));
Set(gColorDanger, ColorValue("#D13438"));
Set(gColorNeutral, ColorValue("#605E5C"));
Set(gColorPrimary, ColorValue("#0078D4"));
Set(gSeuilJours, 30);
Set(gUtilisateur, User());
Set(gEstControleur, User().Email in ["controleur1@lhte76.fr", "controleur2@lhte76.fr"] || IsMatch(User().Email, "@lhte76"));

ClearCollect(
    colMateriels,
    AddColumns(
        Materiels,
        'DernierControle', LookUp(Controles, Materiel.Id = Materiels.Id, DateControle, SortOrder.Descending),
        'DernierStatut', LookUp(Controles, Materiel.Id = Materiels.Id, Statut.Value, SortOrder.Descending)
    )
);

ClearCollect(colCategories, Distinct(Materiels, Categorie.Value));
ClearCollect(colControleurs, Distinct(Controles, Controleur.DisplayName));
ClearCollect(colTypesPointControle, TypesPointControle);
```

- `colMateriels` : cache locale du référentiel équipements (perches, LED, VAT, drapeaux, signaux…) pour une navigation instantanée.
- `colTypesPointControle` : cache du référentiel des points de contrôle par catégorie, utilisé pour générer les lignes de `scrPointsControle`.
- `gEstControleur` : rôle applicatif (les permissions réelles restent gérées au niveau SharePoint).

## 2.3 Écran d'accueil (`scrAccueil`)

5 cartes de statistiques :
- Nombre d'équipements suivis : `CountRows(colMateriels)`
- Conformes : `CountRows(Filter(Controles, Statut.Value = "Conforme"))`
- Non conformes : `CountRows(Filter(Controles, Statut.Value = "Non conforme"))`
- À échéance sous 30 jours : `CountRows(Filter(Controles, DateProchainControle <= Today() + gSeuilJours && DateProchainControle >= Today()))`
- Expirés : `CountRows(Filter(Controles, DateProchainControle < Today()))`

Boutons : "Voir la liste" → `Navigate(scrListe)` ; "Tableau de bord" → `Navigate(scrTableauDeBord)` ; "Nouveau contrôle" (si `gEstControleur`) → `Navigate(scrModification, ScreenTransition.Fade, {modeCreation: true})`.

## 2.4 Écran Liste (`scrListe`)

- `txtRecherche`, 4 filtres (`ddCategorie`, `ddConformite`, `ddControleur`, `ddStatut`), 2 `DatePicker` (plage de dates de contrôle).
- `galListe` : chaque carte affiche nom du matériel, N° série, catégorie (icône dédiée), pastille de statut colorée, date du prochain contrôle, contrôleur.
- Bouton flottant "+" (si `gEstControleur`) → `Navigate(scrModification)`.

## 2.5 Écran Détail (`scrDetail`)

Ouvert avec `Navigate(scrDetail, ScreenTransition.Cover, {materielSelectionne: ThisItem})`.

- Photo, nom, N° série, catégorie, référence, badge de statut.
- Informations : localisation/responsable, état, périodicité.
- **Galerie "Historique des contrôles"** : `SortByColumns(Filter(Controles, Materiel.Id = varMaterielSelectionne.Id), "DateControle", Descending)`.
- Clic sur un contrôle de l'historique → **sous-galerie des points de contrôle** de cet événement :
  ```powerapps
  Filter(ResultatsPointsControle, Controle.Id = varControleSelectionne.Id)
  ```
  affichant pour chaque point : libellé (`PointControle.Title`), icône Effectué/non effectué, `Rapport`, `Statut` coloré.
- Bouton "Nouveau contrôle sur ce matériel" → `Navigate(scrModification, ScreenTransition.Fade, {materielCible: varMaterielSelectionne, modeCreation: true})`.

## 2.6 Écran Modification — en-tête du contrôle (`scrModification`)

- `Form1` (Edit form) source `Controles` : matériel concerné (verrouillé si venant de `scrDetail`), date du contrôle (défaut `Today()`), contrôleur, observations/actions correctives/commentaires.
- `AddMediaButton`/`Camera` pour les photos.
- Contrôle **Pen Input** pour la signature.
- Bouton "Continuer vers les points de contrôle" — **crée l'en-tête ET génère les lignes de détail** :

```powerapps
// OnSelect du bouton "Continuer"
If(
    IsBlank(drpMateriel.Selected) || IsBlank(dpDateControle.SelectedDate),
    Notify("Veuillez renseigner le matériel et la date du contrôle.", NotificationType.Warning),
    (
        Set(
            varControleCree,
            Patch(
                Controles,
                Defaults(Controles),
                {
                    Materiel: drpMateriel.Selected,
                    DateControle: dpDateControle.SelectedDate,
                    DateProchainControle: DateAdd(dpDateControle.SelectedDate, drpMateriel.Selected.PeriodiciteMois, TimeUnit.Months),
                    Controleur: gUtilisateur,
                    Observations: txtObservations.Text,
                    ActionsCorrectives: txtActionsCorrectives.Text,
                    Commentaires: txtCommentaires.Text
                }
            )
        );
        // Génère une ligne ResultatsPointsControle par point défini pour la catégorie du matériel
        ForAll(
            Filter(colTypesPointControle, Categorie.Value = drpMateriel.Selected.Categorie.Value),
            Patch(
                ResultatsPointsControle,
                Defaults(ResultatsPointsControle),
                {
                    Controle: varControleCree,
                    PointControle: ThisRecord,
                    Effectue: false,
                    Rapport: {Value: "Non validé"},
                    Statut: {Value: "Non conforme"}
                }
            )
        );
        Navigate(scrPointsControle, ScreenTransition.Fade, {controleCourant: varControleCree})
    )
)
```

## 2.7 Écran Points de contrôle (`scrPointsControle`) — nouveau

- Galerie `galPoints` : `Items = Filter(ResultatsPointsControle, Controle.Id = varControleCourant.Id)`, triée par `PointControle.Ordre`.
- Chaque ligne : libellé du point, `Toggle` "Effectué", `ComboBox` "Rapport" (Validé/Non validé/Sans objet), `ComboBox` "Statut" (Conforme/Non conforme), champ observation optionnel.
- Bouton "Valider le contrôle" :
```powerapps
// Met à jour Conforme et Statut de l'en-tête à partir du détail des points
UpdateIf(
    Controles,
    ID = varControleCourant.ID,
    {
        Conforme: CountRows(Filter(ResultatsPointsControle, Controle.Id = varControleCourant.Id, Statut.Value = "Non conforme")) = 0
    }
);
Notify("Contrôle enregistré.", NotificationType.Success);
Navigate(scrDetail, ScreenTransition.Fade, {materielSelectionne: drpMateriel.Selected})
```
(Le champ `Statut` global de `Controles` — Conforme/À vérifier prochainement/Non conforme/Hors service — est ensuite recalculé et écrit par le flux Power Automate quotidien, voir docs/04, pour éviter le problème des colonnes calculées `[Today]` figées constaté sur `VALIDITE`.)

## 2.8 Tableau de bord (`scrTableauDeBord`)

- Jauge de conformité globale : `CountRows(Filter(Controles, Conforme=true)) / CountRows(Controles)`.
- Graphique de répartition des statuts (Conforme / À vérifier prochainement / Non conforme / Hors service), alimenté par une collection agrégée comme en v1.
- Répartition par catégorie d'équipement (Perche, LED, VAT, Drapeau, Signal…) : utile pour identifier les catégories les plus problématiques.
- Listes compactes "Contrôles expirés" et "à échéance sous 30 jours" avec lien direct vers `scrDetail`.

## 2.9 Charte graphique (Fluent Design)

Identique à la version précédente : police Segoe UI, couleur primaire `#0078D4`, code couleur Conforme `#107C10`/Warn `#CA5010`/Danger `#D13438`/Neutre `#605E5C`, rayon de coin 8px, icônes Fluent UI System Icons.
