/* ============================================================
   Le Carnet — logique de l'app
   Tout est local : pas de backend, pas de token.
   ============================================================ */

const VERSION = "1.0.0";
const URL_PAR_DEFAUT = "./expressions.json";

const CLES = {
  url: "lc_url",
  cache: "lc_cache",        // dernière liste d'expressions téléchargée (normalisée)
  meta: "lc_meta",          // { id: { statut, fav, poids, maj } }
  activite: "lc_activite",  // ["2026-06-11", ...] jours avec au moins une action
  derniereSync: "lc_sync",
};

const STATUTS = {
  apprendre: "À apprendre",
  utilisee: "Utilisée",
  maitrisee: "Maîtrisée",
};

// ---------- État ----------
const etat = {
  expressions: [],          // liste normalisée et triée
  meta: lireJSON(CLES.meta, {}),
  filtre: "tous",
  registre: "",
  recherche: "",
  vue: "carnet",
  quiz: { courante: null, revele: false, vues: 0, sues: 0 },
};

// ---------- Petites aides ----------
function lireJSON(cle, defaut) {
  try {
    const brut = localStorage.getItem(cle);
    return brut ? JSON.parse(brut) : defaut;
  } catch { return defaut; }
}

function ecrireJSON(cle, valeur) {
  try { localStorage.setItem(cle, JSON.stringify(valeur)); } catch {}
}

function aujourdhui() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// id stable dérivé de l'expression : minuscules, sans accents, tirets
function genererId(expr) {
  return expr
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function echapper(texte) {
  const div = document.createElement("div");
  div.textContent = texte ?? "";
  return div.innerHTML;
}

function toast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, 2400);
}

function noterActivite() {
  const jours = lireJSON(CLES.activite, []);
  const jour = aujourdhui();
  if (!jours.includes(jour)) {
    jours.push(jour);
    ecrireJSON(CLES.activite, jours);
  }
}

// ---------- Données ----------
function normaliser(brut) {
  if (!Array.isArray(brut)) throw new Error("Le JSON doit être un tableau.");
  const vues = new Set();
  const liste = [];
  for (const objet of brut) {
    if (!objet || typeof objet.expr !== "string" || !objet.expr.trim()) continue;
    const id = objet.id || genererId(objet.expr);
    if (vues.has(id)) continue; // doublon : on garde la première occurrence
    vues.add(id);
    liste.push({
      id,
      expr: objet.expr.trim(),
      sens: objet.sens || "",
      exemple: objet.exemple || "",
      registre: objet.registre || "",
      date: objet.date || "",
    });
  }
  // tri : datées du plus récent au plus ancien, non datées à la fin (ordre du fichier)
  return liste
    .map((e, i) => ({ e, i }))
    .sort((a, b) => {
      if (a.e.date && b.e.date) return b.e.date.localeCompare(a.e.date) || a.i - b.i;
      if (a.e.date) return -1;
      if (b.e.date) return 1;
      return a.i - b.i;
    })
    .map(({ e }) => e);
}

function metaDe(id) {
  return etat.meta[id] || { statut: "apprendre", fav: false, poids: 0 };
}

function majMeta(id, patch) {
  etat.meta[id] = { ...metaDe(id), ...patch, maj: Date.now() };
  ecrireJSON(CLES.meta, etat.meta);
  noterActivite();
}

function urlSource() {
  return (localStorage.getItem(CLES.url) || "").trim() || URL_PAR_DEFAUT;
}

async function chargerExpressions({ silencieux = false } = {}) {
  const btn = document.getElementById("btn-refresh");
  btn.classList.add("tourne");
  try {
    const url = urlSource();
    const separateur = url.includes("?") ? "&" : "?";
    const reponse = await fetch(`${url}${separateur}t=${Date.now()}`, { cache: "no-store" });
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
    const brut = await reponse.json();
    const fraiches = normaliser(brut);

    // merge : les nouvelles arrivent en « à apprendre », les statuts existants sont conservés
    const anciennes = new Set(etat.expressions.map((e) => e.id));
    const nouvelles = fraiches.filter((e) => !anciennes.has(e.id));

    etat.expressions = fraiches;
    ecrireJSON(CLES.cache, fraiches);
    localStorage.setItem(CLES.derniereSync, String(Date.now()));

    if (!silencieux) {
      toast(nouvelles.length
        ? `${nouvelles.length} nouvelle${nouvelles.length > 1 ? "s" : ""} expression${nouvelles.length > 1 ? "s" : ""} ! 🎉`
        : "Carnet à jour ✓");
    }
  } catch (erreur) {
    // hors ligne ou URL cassée : on retombe sur le cache local
    const cache = lireJSON(CLES.cache, []);
    if (cache.length) {
      etat.expressions = cache;
      if (!silencieux) toast("Hors ligne — version en cache 📡");
    } else if (!silencieux) {
      toast("Impossible de charger les expressions 😕");
      console.error(erreur);
    }
  } finally {
    btn.classList.remove("tourne");
    majInfoSync();
    rendre();
  }
}

function majInfoSync() {
  const el = document.getElementById("sync-info");
  const ts = Number(localStorage.getItem(CLES.derniereSync) || 0);
  if (!ts) { el.textContent = ""; return; }
  const minutes = Math.round((Date.now() - ts) / 60000);
  el.textContent = minutes < 1 ? "à jour" : minutes < 60 ? `il y a ${minutes} min` : `il y a ${Math.round(minutes / 60)} h`;
}

// ---------- Rendu : Carnet ----------
function expressionsFiltrees() {
  const q = etat.recherche.toLowerCase();
  return etat.expressions.filter((e) => {
    const m = metaDe(e.id);
    if (etat.filtre === "favoris" && !m.fav) return false;
    if (["apprendre", "utilisee", "maitrisee"].includes(etat.filtre) && m.statut !== etat.filtre) return false;
    if (etat.registre && e.registre !== etat.registre) return false;
    if (q && !`${e.expr} ${e.sens} ${e.exemple}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

function rendreCarnet() {
  const liste = expressionsFiltrees();
  const conteneur = document.getElementById("liste-cartes");
  document.getElementById("liste-vide").hidden = liste.length > 0;
  document.getElementById("compteur-liste").textContent =
    `${liste.length} / ${etat.expressions.length}`;

  conteneur.innerHTML = liste.map((e) => {
    const m = metaDe(e.id);
    return `
    <article class="carte" data-id="${e.id}">
      <div class="carte-haut">
        <h2 class="carte-expr">${echapper(e.expr)}</h2>
        <button class="btn-fav ${m.fav ? "actif" : ""}" data-action="fav" aria-label="${m.fav ? "Retirer des favoris" : "Ajouter aux favoris"}" aria-pressed="${m.fav}">★</button>
      </div>
      ${e.sens ? `<p class="carte-sens">${echapper(e.sens)}</p>` : ""}
      ${e.exemple ? `<p class="carte-exemple">${echapper(e.exemple)}</p>` : ""}
      <div class="carte-pied">
        ${e.registre ? `<span class="badge-registre">${echapper(e.registre)}</span>` : "<span></span>"}
        ${e.date ? `<span class="badge-date">${echapper(e.date)}</span>` : ""}
      </div>
      <div class="statuts" role="group" aria-label="Statut de l'expression">
        ${Object.entries(STATUTS).map(([cle, libelle]) => `
          <button class="btn-statut ${m.statut === cle ? "actif" : ""}" data-action="statut" data-statut="${cle}" aria-pressed="${m.statut === cle}">${libelle}</button>
        `).join("")}
      </div>
    </article>`;
  }).join("");
}

function rendreFiltreRegistre() {
  const select = document.getElementById("filtre-registre");
  const registres = [...new Set(etat.expressions.map((e) => e.registre).filter(Boolean))].sort();
  const valeur = etat.registre;
  select.innerHTML = `<option value="">Tous les registres</option>` +
    registres.map((r) => `<option value="${echapper(r)}" ${r === valeur ? "selected" : ""}>${echapper(r)}</option>`).join("");
}

// ---------- Rendu : Révision ----------
function tirerExpressionQuiz() {
  const pool = etat.expressions.filter((e) => e.sens);
  if (!pool.length) return null;
  // répétition espacée légère : « à apprendre » ×4, « utilisée » ×2, « maîtrisée » ×1,
  // et celles ratées récemment (poids > 0) remontent encore plus.
  const tickets = [];
  for (const e of pool) {
    if (etat.quiz.courante && e.id === etat.quiz.courante.id && pool.length > 1) continue;
    const m = metaDe(e.id);
    const base = m.statut === "apprendre" ? 4 : m.statut === "utilisee" ? 2 : 1;
    const n = base + Math.min(m.poids || 0, 4);
    for (let i = 0; i < n; i++) tickets.push(e);
  }
  return tickets[Math.floor(Math.random() * tickets.length)];
}

function rendreRevision() {
  const zone = document.getElementById("quiz-zone");
  const e = etat.quiz.courante;

  if (!e) {
    zone.innerHTML = `<p class="vide">Aucune expression avec un sens à réviser pour l'instant.</p>`;
    return;
  }

  const m = metaDe(e.id);
  zone.innerHTML = `
    <div class="quiz-carte">
      <p class="quiz-consigne">Tu connais le sens de…</p>
      <p class="quiz-question">« ${echapper(e.expr)} »</p>
      ${e.registre ? `<span class="badge-registre">${echapper(e.registre)}</span>` : ""}

      ${etat.quiz.revele ? `
        <div class="quiz-reponse">
          <p class="quiz-sens">${echapper(e.sens)}</p>
          ${e.exemple ? `<p class="quiz-exemple">${echapper(e.exemple)}</p>` : ""}
          <div class="statuts" role="group" aria-label="Mettre à jour le statut">
            ${Object.entries(STATUTS).map(([cle, libelle]) => `
              <button class="btn-statut ${m.statut === cle ? "actif" : ""}" data-quiz-statut="${cle}">${libelle}</button>
            `).join("")}
          </div>
          <div class="quiz-actions">
            <button class="btn-secondaire" data-quiz="rate">🤔 À revoir</button>
            <button class="btn-principal" data-quiz="su">✅ Je connaissais</button>
          </div>
        </div>
      ` : `
        <div class="quiz-actions">
          <button class="btn-principal" data-quiz="reveler">Voir le sens</button>
        </div>
      `}
    </div>
    <p class="quiz-score">${etat.quiz.vues ? `Session : ${etat.quiz.sues} / ${etat.quiz.vues} connues` : "Devine, puis vérifie. Les « à apprendre » reviennent plus souvent."}</p>
  `;
}

// ---------- Rendu : Stats ----------
function calculerStreak() {
  const jours = new Set(lireJSON(CLES.activite, []));
  let streak = 0;
  const curseur = new Date();
  // le jour courant compte s'il est actif, sinon on regarde à partir d'hier
  if (!jours.has(aujourdhui())) curseur.setDate(curseur.getDate() - 1);
  for (;;) {
    const cle = `${curseur.getFullYear()}-${String(curseur.getMonth() + 1).padStart(2, "0")}-${String(curseur.getDate()).padStart(2, "0")}`;
    if (!jours.has(cle)) break;
    streak++;
    curseur.setDate(curseur.getDate() - 1);
  }
  return streak;
}

function rendreStats() {
  const zone = document.getElementById("stats-zone");
  const total = etat.expressions.length;
  const comptes = { apprendre: 0, utilisee: 0, maitrisee: 0 };
  for (const e of etat.expressions) comptes[metaDe(e.id).statut]++;

  const streak = calculerStreak();
  const pct = (n) => total ? Math.round((n / total) * 100) : 0;

  // expression du jour : choix déterministe basé sur la date
  let exprJour = null;
  if (total) {
    const graine = aujourdhui().split("-").join("");
    exprJour = etat.expressions[Number(graine) % total];
  }

  // ajouts des 14 derniers jours
  const jours = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const cle = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    jours.push({ cle, label: `${d.getDate()}/${d.getMonth() + 1}`, n: etat.expressions.filter((e) => e.date === cle).length });
  }
  const maxJour = Math.max(1, ...jours.map((j) => j.n));

  zone.innerHTML = `
    <div class="tuiles">
      <div class="tuile t-apprendre"><div class="tuile-chiffre">${comptes.apprendre}</div><div class="tuile-label">à apprendre</div></div>
      <div class="tuile t-utilisee"><div class="tuile-chiffre">${comptes.utilisee}</div><div class="tuile-label">utilisées</div></div>
      <div class="tuile t-maitrisee"><div class="tuile-chiffre">${comptes.maitrisee}</div><div class="tuile-label">maîtrisées</div></div>
    </div>

    <div class="bloc-stat">
      <h3>Streak</h3>
      <div class="streak-ligne">
        <span class="streak-flamme">${streak > 0 ? "🔥" : "🕯️"}</span>
        <span class="streak-nombre">${streak}</span>
        <span class="streak-texte">jour${streak > 1 ? "s" : ""} d'affilée${streak === 0 ? " — touche une carte pour relancer !" : ""}</span>
      </div>
    </div>

    <div class="bloc-stat">
      <h3>Progression — ${total} expression${total > 1 ? "s" : ""}</h3>
      <div class="barre-progression">
        <div class="seg-maitrisee" style="width:${pct(comptes.maitrisee)}%"></div>
        <div class="seg-utilisee" style="width:${pct(comptes.utilisee)}%"></div>
        <div class="seg-apprendre" style="width:${pct(comptes.apprendre)}%"></div>
      </div>
      <div class="legende">
        <span><span class="pastille" style="background:var(--vert)"></span>${pct(comptes.maitrisee)} % maîtrisées</span>
        <span><span class="pastille" style="background:var(--bleu)"></span>${pct(comptes.utilisee)} % utilisées</span>
        <span><span class="pastille" style="background:var(--rose)"></span>${pct(comptes.apprendre)} % à apprendre</span>
      </div>
    </div>

    ${exprJour ? `
    <div class="bloc-stat">
      <h3>Expression du jour</h3>
      <p class="expr-jour">« ${echapper(exprJour.expr)} »</p>
      ${exprJour.sens ? `<p class="expr-jour-sens">${echapper(exprJour.sens)}</p>` : ""}
    </div>` : ""}

    <div class="bloc-stat">
      <h3>Nouvelles expressions — 14 derniers jours</h3>
      <div class="graphe">
        ${jours.map((j, i) => `
          <div class="graphe-jour">
            <div class="graphe-barre" style="height:${Math.round((j.n / maxJour) * 70)}px" title="${j.cle} : ${j.n}"></div>
            ${i % 3 === 1 ? `<span class="graphe-label">${j.label}</span>` : `<span class="graphe-label">&nbsp;</span>`}
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

// ---------- Rendu global & navigation ----------
function rendre() {
  if (etat.vue === "carnet") { rendreFiltreRegistre(); rendreCarnet(); }
  else if (etat.vue === "revision") rendreRevision();
  else if (etat.vue === "stats") rendreStats();
}

function changerVue(vue) {
  etat.vue = vue;
  for (const section of document.querySelectorAll(".vue")) {
    section.hidden = section.id !== `vue-${vue}`;
  }
  for (const tab of document.querySelectorAll(".tab")) {
    tab.classList.toggle("actif", tab.dataset.vue === vue);
  }
  if (vue === "revision" && !etat.quiz.courante) {
    etat.quiz.courante = tirerExpressionQuiz();
    etat.quiz.revele = false;
  }
  rendre();
  window.scrollTo({ top: 0 });
}

// ---------- Événements ----------
function brancherEvenements() {
  // navigation
  for (const tab of document.querySelectorAll(".tab")) {
    tab.addEventListener("click", () => changerVue(tab.dataset.vue));
  }

  // rafraîchir
  document.getElementById("btn-refresh").addEventListener("click", () => chargerExpressions());

  // recherche
  document.getElementById("recherche").addEventListener("input", (ev) => {
    etat.recherche = ev.target.value;
    rendreCarnet();
  });

  // filtres statut
  for (const chip of document.querySelectorAll(".chip")) {
    chip.addEventListener("click", () => {
      etat.filtre = chip.dataset.filtre;
      for (const c of document.querySelectorAll(".chip")) c.classList.toggle("actif", c === chip);
      rendreCarnet();
    });
  }

  // filtre registre
  document.getElementById("filtre-registre").addEventListener("change", (ev) => {
    etat.registre = ev.target.value;
    rendreCarnet();
  });

  // actions sur les cartes (délégation)
  document.getElementById("liste-cartes").addEventListener("click", (ev) => {
    const bouton = ev.target.closest("button");
    if (!bouton) return;
    const carte = bouton.closest(".carte");
    const id = carte?.dataset.id;
    if (!id) return;

    if (bouton.dataset.action === "fav") {
      majMeta(id, { fav: !metaDe(id).fav });
      rendreCarnet();
    } else if (bouton.dataset.action === "statut") {
      majMeta(id, { statut: bouton.dataset.statut });
      rendreCarnet();
    }
  });

  // quiz (délégation)
  document.getElementById("quiz-zone").addEventListener("click", (ev) => {
    const bouton = ev.target.closest("button");
    if (!bouton) return;
    const e = etat.quiz.courante;
    if (!e) return;

    if (bouton.dataset.quiz === "reveler") {
      etat.quiz.revele = true;
      noterActivite();
      rendreRevision();
    } else if (bouton.dataset.quiz === "su") {
      etat.quiz.vues++; etat.quiz.sues++;
      majMeta(e.id, { poids: Math.max(0, (metaDe(e.id).poids || 0) - 1) });
      etat.quiz.courante = tirerExpressionQuiz();
      etat.quiz.revele = false;
      rendreRevision();
    } else if (bouton.dataset.quiz === "rate") {
      etat.quiz.vues++;
      majMeta(e.id, { poids: (metaDe(e.id).poids || 0) + 2 });
      etat.quiz.courante = tirerExpressionQuiz();
      etat.quiz.revele = false;
      rendreRevision();
    } else if (bouton.dataset.quizStatut) {
      majMeta(e.id, { statut: bouton.dataset.quizStatut });
      rendreRevision();
    }
  });

  // réglages
  document.getElementById("btn-sauver-url").addEventListener("click", () => {
    const valeur = document.getElementById("reglage-url").value.trim();
    if (valeur) localStorage.setItem(CLES.url, valeur);
    else localStorage.removeItem(CLES.url);
    toast("URL enregistrée");
    chargerExpressions();
  });

  document.getElementById("btn-export").addEventListener("click", () => {
    const exportation = {
      version: VERSION,
      exporte_le: new Date().toISOString(),
      meta: etat.meta,
      activite: lireJSON(CLES.activite, []),
    };
    const blob = new Blob([JSON.stringify(exportation, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `le-carnet-progression-${aujourdhui()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  document.getElementById("btn-reset").addEventListener("click", () => {
    if (!confirm("Effacer tous tes statuts, favoris et ton streak sur cet appareil ?")) return;
    for (const cle of Object.values(CLES)) localStorage.removeItem(cle);
    etat.meta = {};
    toast("Données réinitialisées");
    chargerExpressions();
  });

  // rafraîchissement silencieux quand on revient sur l'app
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      majInfoSync();
      chargerExpressions({ silencieux: true });
    }
  });
}

// ---------- Démarrage ----------
function demarrer() {
  document.getElementById("version").textContent = `v${VERSION}`;
  document.getElementById("reglage-url").value = localStorage.getItem(CLES.url) || "";

  // affichage immédiat depuis le cache, puis mise à jour réseau
  etat.expressions = lireJSON(CLES.cache, []);
  rendre();
  brancherEvenements();
  chargerExpressions({ silencieux: etat.expressions.length > 0 });

  // service worker pour le hors-ligne
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch((e) => console.warn("SW non enregistré :", e));
  }
}

demarrer();
