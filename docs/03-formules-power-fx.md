# 3. Formules Power Fx

Formules basées sur le schéma final à 4 listes (docs/01) : `Materiels`, `TypesPointControle`, `Controles`, `ResultatsPointsControle`.

## 3.1 Écran Liste — filtrage combiné (recherche + 4 filtres + dates)

Propriété `Items` de la galerie `galListe` :

```powerapps
SortByColumns(
    Filter(
        Controles,
        (IsBlank(txtRecherche.Text)
            || Materiel.Title in txtRecherche.Text
            || Materiel.NumSerie in txtRecherche.Text
            || Controleur.DisplayName in txtRecherche.Text
        )
        && (IsBlank(ddCategorie.Selected.Value) || Materiel.Categorie = ddCategorie.Selected.Value)
        && (IsBlank(ddConformite.Selected.Value) || Conforme = (ddConformite.Selected.Value = "Oui"))
        && (IsBlank(ddStatut.Selected.Value) || Statut.Value = ddStatut.Selected.Value)
        && (IsBlank(ddControleur.Selected.Value) || Controleur.DisplayName = ddControleur.Selected.Value)
        && (IsBlank(dpDateDebut.SelectedDate) || DateControle >= dpDateDebut.SelectedDate)
        && (IsBlank(dpDateFin.SelectedDate) || DateControle <= dpDateFin.SelectedDate)
    ),
    "DateControle",
    If(varTriOrdre = SortOrder.Ascending, SortOrder.Ascending, SortOrder.Descending)
)
```

> **Note délégation** : au-delà de 2000 lignes, indexer `Materiel`, `DateControle`, `DateProchainControle` sur `Controles` (fait dans docs/01 et docs/05). Préférer `Search()` pour la recherche simple (voir 3.2) si les volumes deviennent importants.

## 3.2 Recherche instantanée — `Search()`

```powerapps
Search(colMateriels, txtRecherche.Text, "Title", "NumSerie", "Reference")
```

## 3.3 Tri dynamique — `Sort()` / `SortByColumns()`

```powerapps
// OnSelect du bouton "Trier par date"
UpdateContext({varTriOrdre: If(varTriOrdre = SortOrder.Ascending, SortOrder.Descending, SortOrder.Ascending)})
```
```powerapps
Sort(colMateriels, DernierControle, varTriOrdre)
```

## 3.4 Récupération d'une fiche unique — `LookUp()`

```powerapps
LookUp(Controles, Materiel.Id = varMaterielSelectionne.Id, Statut.Value, SortOrder.Descending)
```

## 3.5 Historique des contrôles d'un matériel — `Filter()` + `SortByColumns()`

```powerapps
SortByColumns(
    Filter(Controles, Materiel.Id = varMaterielSelectionne.Id),
    "DateControle",
    SortOrder.Descending
)
```

## 3.6 Détail des points de contrôle d'un événement — `Filter()`

```powerapps
SortByColumns(
    Filter(ResultatsPointsControle, Controle.Id = varControleSelectionne.Id),
    "PointControle.Ordre",
    SortOrder.Ascending
)
```

## 3.7 Génération des lignes de points de contrôle — `ForAll()` + `Patch()`

Cœur du nouveau modèle : à la création d'un contrôle, générer automatiquement une ligne `ResultatsPointsControle` par point défini pour la catégorie du matériel (au lieu de recréer une liste par équipement) :

```powerapps
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
)
```

## 3.8 Enregistrement de l'en-tête d'un contrôle — `Patch()`

```powerapps
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
```

## 3.9 Enregistrement via formulaire standard — `SubmitForm()`

```powerapps
If(
    IsBlank(drpMateriel.Selected) || IsBlank(dpDateControle.SelectedDate),
    Notify("Veuillez compléter le matériel et la date du contrôle.", NotificationType.Warning),
    SubmitForm(Form1)
)
```
```powerapps
// OnSuccess de Form1
Notify("Contrôle enregistré.", NotificationType.Success);
Navigate(scrPointsControle, ScreenTransition.Fade, {controleCourant: Form1.LastSubmit})
```
```powerapps
// OnFailure de Form1
Notify("Erreur lors de l'enregistrement : " & Form1.Error, NotificationType.Error)
```

## 3.10 Mise à jour de la conformité globale à partir du détail — `UpdateIf()`

```powerapps
UpdateIf(
    Controles,
    ID = varControleCourant.ID,
    {
        Conforme: CountRows(Filter(ResultatsPointsControle, Controle.Id = varControleCourant.Id, Statut.Value = "Non conforme")) = 0
    }
)
```

## 3.11 Variables d'écran — `UpdateContext()` / `Set()`

```powerapps
UpdateContext({varLigneEtendue: If(varLigneEtendue = ThisItem.ID, Blank(), ThisItem.ID)})
Set(varMaterielSelectionne, ThisItem)
Set(varControleCree, ...)  // résultat de Patch(), réutilisé pour créer les points de contrôle liés
```
**Règle** : `UpdateContext` pour l'état propre à un écran, `Set` pour les données transmises entre écrans.

## 3.12 Navigation — `Navigate()`

```powerapps
Navigate(scrDetail, ScreenTransition.Cover, {materielSelectionne: ThisItem})
Navigate(scrPointsControle, ScreenTransition.Fade, {controleCourant: varControleCree})
Back()
```

## 3.13 Notifications — `Notify()`

```powerapps
Notify("Ce matériel est hors service : contrôle impossible.", NotificationType.Error)
Notify("Le contrôle arrive à échéance dans moins de 30 jours.", NotificationType.Warning)
Notify("Contrôle enregistré avec succès.", NotificationType.Success)
```

## 3.14 Conditions simples — `If()`

```powerapps
If(
    ThisItem.Statut.Value = "Non conforme",
    Notify("Attention : ce matériel est non conforme.", NotificationType.Warning)
)
```

## 3.15 Conditions multiples — `Switch()`

```powerapps
// Couleur de la pastille de statut
Switch(
    ThisItem.Statut.Value,
    "Conforme", gColorOk,
    "À vérifier prochainement", gColorWarn,
    "Non conforme", gColorDanger,
    "Hors service", gColorNeutral,
    gColorNeutral
)
```
```powerapps
// Icône par catégorie d'équipement
Switch(
    ThisItem.Categorie.Value,
    "Perche isolante", Icon.Filter,       // à remplacer par une icône Fluent dédiée si disponible
    "LED signalisation", Icon.LightBulb,
    "VAT", Icon.Waveform,
    "Drapeau", Icon.Flag,
    "Signal d'arrêt à main", Icon.Warning,
    Icon.Help
)
```

## 3.16 Récapitulatif des formules et de leur rôle

| Formule | Rôle dans l'application |
|---|---|
| `Filter()` | Combiner les critères de filtre (liste), isoler le détail des points d'un contrôle |
| `Search()` | Recherche instantanée multi-colonnes, délégable |
| `Sort()` / `SortByColumns()` | Tri des galeries (liste, historique, points de contrôle) |
| `LookUp()` | Récupérer une valeur/enregistrement unique (dernier statut) |
| `Patch()` | Créer l'en-tête d'un contrôle et chacune de ses lignes de détail |
| `ForAll()` | Générer automatiquement les lignes `ResultatsPointsControle` depuis `TypesPointControle` |
| `SubmitForm()` | Enregistrer l'en-tête via un formulaire standard |
| `UpdateIf()` | Recalculer `Conforme` de l'en-tête à partir du détail des points |
| `UpdateContext()` | État local à l'écran |
| `Set()` | Variable globale partagée entre écrans (matériel sélectionné, contrôle en cours de création) |
| `Navigate()` | Changer d'écran avec paramètres |
| `Notify()` | Informer l'utilisateur |
| `If()` | Condition simple |
| `Switch()` | Couleur/icône selon statut ou catégorie |
