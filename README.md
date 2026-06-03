# LegiChat — Interface de chat juridique

Interface utilisateur d'un assistant juridique RAG sur le droit du travail français.  
Ce dépôt contient **uniquement le frontend statique** (Vite + React). L'API est gérée dans un dépôt séparé.

---

## Stack

- **Vite + React 19** — front statique, déploiement CDN
- **assistant-ui** — composants de chat (Primitives API)
- **Tailwind CSS** — styles
- **TypeScript**

---

## Démarrage rapide

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Configurer `VITE_API_URL` dans `.env.local` pour pointer vers le serveur API.

---

## Build production

```bash
pnpm build    # → dist/
pnpm preview  # prévisualisation locale
```

Configurer `VITE_API_URL` dans `.env.local` pour pointer vers le serveur API.

---

## Variables d'environnement

| Variable | Défaut | Description |
|---|---|---|
| `VITE_API_URL` | `/api/chat` | URL du serveur API LegiChat (proxy MCP) |

---

## Build production

```bash
npm run build     # → dist/
npm run preview   # prévisualisation locale
```

Le dossier `dist/` est statique et déployable sur **Cloudflare Pages**, **Netlify**, ou tout CDN.

---

## Architecture

```
┌──────────────────────────────────────┐
│  FRONT (Vite, statique)              │
│  → src/App.tsx + components/         │
│  → ne connaît ni le MCP ni le token  │
└──────────────┬───────────────────────┘
               │  POST /api/chat (SSE)
┌──────────────▼───────────────────────┐
│  API (dépôt séparé — legichat-api)   │
│  → proxy MCP avec token serveur      │
└──────────────┬───────────────────────┘
               │  POST /mcp (Bearer)
┌──────────────▼───────────────────────┐
│  MCP Légifrance (externe)            │
│  tool : answer_articles_rag          │
└──────────────────────────────────────┘
```