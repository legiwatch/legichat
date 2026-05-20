# Handoff — Interface chat juridique (assistant-ui + MCP Légifrance)

> Brief autonome pour Claude Code. Objectif : un **prototype d'interface clean et fonctionnel**, déployable, branché sur le MCP Légifrance de l'équipe. Lis tout avant de coder.

---

## 1. Contexte projet (condensé)

On construit l'**interface utilisateur** d'un assistant juridique RAG sur le droit français (Code du travail dans un premier temps). Le moteur de recherche/génération (RAG hybride pgvector + full-text + rerank Mistral) vit **entièrement derrière un serveur MCP** maintenu par un autre membre de l'équipe. Ce lot-ci ne contient **aucune logique RAG ni aucun appel LLM côté nous** : on consomme le MCP qui renvoie une réponse déjà rédigée + ses sources.

Le MCP est déjà développé. Son schéma est figé pour ce proto (section 4), mais peut encore évoluer — d'où l'isolation stricte derrière un adaptateur (section 6).

**Périmètre de ce lot :** front de chat + proxy mince. Rien d'autre.

---

## 2. Décisions déjà prises (NE PAS rediscuter)

Ces choix sont arbitrés. Les respecter tels quels.

- **Stack : Next.js** (App Router). Front React + route API serveur dans un seul repo, un seul déploiement (Vercel ou Cloudflare).
- **Backend mince obligatoire.** Le MCP exige un token et consomme du Mistral (coût réel). Le token vit **côté serveur uniquement**, jamais dans le bundle navigateur. La route API proxifie.
- **Lib UI : assistant-ui** (https://www.assistant-ui.com). Composant `Thread`, pattern Provider-Runtime-UI.
- **Affichage épuré :** réponse + sources cliquables sous la réponse (style Perplexity). Pas de vue debug dans le proto.
- **Multi-tours activé** dès maintenant (le MCP supporte `history` nativement).
- **Pas de streaming.** La réponse s'affiche d'un bloc. Pendant l'attente (~40s, voir §7), un **indicateur d'étapes** occupe l'utilisateur. (Le faux streaming a été explicitement écarté du périmètre.)
- **Mock par défaut.** L'adaptateur démarre en mode mock pour développer sans payer Mistral ni subir 40s par itération. Bascule vers le MCP réel par un flag d'environnement.

---

## 3. Architecture en couches

```
┌─────────────────────────────────────────────┐
│  FRONT (navigateur, React/assistant-ui)       │
│  - Thread, rendu réponse + sources            │
│  - indicateur d'étapes pendant l'attente      │
│  - ne connaît NI le MCP NI le token           │
│  - parle uniquement à /api/chat               │
└───────────────────┬───────────────────────────┘
                    │  contrat interne (§5)
┌───────────────────▼───────────────────────────┐
│  PROXY  /api/chat  (Next.js route, serveur)    │
│  - lit le token MCP depuis l'env serveur       │
│  - appelle l'adaptateur                        │
│  - ne "pense" pas : pas d'orchestration LLM    │
└───────────────────┬───────────────────────────┘
                    │
┌───────────────────▼───────────────────────────┐
│  ADAPTATEUR  (1 fichier — pare-feu)            │
│  - SEUL à connaître la forme réelle du MCP     │
│  - 2 impls derrière un flag : mock | mcp       │
│  - déballe le double-emballage MCP             │
│  - mappe schéma MCP → contrat interne          │
│  - reconstruit les liens Légifrance            │
└───────────────────┬───────────────────────────┘
                    │  POST /mcp (token)
┌───────────────────▼───────────────────────────┐
│  MCP Légifrance (équipe — externe à ce lot)    │
└─────────────────────────────────────────────────┘
```

**Règle d'or :** tout ce qui peut changer côté MCP est confiné à l'adaptateur. Le front et le contrat interne ne bougent pas quand le MCP évolue.

---

## 4. Le MCP réel — schéma à consommer

Endpoint : `POST {MCP_BASE_URL}/mcp` (local : `http://localhost:1791/mcp`).

Le MCP expose 6 tools. **On n'en utilise qu'UN pour le proto : `answer_articles_rag`** (réponse finale + sources). Les autres (`search_articles_rag`, `get_article_legi`, etc.) sont hors périmètre mais documentés dans le fichier `mcp-interface-schema.md` fourni séparément — utiles plus tard pour une vue expert.

### ⚠️ Piège n°1 — double-emballage

Toute réponse MCP est encapsulée. Le JSON utile est **sérialisé en string** dans `content[0].text` :

```ts
// la réponse brute du MCP ressemble à :
// { content: [ { type: "text", text: "{...json...}" } ] }
const data = JSON.parse(raw.content[0].text);
// data est alors l'objet réel décrit ci-dessous
```

Toujours parser. C'est la première chose que fait l'adaptateur en mode `mcp`.

### Entrée de `answer_articles_rag`

Entrée minimale recommandée + historique pour le multi-tours :

```json
{
  "query": "quelles sont les règles sur les heures supplémentaires ?",
  "history": [
    { "role": "user", "content": "question précédente" },
    { "role": "assistant", "content": "réponse précédente" }
  ],
  "candidateK": 10,
  "answerTopK": 5
}
```

`query` obligatoire. `history` optionnel (liste user/assistant). Autres champs optionnels avec défauts raisonnables — ne pas les surcharger sauf besoin.

### Sortie de `answer_articles_rag` (après déballage)

Champs qui nous intéressent (la sortie réelle en contient d'autres, ignorés ici) :

```json
{
  "answer": "Les articles fournis permettent ...",
  "answer_support_level": "partial",          // "direct" | "partial" | "insufficient"
  "missing_information": ["taux de majoration non couvert ..."],
  "articles_used": ["L3121-28", "L3121-30"],
  "sources": [
    {
      "article_id": "LEGIARTI000033020373",
      "article_numero": "L3121-28",
      "hierarchie": ["Code du travail", "Partie législative", "..."],
      "preview": "Article L3121-28\nToute heure accomplie...",
      "chunk_text": "Article L3121-28\nToute heure accomplie...",
      "exact_article_match": false
    }
  ],
  "timings": { "total_elapsed_s": 41.65, "retrieval_elapsed_s": 5.51, "rerank_elapsed_s": 29.04 },
  "cost_estimate": { "estimated_total_cost_usd": 0.00185 }
}
```

**Note :** la sortie de `answer_articles_rag` ne contient PAS de `lienLegifrance` dans `sources[]`. On reconstruit le lien depuis `article_id` (§6.3).

---

## 5. Contrat interne (à figer — TypeScript)

C'est l'interface stable entre le front et l'adaptateur. **Indépendante de la forme MCP.** Le front ne connaît que ça.

```ts
// types/contract.ts

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LegalSource {
  articleId: string;          // ex. "LEGIARTI000033020373"
  numero: string;             // ex. "L3121-28"
  hierarchie: string[];       // fil de hiérarchie
  extrait: string;            // preview du chunk
  url: string | null;         // lien Légifrance reconstruit, ou null (fallback)
  exactMatch: boolean;
}

export interface ChatResponse {
  answer: string;                              // markdown
  sources: LegalSource[];
  // mappés mais NON AFFICHÉS dans le proto (réversibilité gratuite) :
  supportLevel: "direct" | "partial" | "insufficient";
  missingInformation: string[];
  // réservé pour une future vue expert (scores, timings) — non utilisé pour l'instant :
  meta?: Record<string, unknown>;
}

// la route POST /api/chat reçoit { messages: ChatMessage[] }
// et renvoie ChatResponse
```

> `supportLevel` et `missingInformation` sont **dans la donnée mais pas rendus à l'écran**. Décision d'UI assumée (épure). Les afficher plus tard = un branchement de composant, pas une retouche d'adaptateur.

---

## 6. L'adaptateur — spécification précise

Un seul fichier, ex. `lib/mcp-adapter.ts`. Expose une fonction stable :

```ts
export async function ask(messages: ChatMessage[]): Promise<ChatResponse>
```

Le mode est choisi par `process.env.MCP_MODE` (`"mock"` | `"mcp"`), défaut `"mock"`.

### 6.1 Mode mock (défaut)

- Renvoie une `ChatResponse` réaliste **calquée sur le schéma réel** (mêmes champs, vraie allure juridique).
- **Conversationnel :** doit gérer 2-3 enchaînements multi-tours scénarisés pour valider l'UX multi-tours. Exemple : une question sur les congés payés, puis une question de suivi "et pour un CDD ?" qui tient compte du contexte. Détecter quelques mots-clés dans le dernier message + l'historique suffit ; pas besoin de vraie IA.
- Au moins un scénario doit renvoyer `supportLevel: "partial"` avec un `missingInformation` non vide (même si non affiché, ça exerce le mapping).
- Sources réelles du Code du travail (ex. L1121-1 sur les libertés dans l'entreprise, L3121-28 sur les heures sup) avec `article_id` réels pour que la reconstruction d'URL soit testable.
- **Délai simulé ~40s configurable** (ex. `MOCK_DELAY_MS`, défaut court genre 1500ms pour le dev, mais permettre de monter à 40000 pour tester l'indicateur d'étapes en conditions réelles). Idéalement, simuler aussi des étapes intermédiaires pour nourrir l'indicateur (§7).

### 6.2 Mode mcp (réel)

1. `POST {MCP_BASE_URL}/mcp` avec le token (header d'auth — confirmer le nom exact du header avec l'équipe MCP ; supposer `Authorization: Bearer {token}` par défaut et le rendre trivial à changer).
2. Corps : appel du tool `answer_articles_rag` avec `{ query, history }` dérivés des `messages` (le dernier message user = `query`, le reste = `history`).
3. **Déballer** : `JSON.parse(raw.content[0].text)`.
4. **Mapper** vers `ChatResponse` (voir mapping ci-dessous).
5. Gérer les erreurs proprement (timeout réseau vu la latence — mettre un timeout généreux, ≥60s ; erreur d'auth ; `content` vide ou non parsable).

**Mapping MCP → contrat :**

| MCP (déballé)              | Contrat interne          |
|----------------------------|--------------------------|
| `answer`                   | `answer`                 |
| `answer_support_level`     | `supportLevel`           |
| `missing_information`      | `missingInformation`     |
| `sources[].article_id`     | `sources[].articleId`    |
| `sources[].article_numero` | `sources[].numero`       |
| `sources[].hierarchie`     | `sources[].hierarchie`   |
| `sources[].preview`        | `sources[].extrait`      |
| `sources[].exact_article_match` | `sources[].exactMatch` |
| (reconstruit, §6.3)        | `sources[].url`          |
| `timings`, `cost_estimate` | `meta` (optionnel)       |

### 6.3 Reconstruction du lien Légifrance

- Construire l'URL publique Légifrance depuis `article_id` (UID type `LEGIARTI000033020373`).
- **À FAIRE EN PREMIER pendant le dev :** confirmer le format d'URL exact. Méthode : faire UN appel jetable au tool `get_article_legi` (`{ uid: "LEGIARTI000033020373" }`) qui, lui, renvoie un `lienLegifrance` tout fait. Observer le motif, puis le coder en dur dans une fonction `legifranceUrl(articleId: string): string | null`.
- **Fallback :** si l'UID ne matche pas le motif attendu, renvoyer `null`. Le front affiche alors numéro + extrait sans lien (ne pas casser l'affichage).

---

## 7. Indicateur d'étapes (gestion des ~40s)

Le MCP répond d'un bloc après ~40s (dont ~29s de rerank dans l'exemple réel). Un écran figé 40s = proto qui paraît cassé. **Obligatoire :** un indicateur d'attente vivant.

- Afficher une séquence d'étapes pendant l'attente, ex. : « Recherche des articles pertinents… » → « Analyse des textes… » → « Rédaction de la réponse… ».
- Ces étapes sont **indicatives** (on n'a pas de vrai flux de progression du MCP en l'état). Les faire défiler sur une minuterie calée sur l'ordre de grandeur des `timings` connus (retrieval court, rerank long, answer court) est suffisant et honnête.
- Pas de fausse barre de progression à pourcentage précis (malhonnête). Une animation d'étapes + spinner suffit.
- En mode mock, faire défiler les mêmes étapes pour que le composant soit testable sans le vrai MCP.

> Le faux streaming du texte est hors périmètre. Si du temps reste en fin de proto, il pourra être ajouté par-dessus l'indicateur d'étapes, mais ce n'est pas demandé.

---

## 8. Variables d'environnement

```bash
# .env.local (NE PAS committer)
MCP_MODE=mock                          # "mock" | "mcp"
MCP_BASE_URL=http://localhost:1791     # base du serveur MCP (sans /mcp)
MCP_TOKEN=                             # token d'accès MCP (mode mcp) — SERVEUR UNIQUEMENT
MOCK_DELAY_MS=1500                     # délai simulé en mode mock
```

Fournir un `.env.example` documenté. `MCP_TOKEN` ne doit JAMAIS être préfixé `NEXT_PUBLIC_` ni atteindre le client.

---

## 9. Structure de fichiers attendue (indicative)

```
.
├── app/
│   ├── api/chat/route.ts        # proxy : reçoit {messages}, appelle ask(), renvoie ChatResponse
│   ├── layout.tsx               # AssistantRuntimeProvider à la racine
│   └── page.tsx                 # le Thread + rendu sources
├── components/
│   ├── SourcesList.tsx          # sources cliquables sous la réponse (style Perplexity)
│   └── LoadingSteps.tsx         # indicateur d'étapes (§7)
├── lib/
│   └── mcp-adapter.ts           # LE pare-feu (§6) — mock + mcp
├── types/
│   └── contract.ts              # contrat interne (§5)
├── .env.example
└── HANDOFF.md
```

---

## 10. Décisions laissées à Claude Code (souplesse)

Sur ces points, utilise les **bonnes pratiques assistant-ui à jour** — tu es mieux placé que ce brief pour les détails idiomatiques. Recommandé : installer le MCP de doc assistant-ui (`npx assistant-ui mcp`) pour avoir la doc et les patterns à jour pendant le dev.

- Choix exact du runtime assistant-ui (AI SDK, external store, custom) pour brancher `/api/chat`. Le contrat interne (§5) doit être respecté ; la façon de le câbler au runtime est libre.
- Composition fine des composants (`Thread`, `Composer`, etc.) et primitives.
- Rendu markdown de `answer`.
- Style/Tailwind, mise en page des sources, design de l'indicateur d'étapes — viser **clean et sobre** (outil juridique pro), pas de fioritures.
- Gestion d'état multi-tours côté front (l'historique est passé au contrat ; comment le runtime le tient est libre).

---

## 11. Checklist de bascule mock → MCP réel

Quand le MCP réel est accessible :

- [ ] Renseigner `MCP_BASE_URL` et `MCP_TOKEN` réels dans `.env.local`.
- [ ] Confirmer le **nom du header d'auth** avec l'équipe MCP (Bearer ? autre ?).
- [ ] Faire l'appel jetable `get_article_legi` pour **figer le motif d'URL Légifrance** (§6.3).
- [ ] Vérifier le **déballage** `content[0].text` sur une vraie réponse.
- [ ] Vérifier que `history` est bien accepté et exploité (multi-tours réel).
- [ ] Passer `MCP_MODE=mcp`.
- [ ] Régler le **timeout** réseau (≥60s) pour absorber les ~40s.
- [ ] Vérifier que le token n'apparaît nulle part côté client (inspecter le bundle).
- [ ] Tester un scénario `partial`/`insufficient` réel (mapping OK même si non affiché).

---

## 12. Critère de "fini" pour le proto

- L'app tourne en local en mode mock, multi-tours fonctionnel, sources cliquables sous la réponse, indicateur d'étapes pendant l'attente.
- Bascule vers le MCP réel = changer des variables d'env + cocher la checklist §11, **sans toucher au front**.
- Déployable sur Vercel/Cloudflare.
- Code propre, contrat interne respecté, adaptateur seul point de contact avec le MCP.
```
