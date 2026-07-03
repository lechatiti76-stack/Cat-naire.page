# 2. Conception complète de l'application Power Apps

Application **Canvas**, connectée aux deux listes SharePoint `Materiels` et `Controles` (voir docs/01). Format téléphone (mobile-first) avec mise en page adaptable tablette ; peut aussi être publiée en Tablette pour un usage sur poste fixe/atelier.

## 2.1 Structure des écrans et navigation

```
scrAccueil  ──▶  scrListe  ──▶  scrDetail  ──▶  scrModification
    │                │              │                  │
    ▼                ▼              ▼                  ▼
scrTableauDeBord  (retour)     (Historique       (Ajout contrôle /
                                des contrôles      Signature / Photos)
                                en sous-galerie)
```

| Écran | Rôle | Accès depuis |
|---|---|---|
| `scrAccueil` | Statistiques globales + boutons de navigation | Démarrage de l'app |
| `scrListe` | Galerie filtrable de tous les matériels/contrôles | `scrAccueil`, barre de navigation |
| `scrDetail` | Fiche complète d'un matériel : photo, infos, historique des contrôles | Clic sur un élément de `scrListe` |
| `scrModification` | Formulaire d'ajout/modification d'un contrôle (+ photo + signature) | Bouton "+" de `scrListe`/`scrDetail` |
| `scrTableauDeBord` | Indicateurs et graphiques de conformité | `scrAccueil` |

Navigation gérée par `Navigate(scrCible, ScreenTransition.Fade, {paramètres})` ; un **bouton retour** (icône `Icon.ChevronLeft`) présent sur tous les écrans sauf l'accueil appelle `Back()`.

## 2.2 Variables et collections globales (`App.OnStart`)

```powerapps
Set(gColorOk, ColorValue("#107C10"));
Set(gColorWarn, ColorValue("#CA5010"));
Set(gColorDanger, ColorValue("#D13438"));
Set(gColorNeutral, ColorValue("#605E5C"));
Set(gColorPrimary, ColorValue("#0078D4"));
Set(gSeuilJours, 30);          // seuil "à vérifier prochainement"
Set(gUtilisateur, User());
Set(gEstControleur, User().Email in ["controleur1@contoso.com", "controleur2@contoso.com"] || IsMatch(User().Email, "@contoso.com$"));

ClearCollect(
    colMateriels,
    AddColumns(
        Materiels,
        'DernierControle', LookUp(Controles, Materiel.Id = Materiels.Id, DateControle, SortOrder.Descending),
        'DernierStatut', LookUp(Controles, Materiel.Id = Materiels.Id, Statut, SortOrder.Descending)
    )
);

ClearCollect(colCategories, Distinct(Materiels, Categorie.Value));
ClearCollect(colControleurs, Distinct(Controles, Controleur.DisplayName));
```

- `colMateriels` : mise en cache locale du référentiel pour une navigation instantanée entre les écrans (évite de re-télécharger à chaque écran).
- `colCategories` / `colControleurs` : alimentent les menus déroulants de filtre.
- `gEstControleur` : variable de rôle utilisée pour afficher/masquer les actions de modification/suppression (RBAC applicatif, en plus des permissions SharePoint).

## 2.3 Écran d'accueil (`scrAccueil`)

**Composants :**
- En-tête avec logo, titre "Registre des Vérifications de Matériel"
- 5 **cartes de statistiques** (galerie horizontale ou 5 conteneurs) :
  - Nombre de matériels : `CountRows(colMateriels)`
  - Nombre conformes : `CountRows(Filter(Controles, Statut.Value = "Conforme"))`
  - Nombre non conformes : `CountRows(Filter(Controles, Statut.Value = "Non conforme"))`
  - Contrôles arrivant à échéance (30 jours) : `CountRows(Filter(Controles, DateProchainControle <= Today() + gSeuilJours && DateProchainControle >= Today()))`
  - Contrôles expirés : `CountRows(Filter(Controles, DateProchainControle < Today()))`
- **Boutons de navigation** (icônes Fluent UI) :
  - "Voir la liste" → `Navigate(scrListe)`
  - "Tableau de bord" → `Navigate(scrTableauDeBord)`
  - "Nouveau contrôle" (visible si `gEstControleur`) → `Navigate(scrModification, ScreenTransition.Fade, {modeCreation: true})`

**Couleurs** : fond `RGBA(243,242,241,1)` (gris Fluent clair), cartes blanches, coin arrondi 8, ombre légère (`DropShadow` = Light), icônes colorées selon le même code que le HTML (vert/orange/rouge/gris).

## 2.4 Écran Liste (`scrListe`)

**Composants :**
- `txtRecherche` (Text input) — recherche instantanée
- 4 `Dropdown`/`ComboBox` de filtre : `ddCategorie`, `ddConformite`, `ddControleur`, `ddStatut`
- 2 `DatePicker` : `dpDateDebut`, `dpDateFin`
- `galListe` (Gallery, mise en page verticale) liée à la formule de filtrage combinée (voir docs/03)
- Icône de statut + pastille couleur en tête de chaque carte de la galerie
- Bouton flottant "+" (visible si `gEstControleur`) → `Navigate(scrModification)`

**Tri** : bouton bascule croissant/décroissant sur la date de contrôle, piloté par une variable `varTriOrdre` (`SortOrder.Ascending`/`Descending`) combinée à `varTriColonne`.

**Chaque carte de la galerie affiche** : nom du matériel, n° d'inventaire, catégorie (icône dédiée par catégorie), pastille de statut colorée, date du prochain contrôle, contrôleur.

## 2.5 Écran Détail (`scrDetail`)

Ouvert avec `Navigate(scrDetail, ScreenTransition.Cover, {materielSelectionne: ThisItem})`.

**Composants :**
- Image du matériel (`Image` control, `Materiels[@Photo]`)
- En-tête : nom, n° d'inventaire, catégorie, badge de statut coloré
- Section "Informations" : localisation, date de mise en service, périodicité, responsable
- **Galerie "Historique des contrôles"** : `SortByColumns(Filter(Controles, Materiel.Id = varMaterielSelectionne.Id), "DateControle", Descending)` — chaque ligne affiche date, contrôleur, conformité (icône ✓/✗), statut
- Clic sur une ligne d'historique → affiche Observations / Actions correctives / Commentaires dans un panneau extensible (`Visible: varLigneEtendue = ThisItem.ID`)
- Bouton "Nouveau contrôle sur ce matériel" → `Navigate(scrModification, ScreenTransition.Fade, {materielCible: varMaterielSelectionne, modeCreation: true})`
- Bouton "Modifier le dernier contrôle" (visible si `gEstControleur`) → mode édition

## 2.6 Écran Modification (`scrModification`)

**Composants :**
- `Form1` (Edit form) source `Controles`, `DefaultMode` = `New` ou `Edit` selon le paramètre `modeCreation`
- Champs de saisie : matériel concerné (verrouillé si venant de `scrDetail`), date du contrôle (`DatePicker`, défaut `Today()`), contrôleur (`ComboBox` sur `Office365Users.SearchUser()` ou choix parmi `colControleurs`), conformité (`Toggle` Oui/Non), observations/actions correctives/commentaires (`Text input` multiligne)
- `AddMediaButton` ou `Camera` control pour l'ajout de photos → stocké dans la colonne `PhotosControle`
- Contrôle **Pen Input** (signature) → au clic sur "Valider", conversion en image et sauvegarde dans `Signature` (`PenInput1.Image`, encodée puis stockée, ou pièce jointe dédiée)
- Boutons : "Enregistrer" (`SubmitForm(Form1)`), "Annuler" (`Back()`), "Supprimer" (visible uniquement si `gEstControleur` **et** l'utilisateur est l'auteur ou un administrateur) → `Remove(Controles, ThisItem)` avec confirmation (`Confirm` popup)

**Validation avant enregistrement :**
```powerapps
If(
    IsBlank(drpMateriel.Selected) || IsBlank(dpDateControle.SelectedDate),
    Notify("Veuillez renseigner le matériel et la date du contrôle.", NotificationType.Warning),
    SubmitForm(Form1)
)
```

## 2.7 Tableau de bord (`scrTableauDeBord`)

**Composants :**
- **Jauge de conformité globale** (`Gauge` control ou anneau construit avec 2 arcs) : `CountRows(Filter(Controles, Conforme=true)) / CountRows(Controles)`
- **Graphique en secteurs** (Répartition des statuts) : `PieChart`/`Column chart` alimenté par une collection agrégée :
  ```powerapps
  ClearCollect(
      colRepartitionStatuts,
      {Statut: "Conforme", Nombre: CountRows(Filter(Controles, Statut.Value="Conforme")), Couleur: gColorOk},
      {Statut: "À vérifier prochainement", Nombre: CountRows(Filter(Controles, Statut.Value="À vérifier prochainement")), Couleur: gColorWarn},
      {Statut: "Non conforme", Nombre: CountRows(Filter(Controles, Statut.Value="Non conforme")), Couleur: gColorDanger},
      {Statut: "Hors service", Nombre: CountRows(Filter(Controles, Statut.Value="Hors service")), Couleur: gColorNeutral}
  )
  ```
- **Graphique en courbes/colonnes** (Contrôles par mois, tendance) : agrégation par `Text(DateControle, "[$-fr-FR]mmm yyyy")`
- Liste des **contrôles expirés** et **contrôles à venir sous 30 jours** (deux galeries compactes avec lien direct vers `scrDetail`)

## 2.8 Charte graphique (Fluent Design)

| Élément | Valeur |
|---|---|
| Police | Segoe UI (police par défaut Power Apps) |
| Couleur primaire | `#0078D4` |
| Conforme | `#107C10` sur fond `#DFF6DD` |
| À vérifier prochainement | `#CA5010` sur fond `#FDF0D5` |
| Non conforme | `#D13438` sur fond `#FDE7E9` |
| Hors service | `#605E5C` sur fond `#EDEBE9` |
| Rayon des coins | 8 px |
| Icônes | Bibliothèque **Fluent UI System Icons** intégrée aux contrôles `Icon` de Power Apps (`Icon.CheckBadge`, `Icon.Warning`, `Icon.Cancel`, `Icon.Blocked2`, `Icon.Filter`, `Icon.Search`, `Icon.Camera`, `Icon.Signature` si disponible sinon `Icon.Edit`) |
