# 4. Flux Power Automate

Cinq flux couvrent l'automatisation complète du cycle de vie d'un contrôle. Tous s'appuient sur les listes `Materiels` et `Controles` définies dans docs/01.

## 4.1 Calcul automatique du statut et de la prochaine échéance

**Déclencheur** : "Lorsqu'un élément est créé ou modifié" sur `Controles`.

**Étapes :**
1. **Obtenir l'élément** parent dans `Materiels` (via `Materiel/Id`) pour lire `PeriodiciteMois` et `Etat`.
2. **Condition** — calculer `DateProchainControle` = `addToTime(triggerBody()?['DateControle'], PeriodiciteMois, 'Month')` si le champ n'a pas été saisi manuellement.
3. **Condition imbriquée** — déterminer `Statut` :
   - Si `Etat` matériel = "Hors service" → `Statut = "Hors service"`
   - Sinon si `Conforme` = false → `Statut = "Non conforme"`
   - Sinon si `dateDifference(utcNow(), DateProchainControle) <= 30 jours` → `Statut = "À vérifier prochainement"`
   - Sinon → `Statut = "Conforme"`
4. **Mettre à jour l'élément** `Controles` avec les valeurs calculées (utiliser un déclenchement conditionnel `Update Item` sans re-déclencher la boucle : cocher "Élément déclencheur uniquement lors d'une modification manuelle" ou comparer les valeurs avant mise à jour pour éviter une boucle infinie).

## 4.2 Rappel avant expiration d'un contrôle

**Déclencheur** : Flux planifié (Récurrence) — tous les jours à 7h00.

**Étapes :**
1. **Obtenir les éléments** de `Controles` avec filtre OData :
   `DateProchainControle le '@{addDays(utcNow(),30)}' and DateProchainControle ge '@{utcNow()}'`
2. **Appliquer à chacun** :
   - **Envoyer un e-mail** (Outlook/Office 365) au `Controleur` et au `Responsable` du matériel lié : objet *"Contrôle à prévoir : [Nom du matériel] — échéance le [DateProchainControle]"*.
   - **Publier une carte Adaptive Card dans Teams** (optionnel) sur le canal "Maintenance".
3. Journaliser l'envoi dans une colonne `RappelEnvoye` (Yes/No) pour éviter les doublons si le flux tourne plusieurs jours de suite avant l'échéance (ajouter une condition `RappelEnvoye = false` au filtre).

## 4.3 Création automatique d'une tâche en cas de non-conformité

**Déclencheur** : "Lorsqu'un élément est créé ou modifié" sur `Controles`, avec condition de déclenchement `Conforme eq false`.

**Étapes :**
1. **Condition** : `Conforme` = false.
2. **Créer une tâche** dans Planner (ou un élément dans une liste `TachesCorrectives`) :
   - Titre : *"Action corrective — [Nom du matériel] (N° [NumInventaire])"*
   - Assigné à : `Responsable` du matériel
   - Échéance : +7 jours (configurable)
   - Description : contenu du champ `ActionsCorrectives` + lien vers la fiche SharePoint
3. **Envoyer un e-mail au responsable** (voir 4.4).

## 4.4 Envoi d'un e-mail au responsable

Sous-flux appelé par 4.3 (et déclenchable seul sur "Hors service") :
1. **Obtenir le responsable** du matériel (`Materiels.Responsable`).
2. **Envoyer un e-mail (V2)** avec un corps HTML reprenant : nom du matériel, date du contrôle, contrôleur, observations, actions correctives, et un bouton lien direct vers la fiche Power Apps (`Navigate` profond via un lien d'application Power Apps `https://apps.powerapps.com/play/...&materielId=...`).

## 4.5 Génération d'un rapport PDF

**Déclencheur** : manuel (bouton Power Apps `Office365Outlook.SendEmail` déclenchant un flux `PowerApps (V2)`) ou planifié (mensuel).

**Étapes :**
1. **Obtenir les éléments** `Controles` du mois écoulé (filtre OData sur `DateControle`).
2. **Créer un fichier HTML** (via action "Créer un fichier" + template HTML avec boucle `Apply to each` générant les lignes d'un tableau).
3. **Convertir le fichier HTML en PDF** (connecteur "Convertisseur PDF" / Encodian / Muhimbi selon licence disponible).
4. **Créer le fichier** dans une bibliothèque SharePoint `Rapports` (dossier daté `AAAA-MM`).
5. **Envoyer un e-mail** avec le PDF en pièce jointe aux destinataires configurés (responsables, QHSE).

## 4.6 Archivage des anciens contrôles

**Déclencheur** : Flux planifié (Récurrence) — mensuel.

**Étapes :**
1. **Obtenir les éléments** `Controles` dont `DateControle` a plus de 3 ans (configurable selon obligation réglementaire du type de matériel).
2. **Créer un élément** dans une liste `ControlesArchives` (même schéma) avec les valeurs copiées.
3. **Supprimer l'élément** de `Controles` actif, pour garder la liste active légère et performante (délégation, temps de chargement Power Apps).
4. Option : exporter d'abord vers un fichier Excel/CSV archivé dans une bibliothèque SharePoint avant suppression, pour une trace supplémentaire hors liste.

## 4.7 Synthèse des flux

| # | Flux | Déclencheur | Fréquence |
|---|---|---|---|
| 1 | Calcul statut & prochaine échéance | Création/modification `Controles` | Temps réel |
| 2 | Rappel avant expiration | Planifié | Quotidien |
| 3 | Tâche corrective si non-conforme | Création/modification `Controles` | Temps réel |
| 4 | E-mail au responsable | Appelé par 3 (ou déclencheur "Hors service") | Temps réel |
| 5 | Génération rapport PDF | Manuel (bouton Power Apps) ou planifié | Mensuel |
| 6 | Archivage anciens contrôles | Planifié | Mensuel |
