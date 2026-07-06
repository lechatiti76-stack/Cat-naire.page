/**
 * sharepoint.js — Accès à l'API REST SharePoint (lecture des 4 listes,
 * écriture d'un nouveau contrôle + son détail par point).
 *
 * Fonctionne uniquement lorsque la page est ouverte depuis le site
 * SharePoint lui-même (authentification par cookie de session de
 * l'utilisateur connecté). Voir sharepoint-config.js et
 * docs/05-guide-deploiement.md §5.6.
 */

const SharePointAPI = (() => {
  const { siteUrl, listes } = SHAREPOINT_CONFIG;

  function estDisponible() {
    // La page doit être servie depuis le même domaine que le site SharePoint
    // pour que les appels authentifiés (cookies) fonctionnent.
    return window.location.origin.replace(/^https?:\/\//, "").endsWith(".sharepoint.com")
        || window.location.origin === siteUrl;
  }

  async function appelJson(url, options = {}) {
    const res = await fetch(url, {
      credentials: "same-origin",
      ...options,
      headers: {
        Accept: "application/json;odata=verbose",
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      const texte = await res.text().catch(() => "");
      throw new Error(`Erreur SharePoint ${res.status} sur ${url}\n${texte}`);
    }
    return res.json();
  }

  async function utilisateurCourant() {
    const json = await appelJson(`${siteUrl}/_api/web/currentuser`);
    return { id: json.d.Id, nom: json.d.Title, email: json.d.Email };
  }

  async function obtenirTousLesElements(listName, queryString) {
    let url = `${siteUrl}/_api/web/lists/getbytitle('${encodeURIComponent(listName)}')/items?${queryString}`;
    const resultats = [];
    while (url) {
      const json = await appelJson(url);
      resultats.push(...json.d.results);
      url = json.d.__next || null;
    }
    return resultats;
  }

  async function obtenirTypeEntite(listName) {
    const json = await appelJson(
      `${siteUrl}/_api/web/lists/getbytitle('${encodeURIComponent(listName)}')?$select=ListItemEntityTypeFullName`
    );
    return json.d.ListItemEntityTypeFullName;
  }

  async function obtenirJetonDigest() {
    const json = await appelJson(`${siteUrl}/_api/contextinfo`, { method: "POST" });
    return json.d.GetContextWebInformation.FormDigestValue;
  }

  async function creerElement(listName, champs) {
    const [typeEntite, digest] = await Promise.all([obtenirTypeEntite(listName), obtenirJetonDigest()]);
    const json = await appelJson(`${siteUrl}/_api/web/lists/getbytitle('${encodeURIComponent(listName)}')/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json;odata=verbose",
        "X-RequestDigest": digest,
      },
      body: JSON.stringify({ __metadata: { type: typeEntite }, ...champs }),
    });
    return json.d; // élément créé, avec son Id
  }

  /** Charge Materiels + TypesPointControle + Controles (avec Materiel/Controleur expandés). */
  async function chargerDonnees() {
    const [materielsRaw, typesRaw, controlesRaw] = await Promise.all([
      obtenirTousLesElements(
        listes.materiels,
        "$select=Id,Title,NumSerie,Reference,Categorie,Etat,PeriodiciteMois,Actif,Responsable/Title,Responsable/EMail&$expand=Responsable&$top=500"
      ),
      obtenirTousLesElements(listes.typesPointControle, "$select=Id,Title,Categorie,Ordre&$orderby=Ordre&$top=500"),
      obtenirTousLesElements(
        listes.controles,
        "$select=Id,Title,DateControle,DateProchainControle,Conforme,Statut,Observations,ActionsCorrectives,Commentaires,Controleur/Title,Materiel/Id,Materiel/Title,Materiel/NumSerie,Materiel/Reference,Materiel/Categorie,Materiel/Etat&$expand=Controleur,Materiel&$orderby=DateControle desc&$top=1000"
      ),
    ]);

    const materiels = materielsRaw
      .filter((m) => m.Actif !== false)
      .map((m) => ({
        id: m.Id,
        title: m.Title,
        numSerie: m.NumSerie,
        reference: m.Reference,
        categorie: m.Categorie,
        etat: m.Etat,
        periodiciteMois: m.PeriodiciteMois,
        responsable: m.Responsable ? m.Responsable.Title : "",
      }));

    const typesPointControle = {};
    typesRaw.forEach((t) => {
      if (!typesPointControle[t.Categorie]) typesPointControle[t.Categorie] = [];
      typesPointControle[t.Categorie].push({ id: t.Id, libelle: t.Title, ordre: t.Ordre });
    });

    const controles = controlesRaw
      .filter((c) => c.Materiel)
      .map((c) => ({
        id: c.Id,
        materielId: c.Materiel.Id,
        materiel: c.Materiel.Title,
        numSerie: c.Materiel.NumSerie,
        reference: c.Materiel.Reference,
        categorie: c.Materiel.Categorie,
        etat: c.Materiel.Etat,
        dateControle: c.DateControle ? c.DateControle.slice(0, 10) : "",
        dateProchainControle: c.DateProchainControle ? c.DateProchainControle.slice(0, 10) : "",
        controleur: c.Controleur ? c.Controleur.Title : "",
        conforme: !!c.Conforme,
        statut: c.Statut,
        observations: c.Observations || "",
        actionsCorrectives: c.ActionsCorrectives || "",
        commentaires: c.Commentaires || "",
      }));

    return { materiels, typesPointControle, controles };
  }

  /**
   * Crée l'en-tête du contrôle dans Controles, puis une ligne par point de
   * contrôle dans ResultatsPointsControle (docs/02 §2.6-2.7, docs/03 §3.7-3.8,
   * docs/04 flux 4.1). Retourne le contrôle créé enrichi du statut calculé.
   */
  async function enregistrerControle({ materiel, dateControle, controleurId, observations, actionsCorrectives, commentaires, points }) {
    const conformeGlobal = points.every((p) => p.statut === "Conforme");
    const dateProchain = ajouterMois(dateControle, materiel.periodiciteMois || 6);
    const joursRestants = Math.ceil((new Date(dateProchain) - new Date(dateControle)) / 86400000);
    let statutGlobal = "Conforme";
    if (materiel.etat === "Hors service") statutGlobal = "Hors service";
    else if (!conformeGlobal) statutGlobal = "Non conforme";
    else if (joursRestants <= SHAREPOINT_CONFIG.seuilJours) statutGlobal = "À vérifier prochainement";

    const controleCree = await creerElement(listes.controles, {
      Title: `${materiel.numSerie} – ${dateControle}`,
      MaterielId: materiel.id,
      DateControle: `${dateControle}T00:00:00Z`,
      DateProchainControle: `${dateProchain}T00:00:00Z`,
      ControleurId: controleurId,
      Conforme: conformeGlobal,
      Statut: statutGlobal,
      Observations: observations || "",
      ActionsCorrectives: actionsCorrectives || "",
      Commentaires: commentaires || "",
    });

    // Une ligne ResultatsPointsControle par point (flux 4.1, ici fait côté client
    // à la création — le flux planifié 4.2 reste la source de vérité pour le
    // recalcul quotidien du Statut global).
    for (const point of points) {
      await creerElement(listes.resultatsPointsControle, {
        Title: `${controleCree.Id} – ${point.libelle}`,
        ControleId: controleCree.Id,
        PointControleId: point.id,
        Effectue: true,
        Rapport: point.statut === "Conforme" ? "Validé" : "Non validé",
        Statut: point.statut,
      });
    }

    return { id: controleCree.Id, statut: statutGlobal, conforme: conformeGlobal, dateProchainControle: dateProchain };
  }

  function ajouterMois(dateIso, nbMois) {
    const d = new Date(dateIso + "T00:00:00Z");
    d.setUTCMonth(d.getUTCMonth() + nbMois);
    return d.toISOString().slice(0, 10);
  }

  return { estDisponible, utilisateurCourant, chargerDonnees, enregistrerControle };
})();
