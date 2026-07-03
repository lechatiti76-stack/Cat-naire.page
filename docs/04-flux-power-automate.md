# 4. Flux Power Automate

Sept flux couvrent l'automatisation complète du cycle de vie d'un contrôle, sur le modèle à 4 listes `Materiels` / `TypesPointControle` / `Controles` / `ResultatsPointsControle` (docs/01).

## 4.1 Génération automatique des points de contrôle (nouveau — remplace la création manuelle de listes par équipement)

**Déclencheur** : "Lorsqu'un élément est créé" sur `Controles`.

**Étapes :**
1. **Obtenir l'élément** `Materiels` lié (via `Materiel/Id`) pour lire sa `Categorie`.
2. **Obtenir les éléments** de `TypesPointControle` filtrés sur `Categorie eq '@{outputs('Obtenir_le_materiel')?['body/Categorie/Value']}'`.
3. **Appliquer à chacun** : **Créer un élément** dans `ResultatsPointsControle` avec `Controle` = l'élément déclencheur, `PointControle` = l'élément courant de la boucle, `Effectue` = false, `Rapport` = "Non validé", `Statut` = "Non conforme".

C'est ce flux qui **remplace** la pratique actuelle de créer une nouvelle liste SharePoint par équipement (`LECBV2-2411-01154`, `PerchePI56C2505005`…) : les points de contrôle sont désormais définis une seule fois par catégorie dans `TypesPointControle`, et dupliqués automatiquement à chaque contrôle.

## 4.2 Calcul quotidien du statut et de l'échéance (corrige le problème des colonnes `[Today]` figées)

**Déclencheur** : Flux planifié (Récurrence) — tous les jours à 6h00. *(remplace le comportement de `VALIDITE`, où `Jours restant`/`Statut` ne se recalculaient qu'à la prochaine modification manuelle d'une ligne)*

**Étapes :**
1. **Obtenir les éléments** de `Controles` (avec pagination si > 5000 lignes).
2. **Appliquer à chacun** :
   - **Obtenir l'élément** `Materiels` lié pour lire son `Etat`.
   - **Obtenir les éléments** `ResultatsPointsControle` liés, pour vérifier si l'un est "Non conforme".
   - **Condition** — déterminer `Statut` :
     - Si `Materiels.Etat` = "Hors service" → **Hors service**
     - Sinon si un point lié est "Non conforme" **ou** `Conforme` = false → **Non conforme**
     - Sinon si `dateDifference(utcNow(), DateProchainControle) <= 30 jours` → **À vérifier prochainement**
     - Sinon → **Conforme**
   - **Mettre à jour l'élément** `Controles` (uniquement si la valeur change, pour limiter les écritures).

## 4.3 Rappel avant expiration d'un contrôle

**Déclencheur** : Flux planifié — tous les jours à 7h00.

**Étapes :**
1. **Obtenir les éléments** de `Controles` avec filtre OData :
   `DateProchainControle le '@{addDays(utcNow(),30)}' and DateProchainControle ge '@{utcNow()}' and RappelEnvoye eq false`
2. **Appliquer à chacun** : **Envoyer un e-mail** (Outlook) au `Controleur` et au `Responsable` du matériel lié : *"Contrôle à prévoir : [Nom du matériel] ([N° série]) — échéance le [DateProchainControle]"*, puis mettre à jour `RappelEnvoye` = true.

## 4.4 Création automatique d'une tâche en cas de non-conformité

**Déclencheur** : "Lorsqu'un élément est créé ou modifié" sur `Controles`, condition de déclenchement `Conforme eq false`.

**Étapes :**
1. **Condition** : `Conforme` = false.
2. **Créer une tâche** (Planner, ou élément dans une liste `TachesCorrectives`) : titre *"Action corrective — [Nom du matériel] (N° [N° série])"*, assigné au `Responsable` du matériel, échéance +7 jours, description = `ActionsCorrectives` + liste des points non conformes (`ResultatsPointsControle` filtrés `Statut = Non conforme`).
3. **Envoyer un e-mail au responsable** (appel du flux 4.5).

## 4.5 Envoi d'un e-mail au responsable

Sous-flux appelé par 4.4 :
1. **Obtenir le responsable** du matériel.
2. **Envoyer un e-mail (V2)** avec corps HTML : nom du matériel, N° série, date du contrôle, contrôleur, liste des points non conformes, observations, actions correctives, lien vers la fiche Power Apps.

## 4.6 Génération d'un rapport PDF

**Déclencheur** : manuel (bouton Power Apps → flux `PowerApps (V2)`) ou planifié (mensuel).

**Étapes :**
1. **Obtenir les éléments** `Controles` du mois écoulé, avec leurs `ResultatsPointsControle` liés.
2. **Créer un fichier HTML** (template avec boucle `Apply to each` générant les lignes du tableau + le détail des points par contrôle).
3. **Convertir en PDF** (connecteur de conversion selon licence disponible).
4. **Créer le fichier** dans une bibliothèque SharePoint `Rapports` (dossier daté).
5. **Envoyer un e-mail** avec le PDF en pièce jointe aux destinataires configurés.

## 4.7 Archivage des anciens contrôles

**Déclencheur** : Flux planifié — mensuel.

**Étapes :**
1. **Obtenir les éléments** `Controles` de plus de 3 ans, ainsi que leurs `ResultatsPointsControle` liés.
2. **Créer les éléments** correspondants dans `ControlesArchives` / `ResultatsPointsControleArchives` (même schémas).
3. **Supprimer** les éléments d'origine des listes actives (après export CSV/Excel de sauvegarde optionnel).

## 4.8 Synthèse des flux

| # | Flux | Déclencheur | Fréquence |
|---|---|---|---|
| 1 | Génération des points de contrôle | Création `Controles` | Temps réel |
| 2 | Calcul quotidien statut & échéance | Planifié | Quotidien |
| 3 | Rappel avant expiration | Planifié | Quotidien |
| 4 | Tâche corrective si non-conforme | Création/modification `Controles` | Temps réel |
| 5 | E-mail au responsable | Appelé par 4 | Temps réel |
| 6 | Génération rapport PDF | Manuel ou planifié | Mensuel |
| 7 | Archivage anciens contrôles | Planifié | Mensuel |
