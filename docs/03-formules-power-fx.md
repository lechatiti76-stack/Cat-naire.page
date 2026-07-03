# 3. Formules Power Fx

Toutes les formules ci-dessous utilisent les noms de colonnes du schéma final (docs/01). Elles sont classées par écran et commentées.

## 3.1 Écran Liste — filtrage combiné (recherche + 4 filtres + dates)

Propriété `Items` de la galerie `galListe` :

```powerapps
SortByColumns(
    Filter(
        Controles,
        (IsBlank(txtRecherche.Text)
            || Materiel.Value in txtRecherche.Text
            || NumInventaire in txtRecherche.Text
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

> **Note délégation** : l'opérateur `in` sur une colonne texte simple est délégable dans la limite du connecteur SharePoint pour l'égalité ; la recherche multi-champs avec `in` combiné à des `||` peut dépasser la délégation au-delà de 2000 lignes. Pour un très grand volume, préférer la fonction `Search()` (voir 3.2) qui est optimisée pour cet usage, ou scinder la recherche par colonne indexée.

## 3.2 Recherche instantanée seule — `Search()`

Alternative plus simple si l'on ne recherche que sur le nom du matériel et le n° d'inventaire (utilisée dans la barre de recherche de `scrListe`) :

```powerapps
Search(colMateriels, txtRecherche.Text, "Title", "NumInventaire")
```
`Search()` est **délégable** sur SharePoint et gère nativement la recherche insensible à la casse sur plusieurs colonnes texte — à privilégier dès que possible par rapport à un `Filter` avec `in`.

## 3.3 Tri dynamique — `Sort()` / `SortByColumns()`

Bouton d'en-tête de colonne (bascule tri) :
```powerapps
// OnSelect du bouton "Trier par date"
UpdateContext({
    varTriOrdre: If(varTriOrdre = SortOrder.Ascending, SortOrder.Descending, SortOrder.Ascending)
})
```
```powerapps
// Utilisation dans Items de la galerie
Sort(colMateriels, DernierControle, varTriOrdre)
```

## 3.4 Récupération d'une fiche unique — `LookUp()`

Écran Détail, pour retrouver la dernière valeur de statut d'un matériel :
```powerapps
LookUp(
    Controles,
    Materiel.Id = varMaterielSelectionne.Id,
    Statut.Value,
    SortOrder.Descending  // le plus récent contrôle
)
```
`LookUp` renvoie **un seul enregistrement** (le premier trouvé) — utile pour un "dernier contrôle en date" sans charger toute la galerie.

## 3.5 Historique des contrôles d'un matériel — `Filter()` + `SortByColumns()`

```powerapps
SortByColumns(
    Filter(Controles, Materiel.Id = varMaterielSelectionne.Id),
    "DateControle",
    SortOrder.Descending
)
```

## 3.6 Enregistrement d'un contrôle — `Patch()`

Utilisé plutôt que `SubmitForm` lorsque l'on veut contrôler précisément les valeurs écrites (ex. calcul du statut à l'écriture, ou écriture depuis un bouton personnalisé) :

```powerapps
Patch(
    Controles,
    Defaults(Controles),
    {
        Materiel: drpMateriel.Selected,
        DateControle: dpDateControle.SelectedDate,
        DateProchainControle: DateAdd(dpDateControle.SelectedDate, drpMateriel.Selected.PeriodiciteMois, TimeUnit.Months),
        Controleur: {
            '@odata.type': "#Microsoft.Azure.Connectors.SharePoint.SPListExpandedUser",
            Claims: "i:0#.f|membership|" & Lower(cbxControleur.Selected.Mail),
            DisplayName: cbxControleur.Selected.DisplayName,
            Email: cbxControleur.Selected.Mail,
            Department: "", JobTitle: "", Picture: ""
        },
        Conforme: tglConforme.Value,
        Statut: {
            Value: Switch(
                true,
                drpMateriel.Selected.Etat.Value = "Hors service", "Hors service",
                !tglConforme.Value, "Non conforme",
                DateDiff(Today(), DateAdd(dpDateControle.SelectedDate, drpMateriel.Selected.PeriodiciteMois, TimeUnit.Months), TimeUnit.Days) <= gSeuilJours, "À vérifier prochainement",
                "Conforme"
            )
        },
        Observations: txtObservations.Text,
        ActionsCorrectives: txtActionsCorrectives.Text,
        Commentaires: txtCommentaires.Text
    }
);
Notify("Contrôle enregistré avec succès.", NotificationType.Success);
Navigate(scrDetail, ScreenTransition.Fade, {materielSelectionne: drpMateriel.Selected})
```

## 3.7 Enregistrement via formulaire standard — `SubmitForm()`

```powerapps
// OnSelect du bouton "Enregistrer" quand on utilise un Edit form standard (Form1)
If(
    IsBlank(drpMateriel.Selected) || IsBlank(dpDateControle.SelectedDate),
    Notify("Veuillez compléter le matériel et la date du contrôle.", NotificationType.Warning),
    SubmitForm(Form1)
)
```
```powerapps
// OnSuccess de Form1
Notify("Contrôle enregistré.", NotificationType.Success);
Back()
```
```powerapps
// OnFailure de Form1
Notify("Erreur lors de l'enregistrement : " & Form1.Error, NotificationType.Error)
```

## 3.8 Variables d'écran — `UpdateContext()` / `Set()`

```powerapps
// Variable locale à l'écran (panneau de détail d'une ligne d'historique)
UpdateContext({varLigneEtendue: If(varLigneEtendue = ThisItem.ID, Blank(), ThisItem.ID)})
```
```powerapps
// Variable globale accessible depuis tous les écrans
Set(varMaterielSelectionne, ThisItem)
```
**Règle appliquée dans toute l'application** : `UpdateContext` pour l'état propre à un écran (affichage/masquage local, bascule de tri), `Set` pour les données transmises entre écrans ou nécessaires globalement (utilisateur courant, sélection en cours, couleurs de thème).

## 3.9 Navigation — `Navigate()`

```powerapps
Navigate(scrDetail, ScreenTransition.Cover, {materielSelectionne: ThisItem})
Navigate(scrModification, ScreenTransition.Fade, {modeCreation: true, materielCible: varMaterielSelectionne})
Back()
```

## 3.10 Notifications — `Notify()`

```powerapps
Notify("Ce matériel est hors service : contrôle impossible.", NotificationType.Error)
Notify("Le contrôle arrive à échéance dans moins de 30 jours.", NotificationType.Warning)
Notify("Contrôle enregistré avec succès.", NotificationType.Success)
```

## 3.11 Conditions simples — `If()`

```powerapps
If(
    ThisItem.Statut.Value = "Non conforme",
    Notify("Attention : ce matériel est non conforme.", NotificationType.Warning)
)
```

## 3.12 Conditions multiples — `Switch()`

Couleur de la pastille de statut, utilisée sur toutes les galeries (cohérente avec le code couleur HTML/SharePoint) :

```powerapps
Switch(
    ThisItem.Statut.Value,
    "Conforme", gColorOk,
    "À vérifier prochainement", gColorWarn,
    "Non conforme", gColorDanger,
    "Hors service", gColorNeutral,
    gColorNeutral // valeur par défaut
)
```

Icône associée :
```powerapps
Switch(
    ThisItem.Statut.Value,
    "Conforme", Icon.CheckBadge,
    "À vérifier prochainement", Icon.Warning,
    "Non conforme", Icon.Cancel,
    "Hors service", Icon.Blocked2,
    Icon.Help
)
```

## 3.13 Récapitulatif des formules et de leur rôle

| Formule | Rôle dans l'application |
|---|---|
| `Filter()` | Combiner tous les critères de filtre de la galerie liste |
| `Search()` | Recherche instantanée multi-colonnes, délégable |
| `Sort()` / `SortByColumns()` | Tri des galeries (liste, historique) |
| `LookUp()` | Récupérer une valeur ou un enregistrement unique (dernier statut, matériel lié) |
| `Patch()` | Créer/modifier un enregistrement avec contrôle fin des valeurs (calcul du statut inclus) |
| `SubmitForm()` | Enregistrer via un formulaire standard lié à la source de données |
| `UpdateContext()` | Gérer un état local à l'écran (bascule d'affichage, tri) |
| `Set()` | Gérer une variable globale partagée entre écrans |
| `Navigate()` | Changer d'écran en transmettant des paramètres |
| `Notify()` | Informer l'utilisateur (succès, avertissement, erreur) |
| `If()` | Condition simple (validation, alerte) |
| `Switch()` | Choix de couleur/icône/texte selon le statut |
