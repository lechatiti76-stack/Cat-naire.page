# 1. Analyse de la liste SharePoint & structure finale

> **Hypothèse de travail** : aucune liste SharePoint existante ne m'a été fournie (export, capture d'écran ou schéma). J'ai donc reconstitué la structure **typique** qu'on trouve dans 90 % des suivis de vérification de matériel faits « à la main » sous SharePoint — une **liste plate unique** — à partir des champs que vous avez listés dans la demande. C'est cette structure de départ que j'analyse ci-dessous, avant de proposer le modèle final retenu pour le reste de la solution (HTML, Power Apps, Power Fx, Power Automate).
>
> Si vous avez une liste existante, envoyez-moi son export de colonnes (Paramètres de liste → Colonnes) et j'ajusterai ce document en conséquence — la logique d'analyse ci-dessous reste valable.

## 1.1 Structure de départ probable (liste plate unique)

| Colonne | Type SharePoint utilisé habituellement | Problème identifié |
|---|---|---|
| Titre | Single line text (Nom du matériel) | Colonne système « Title » détournée de son usage, peu descriptive |
| Numéro d'inventaire | Single line text | Pas d'unicité garantie, pas de recherche indexée |
| Catégorie | Single line text | Saisie libre → fautes de frappe, valeurs incohérentes ("EPI", "epi", "É.P.I.") |
| Contrôleur | Single line text | Pas de lien avec l'annuaire M365, pas de photo/mail, filtrage fragile |
| État | Single line text | Idem : pas de contrôle de saisie |
| Conforme | Single line text ("Oui"/"Non") | Devrait être un booléen ou un Choice, pas du texte libre |
| Date du contrôle | Date and Time | OK, mais souvent sans heure ni fuseau explicite |
| Date du prochain contrôle | Date and Time | Saisie manuelle → oublis, incohérences avec la périodicité réelle |
| Observations / Actions correctives / Commentaires | Multiple lines of text | Trois champs texte proches, souvent confondus par les utilisateurs |
| Historique des contrôles | — (absent) | **Chaque contrôle écrase le précédent** : impossible de consulter l'historique d'un matériel |
| Photos | Hyperlink ou pièce jointe classique | Peu ergonomique, pas de galerie native |

### Problèmes concrets que cette structure pose

1. **Pas d'historique** : une liste plate à 1 ligne = 1 matériel ne peut stocker qu'un seul contrôle à la fois. Dès le 2ᵉ contrôle, on écrase les données du précédent (perte de traçabilité, non-conformité réglementaire pour les équipements soumis à contrôle périodique obligatoire — EPI, engins de levage, extincteurs…).
2. **Champs texte libres** (Catégorie, État, Contrôleur, Conforme) : source d'erreurs de saisie, impossibles à fiabiliser dans les filtres Power Apps (`Filter` sur du texte libre = résultats incohérents).
3. **Pas de délégation Power Apps garantie** : les colonnes texte libre avec recherche (`in`, `StartsWith` non indexé) et les listes qui dépassent le seuil de délégation (2 000 lignes par défaut) posent des soucis de performance si aucune colonne n'est indexée.
4. **Calcul de statut absent** : rien ne détermine si un matériel est "🟢 Conforme / 🟠 À vérifier prochainement / 🔴 Non conforme / ⚪ Hors service" → ce calcul serait refait à chaque affichage (mobile, web), avec un risque d'incohérence entre les interfaces.
5. **Pas de séparation référentiel / mouvement** : les informations stables du matériel (nom, catégorie, photo, périodicité) sont mélangées avec les informations d'un contrôle ponctuel (date, contrôleur, conformité) → duplication et risque d'incohérence si le nom du matériel change.

## 1.2 Améliorations proposées

| Objectif | Amélioration |
|---|---|
| **Performance / délégation Power Apps** | Indexer les colonnes utilisées en filtre (`NumInventaire`, `DateProchainControle`, `Categorie`, `Etat`) ; remplacer le texte libre par des colonnes **Choice** (listes de choix gérées, délégables) ; scinder en 2 listes pour réduire le volume de chaque requête |
| **Maintenance / cohérence des données** | Colonnes **Choice** à valeurs fermées pour Catégorie, État, Conforme ; colonne **Person or Group** pour le Contrôleur (lié à l'annuaire Entra ID, photo + mail automatiques) |
| **Facilité d'utilisation** | Calcul automatique de `DateProchainControle` par Power Automate (`DateControle + PeriodiciteMois`), évitant la saisie manuelle et les oublis |
| **Historique réglementaire** | **Séparation en 2 listes** : `Materiels` (référentiel, 1 ligne = 1 équipement) et `Controles` (mouvement, 1 ligne = 1 vérification, en relation *Lookup* vers `Materiels`) → historique complet conservé |
| **Compatibilité Power Apps** | Colonne calculée `Statut` stockée (et non recalculée à l'affichage) pour un rendu identique et performant sur tous les écrans (Power Apps délégable, JS, colonne de mise en forme SharePoint) |
| **Photos / signature** | Colonnes **Image** (type moderne SharePoint, pas Hyperlink) pour les photos du matériel et du contrôle ; champ texte long pour stocker la signature encodée en base64 générée par le contrôle de signature Power Apps |
| **Sécurité / traçabilité** | Colonnes `Créé par` / `Créé le` / `Modifié par` / `Modifié le` (nativement gérées par SharePoint) exploitées pour l'audit ; permissions au niveau liste (contrôleurs = Contribuer, direction = Lecture, admin = Contrôle total) |

## 1.3 Schéma final retenu

### Liste 1 — `Materiels` (référentiel, un enregistrement par équipement)

| Nom interne | Nom affiché | Type de colonne | Détails / configuration |
|---|---|---|---|
| `Title` | Nom du matériel | Single line text | Colonne titre native, obligatoire |
| `NumInventaire` | N° d'inventaire | Single line text | **Indexée**, contrainte d'unicité (forcer via règle de validation de colonne : `=ISERROR(FIND(" ",NumInventaire))` n'est pas suffisant → l'unicité stricte se fait via une **règle de validation de liste** ou un flux Power Automate de contrôle à la création) |
| `Categorie` | Catégorie | Choice | Extincteur, Échelle, EPI, Outillage électrique, Engin de levage, Véhicule, Autre |
| `Localisation` | Localisation | Choice ou Lookup | Site / Bâtiment / Atelier |
| `DateMiseEnService` | Date de mise en service | Date only | |
| `Etat` | État | Choice | En service, En réparation, Hors service, Réformé |
| `PeriodiciteMois` | Périodicité de contrôle (mois) | Number | Utilisée par le flux de calcul automatique de la prochaine échéance |
| `Responsable` | Responsable | Person or Group | Lié à l'annuaire M365 |
| `Photo` | Photo du matériel | Image (colonne moderne) | |
| `Actif` | Actif | Yes/No | Permet de masquer les matériels réformés sans les supprimer |

### Liste 2 — `Controles` (mouvement, un enregistrement par vérification)

| Nom interne | Nom affiché | Type de colonne | Détails / configuration |
|---|---|---|---|
| `Title` | Référence du contrôle | Single line text | Généré automatiquement par flux : `[NumInventaire] – [DateControle]` |
| `Materiel` | Matériel | **Lookup** vers `Materiels.Title` | **Indexée** ; autoriser aussi la remontée des colonnes `NumInventaire`, `Categorie`, `Photo` en colonnes de projection (*lookup columns* additionnelles) pour éviter des appels supplémentaires depuis Power Apps |
| `DateControle` | Date du contrôle | Date only | **Indexée** |
| `DateProchainControle` | Date du prochain contrôle | Date only | **Indexée** ; calculée par Power Automate = `DateControle + PeriodiciteMois` du matériel lié (voir docs/04) |
| `Controleur` | Contrôleur | Person or Group | |
| `Conforme` | Conforme | Yes/No | |
| `Statut` | Statut | Choice (calculé et **stocké** par Power Automate à chaque création/modification) | Conforme / À vérifier prochainement / Non conforme / Hors service — voir règle de calcul ci-dessous |
| `Observations` | Observations | Multiple lines of text (texte brut) | |
| `ActionsCorrectives` | Actions correctives | Multiple lines of text (texte brut) | |
| `Commentaires` | Commentaires | Multiple lines of text (texte brut) | |
| `PhotosControle` | Photos du contrôle | Image (colonne moderne, plusieurs pièces jointes autorisées) | |
| `Signature` | Signature | Multiple lines of text (texte brut, stocke une image en base64) | Alimentée par le contrôle *Pen Input* / *Signature* de Power Apps |

**Règle de calcul de `Statut`** (portée identiquement en Power Automate, Power Fx et JavaScript pour garantir un rendu cohérent partout) :
1. Si `Etat` du matériel = "Hors service" → **Hors service** (⚪)
2. Sinon si `Conforme` = Non → **Non conforme** (🔴)
3. Sinon si `DateProchainControle` − aujourd'hui ≤ 30 jours → **À vérifier prochainement** (🟠)
4. Sinon → **Conforme** (🟢)

### Pourquoi 2 listes plutôt qu'une seule ?

- **Historique complet** : un matériel peut avoir des dizaines de contrôles dans le temps ; chacun doit rester consultable (obligation réglementaire pour beaucoup d'équipements : EPI, engins de levage, électricité, incendie).
- **Pas de duplication** : le nom, la catégorie, la photo du matériel ne sont saisis qu'une fois, dans `Materiels`.
- **Performance Power Apps** : chaque écran ne charge que ce dont il a besoin (galerie de matériels **ou** historique d'un seul matériel via `Filter(Controles, Materiel.Id = ThisItem.ID)`), au lieu de charger une liste plate qui grossit indéfiniment.
- **Délégation** : les deux listes restent sous le seuil de délégation plus longtemps, et les colonnes clés sont indexées.

### Vue « à plat » utilisée par l'interface HTML et les galeries Power Apps

L'interface de consultation (tableau HTML, galerie Power Apps) affiche une **jointure** `Controles` ⟶ `Materiels` (via la colonne Lookup `Materiel`), ce qui correspond exactement aux colonnes demandées dans le cahier des charges :

Nom du matériel · Numéro d'inventaire · Catégorie · Date du contrôle · Date du prochain contrôle · Contrôleur · État · Conforme · Observations · Actions correctives · Commentaires.

> Si vous préférez une architecture plus simple à mettre en œuvre (une seule liste, pas d'historique multi-contrôles), il est possible de fusionner les deux listes en une seule "liste plate" ; toutes les formules Power Fx et flux Power Automate fournis restent quasi identiques, seule la partie `Lookup`/jointure disparaît. Je recommande toutefois le modèle à 2 listes pour toute exploitation professionnelle durable.
