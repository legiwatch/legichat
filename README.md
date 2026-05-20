# LegiChat — Interface de chat juridique

Interface utilisateur d'un assistant juridique RAG sur le droit du travail français. Le moteur de recherche et de génération (RAG hybride pgvector + Mistral) vit derrière un serveur MCP maintenu séparément ; ce dépôt ne contient que le front de chat et un proxy mince.

---

## Stack

- **Next.js 16** (App Router) — front React + route API dans un seul déploiement
- **assistant-ui** — composants de chat (Primitives API)
- **Tailwind CSS** — styles
- **MCP Légifrance** — backend RAG externe (consommé via l'adaptateur)

---

## Démarrage rapide

```bash
# 1. Installer les dépendances
npm install

# 2. Copier et configurer les variables d'environnement
cp .env.example .env.local

# 3. Lancer le serveur de développement
npm run dev
```

L'app est disponible sur **http://localhost:3000**.

Par défaut, l'adaptateur démarre en **mode mock** : les réponses sont simulées, aucun appel réseau ni coût Mistral.

---

## Variables d'environnement

| Variable | Valeur par défaut | Description |
|---|---|---|
| `MCP_MODE` | `mock` | `mock` pour le dev, `mcp` pour le MCP réel |
| `MCP_BASE_URL` | `http://localhost:1791` | URL de base du serveur MCP (sans `/mcp`) |
| `MCP_TOKEN` | *(vide)* | Token d'accès MCP — **serveur uniquement**, jamais `NEXT_PUBLIC_` |
| `MOCK_DELAY_MS` | `1500` | Délai simulé en mode mock (ms). Mettre `40000` pour tester l'indicateur d'étapes en conditions réelles |

> `.env.local` n'est jamais committé (voir `.gitignore`).

---

## Architecture

```
┌──────────────────────────────────────────┐
│  FRONT  app/page.tsx                      │
│  ThreadPrimitive + ComposerPrimitive      │
│  → ne connaît ni le MCP ni le token      │
└───────────────┬──────────────────────────┘
                │  POST /api/chat  { messages }
┌───────────────▼──────────────────────────┐
│  PROXY  app/api/chat/route.ts            │
│  SSE : émet des events step + response   │
│  → lit le token depuis l'env serveur     │
└───────────────┬──────────────────────────┘
                │
┌───────────────▼──────────────────────────┐
│  ADAPTATEUR  lib/mcp-adapter.ts          │
│  Seul fichier à connaître la forme MCP   │
│  2 implémentations : mock | mcp          │
│  → déballe content[0].text              │
│  → mappe schéma MCP → contrat interne   │
│  → reconstruit les liens Légifrance     │
└───────────────┬──────────────────────────┘
                │  POST /mcp  (Bearer token)
┌───────────────▼──────────────────────────┐
│  MCP Légifrance  (dépôt séparé)          │
│  tool : answer_articles_rag              │
└──────────────────────────────────────────┘
```

**Règle d'or :** tout ce qui peut changer côté MCP est confiné dans `lib/mcp-adapter.ts`. Le front et le contrat interne ne bougent pas quand le MCP évolue.

---

## Structure des fichiers

```
.
├── app/
│   ├── api/chat/route.ts   # Proxy SSE : reçoit {messages}, appelle ask(), streame les étapes
│   ├── layout.tsx
│   └── page.tsx            # Thread complet avec indicateur d'étapes et sources
├── components/
│   ├── LoadingSteps.tsx    # Indicateur d'étapes animé pendant les ~40s d'attente
│   └── SourcesList.tsx     # Sources cliquables sous la réponse (style Perplexity)
├── lib/
│   ├── mcp-adapter.ts      # Adaptateur pare-feu — mock + mcp réel
│   └── use-legichat-runtime.tsx  # Hook useExternalStoreRuntime pour assistant-ui
├── types/
│   └── contract.ts         # Contrat interne (indépendant du schéma MCP)
└── .env.example
```

---

## Contrat interne (`types/contract.ts`)

Interface stable entre le front et l'adaptateur. Le front ne connaît que ça — jamais la forme brute du MCP.

```ts
interface ChatResponse {
  answer: string;                 // markdown
  sources: LegalSource[];
  supportLevel: "direct" | "partial" | "insufficient";
  missingInformation: string[];
  meta?: Record<string, unknown>;
}

interface LegalSource {
  articleId: string;   // ex. "LEGIARTI000033020373"
  numero: string;      // ex. "L3121-28"
  hierarchie: string[];
  extrait: string;
  url: string | null;  // lien Légifrance reconstruit, ou null
  exactMatch: boolean;
}
```

---

## Basculer sur le MCP réel

1. Renseigner `.env.local` :
   ```bash
   MCP_MODE=mcp
   MCP_BASE_URL=http://localhost:1791
   MCP_TOKEN=<votre-token>
   ```
2. Confirmer le nom du header d'auth avec l'équipe MCP (défaut : `Authorization: Bearer`). Si différent, modifier la ligne correspondante dans `lib/mcp-adapter.ts` (fonction `mcpAsk`).
3. Faire un appel jetable au tool `get_article_legi` pour vérifier le motif d'URL Légifrance et mettre à jour `legifranceUrl()` si nécessaire.
4. Vérifier que le token n'apparaît nulle part dans le bundle client (`next build` puis inspecter `.next/static`).

---

## Déploiement

L'app est prête pour **Vercel** ou **Cloudflare Pages** sans configuration supplémentaire.

```bash
npm run build   # build de production
npm run start   # serveur de production en local
```

Sur Vercel : ajouter les variables `MCP_MODE`, `MCP_BASE_URL` et `MCP_TOKEN` dans les *Environment Variables* du projet (section *Settings → Environment Variables*). `MCP_TOKEN` reste côté serveur uniquement.
