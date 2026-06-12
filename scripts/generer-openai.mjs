#!/usr/bin/env node
/* ============================================================
   Génère 4 nouvelles expressions de français courant via l'API
   OpenAI et les ajoute au début de expressions.json.

   Utilisation :
     OPENAI_API_KEY=sk-... node scripts/generer-openai.mjs
     OPENAI_API_KEY=sk-... node scripts/generer-openai.mjs --n 4

   Variables d'environnement :
     OPENAI_API_KEY  (obligatoire)  ta clé API OpenAI
     OPENAI_MODEL    (optionnel)    modèle, défaut « gpt-4o »

   Comportement : dédoublonnage par id contre l'existant, date du
   jour ajoutée, JSON final valide en UTF-8. Aucune dépendance npm.
   ============================================================ */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const FICHIER = join(RACINE, "expressions.json");

const CLE = process.env.OPENAI_API_KEY;
const MODELE = process.env.OPENAI_MODEL || "gpt-5.4";

if (!CLE) {
  console.error("Erreur : la variable OPENAI_API_KEY n'est pas définie.");
  process.exit(1);
}

function genererId(expr) {
  return expr
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function aujourdhui() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function lireArgs() {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const cle = args[i].slice(2);
      const valeur = args[i + 1] && !args[i + 1].startsWith("--") ? args[++i] : "true";
      options[cle] = valeur;
    }
  }
  return options;
}

const REGISTRES = new Set(["entre potes", "courant", "boulot"]);

function construirePrompt(existantes, n) {
  const liste = existantes.map((e) => `- ${e.expr}`).join("\n");
  return `Tu es un expert du français parlé en France en 2026. Génère exactement ${n} nouvelles expressions de français courant et AUTHENTIQUE, telles qu'on les entend aujourd'hui en France entre amis, en soirée, en afterwork, au travail.

Critères stricts :
- registre amical/décontracté, réellement utilisé par des adultes en 2026 ;
- jamais d'expressions datées ou ringardes (pas de « ça baigne », « c'est chouette ») ;
- pas de vulgarité gratuite (les expressions familières courantes sont OK, l'insulte ou le cru inutile non) ;
- varie les usages : réactions, plans/sorties, boulot, états d'âme, bouffe, etc. ;
- varie les registres entre « entre potes », « courant » et « boulot ».

Expressions DÉJÀ présentes, à NE PAS reproduire (ni leurs variantes proches) :
${liste}

Réponds UNIQUEMENT avec un objet JSON de cette forme exacte :
{
  "expressions": [
    {
      "expr": "l'expression exacte",
      "sens": "explication claire et concise en français simple",
      "exemple": "un mini-dialogue ou une phrase réaliste et naturelle, avec des guillemets « »",
      "registre": "entre potes"
    }
  ]
}
Le champ "registre" vaut obligatoirement "entre potes", "courant" ou "boulot". Donne exactement ${n} expressions.`;
}

async function appelerOpenAI(prompt, { avecTemperature = true } = {}) {
  const corps = {
    model: MODELE,
    messages: [
      { role: "system", content: "Tu réponds toujours en JSON valide, en français." },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
  };
  if (avecTemperature) corps.temperature = 0.9;

  const reponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CLE}`,
    },
    body: JSON.stringify(corps),
  });

  if (!reponse.ok) {
    const texte = await reponse.text();
    // Certains modèles récents n'acceptent que la température par défaut : on réessaie sans.
    if (reponse.status === 400 && avecTemperature && /temperature/i.test(texte)) {
      return appelerOpenAI(prompt, { avecTemperature: false });
    }
    throw new Error(`API OpenAI ${reponse.status} : ${texte}`);
  }

  const data = await reponse.json();
  const contenu = data.choices?.[0]?.message?.content;
  if (!contenu) throw new Error("Réponse OpenAI vide ou inattendue.");
  const parse = JSON.parse(contenu);
  const liste = Array.isArray(parse) ? parse : parse.expressions;
  if (!Array.isArray(liste)) throw new Error("Le JSON renvoyé ne contient pas de tableau « expressions ».");
  return liste;
}

function valide(e) {
  return (
    e &&
    typeof e.expr === "string" && e.expr.trim() &&
    typeof e.sens === "string" && e.sens.trim() &&
    typeof e.exemple === "string" && e.exemple.trim() &&
    typeof e.registre === "string" && REGISTRES.has(e.registre.trim())
  );
}

const options = lireArgs();
const n = Math.max(1, parseInt(options.n, 10) || 4);
const existantes = JSON.parse(readFileSync(FICHIER, "utf-8"));
const idsExistants = new Set(existantes.map((e) => e.id || genererId(e.expr)));

const retenues = [];
let tentatives = 0;

while (retenues.length < n && tentatives < 3) {
  tentatives++;
  const manquantes = n - retenues.length;
  const brutes = await appelerOpenAI(construirePrompt(existantes, manquantes + 2));
  for (const e of brutes) {
    if (retenues.length >= n) break;
    if (!valide(e)) continue;
    const id = genererId(e.expr);
    if (idsExistants.has(id)) continue;
    idsExistants.add(id);
    retenues.push({
      expr: e.expr.trim(),
      sens: e.sens.trim(),
      exemple: e.exemple.trim(),
      registre: e.registre.trim(),
    });
  }
}

if (!retenues.length) {
  console.error("Aucune expression nouvelle et valide n'a pu être générée.");
  process.exit(1);
}

const date = aujourdhui();
const nouvelles = retenues.map((e) => ({ ...e, date }));
writeFileSync(FICHIER, JSON.stringify([...nouvelles, ...existantes], null, 2) + "\n", "utf-8");

for (const e of nouvelles) console.log(`+ ${e.expr}`);
console.log(`${nouvelles.length} expression(s) ajoutée(s) à expressions.json (${date}).`);
