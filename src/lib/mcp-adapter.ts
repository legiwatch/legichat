import type { ChatMessage, ChatResponse, LegalSource } from "@/types/contract";

// Reconstruct a legifrance.gouv.fr URL from an article UID
function legifranceUrl(articleId: string): string | null {
  if (/^LEGIARTI\d+$/.test(articleId)) {
    return `https://www.legifrance.gouv.fr/codes/article_lc/${articleId}`;
  }
  return null;
}

// ─── MOCK DATA ───────────────────────────────────────────────────────────────

const MOCK_SOURCES_HEURES_SUP: LegalSource[] = [
  {
    articleId: "LEGIARTI000033020373",
    numero: "L3121-28",
    hierarchie: ["Code du travail", "Partie législative", "Livre Ier : Durée du travail", "Titre II : Durée du travail, répartition et aménagement des horaires", "Chapitre Ier : Durée légale et heures supplémentaires"],
    extrait: "Article L3121-28\nToute heure accomplie au-delà de la durée légale hebdomadaire ou de la durée considérée comme équivalente est une heure supplémentaire qui ouvre droit à une majoration salariale ou, le cas échéant, à un repos compensateur équivalent.",
    url: legifranceUrl("LEGIARTI000033020373"),
    exactMatch: true,
  },
  {
    articleId: "LEGIARTI000033020369",
    numero: "L3121-27",
    hierarchie: ["Code du travail", "Partie législative", "Livre Ier : Durée du travail", "Titre II : Durée du travail, répartition et aménagement des horaires", "Chapitre Ier : Durée légale et heures supplémentaires"],
    extrait: "Article L3121-27\nLa durée légale de travail effectif des salariés à temps complet est fixée à trente-cinq heures par semaine.",
    url: legifranceUrl("LEGIARTI000033020369"),
    exactMatch: true,
  },
  {
    articleId: "LEGIARTI000033020393",
    numero: "L3121-33",
    hierarchie: ["Code du travail", "Partie législative", "Livre Ier : Durée du travail", "Titre II : Durée du travail, répartition et aménagement des horaires", "Chapitre Ier : Durée légale et heures supplémentaires"],
    extrait: "Article L3121-33\nUne convention ou un accord collectif d'entreprise ou d'établissement ou, à défaut, une convention ou un accord de branche peut prévoir le remplacement de tout ou partie du paiement des heures supplémentaires par un repos compensateur équivalent.",
    url: legifranceUrl("LEGIARTI000033020393"),
    exactMatch: false,
  },
];

const MOCK_SOURCES_CONGES: LegalSource[] = [
  {
    articleId: "LEGIARTI000033020552",
    numero: "L3141-1",
    hierarchie: ["Code du travail", "Partie législative", "Livre IV : Congés payés et autres congés", "Titre IV : Congés payés", "Chapitre Ier : Droit au congé"],
    extrait: "Article L3141-1\nTout salarié a droit chaque année à un congé payé à la charge de l'employeur. Le droit au congé est ouvert au salarié qui, au cours de l'année de référence, justifie avoir travaillé chez le même employeur pendant un temps équivalent à un minimum d'un mois de travail effectif.",
    url: legifranceUrl("LEGIARTI000033020552"),
    exactMatch: true,
  },
  {
    articleId: "LEGIARTI000033020556",
    numero: "L3141-3",
    hierarchie: ["Code du travail", "Partie législative", "Livre IV : Congés payés et autres congés", "Titre IV : Congés payés", "Chapitre Ier : Droit au congé"],
    extrait: "Article L3141-3\nLe salarié a droit à un congé de deux jours et demi ouvrables par mois de travail effectif chez le même employeur. La durée totale du congé exigible ne peut excéder trente jours ouvrables.",
    url: legifranceUrl("LEGIARTI000033020556"),
    exactMatch: true,
  },
];

const MOCK_SOURCES_CDD: LegalSource[] = [
  {
    articleId: "LEGIARTI000035643954",
    numero: "L1242-1",
    hierarchie: ["Code du travail", "Partie législative", "Livre II : Le contrat de travail à durée déterminée", "Titre IV : Contrat de travail à durée déterminée", "Chapitre II : Recours au contrat de travail à durée déterminée"],
    extrait: "Article L1242-1\nUn contrat de travail à durée déterminée, quel que soit son motif, ne peut avoir ni pour objet ni pour effet de pourvoir durablement un emploi lié à l'activité normale et permanente de l'entreprise.",
    url: legifranceUrl("LEGIARTI000035643954"),
    exactMatch: false,
  },
  {
    articleId: "LEGIARTI000033020552",
    numero: "L3141-1",
    hierarchie: ["Code du travail", "Partie législative", "Livre IV : Congés payés et autres congés", "Titre IV : Congés payés", "Chapitre Ier : Droit au congé"],
    extrait: "Article L3141-1\nTout salarié a droit chaque année à un congé payé à la charge de l'employeur, y compris les salariés en CDD.",
    url: legifranceUrl("LEGIARTI000033020552"),
    exactMatch: true,
  },
];

// Detect the topic of the last user message + history
function detectTopic(messages: ChatMessage[]): "heures_sup" | "conges" | "cdd_conges" | "default" {
  const lastUser = messages.filter((m) => m.role === "user").pop();
  const text = (lastUser?.content ?? "").toLowerCase();
  const historyText = messages.map((m) => m.content).join(" ").toLowerCase();

  const hasCDDContext = historyText.includes("cdd") || text.includes("cdd") || text.includes("durée déterminée");
  const hasCongesContext = historyText.includes("congé") || historyText.includes("conge") || text.includes("congé") || text.includes("conge") || text.includes("vacances");

  if (hasCDDContext && hasCongesContext) return "cdd_conges";
  if (hasCongesContext) return "conges";
  if (text.includes("heure") || text.includes("supplémentaire") || text.includes("supplementaire") || text.includes("35h") || text.includes("durée légale")) {
    return "heures_sup";
  }
  return "default";
}

// Simulate intermediate steps with a delay
export type StepCallback = (step: string) => void;

const MOCK_STEPS = [
  { label: "Recherche des articles pertinents…", delay: 0 },
  { label: "Analyse et classement des textes…", delay: 0.15 },
  { label: "Rédaction de la réponse juridique…", delay: 0.65 },
];

async function mockAsk(messages: ChatMessage[], onStep?: StepCallback): Promise<ChatResponse> {
  const delayMs = parseInt(process.env.MOCK_DELAY_MS ?? "1500", 10);
  const topic = detectTopic(messages);

  for (const step of MOCK_STEPS) {
    await new Promise((r) => setTimeout(r, step.delay * delayMs));
    onStep?.(step.label);
  }

  await new Promise((r) => setTimeout(r, 0.2 * delayMs));

  if (topic === "heures_sup") {
    return {
      answer: `## Règles sur les heures supplémentaires

Toute heure accomplie **au-delà de 35 heures par semaine** est considérée comme une heure supplémentaire (art. L3121-28 du Code du travail).

### Majorations
Le taux de majoration est défini par accord d'entreprise ou de branche. À défaut d'accord, les heures supplémentaires sont majorées de :
- **25 %** pour les 8 premières heures supplémentaires (36e à 43e heure)
- **50 %** au-delà

### Repos compensateur
Une convention collective peut prévoir le **remplacement du paiement** des heures supplémentaires par un repos compensateur équivalent (art. L3121-33).

### Contingent annuel
Un contingent annuel d'heures supplémentaires est fixé par accord collectif ou, à défaut, par décret à **220 heures par an**.`,
      sources: MOCK_SOURCES_HEURES_SUP,
      supportLevel: "partial",
      missingInformation: [
        "Le taux exact de majoration conventionnel applicable à votre secteur n'est pas couvert par ces articles.",
        "Les modalités spécifiques aux forfaits jours ne sont pas abordées ici.",
      ],
      meta: { timings: { total_elapsed_s: 1.5 }, cost_estimate: { estimated_total_cost_usd: 0.001 } },
    };
  }

  if (topic === "conges") {
    return {
      answer: `## Droits aux congés payés

Tout salarié acquiert **2,5 jours ouvrables de congé par mois** de travail effectif, soit **30 jours ouvrables par an** (5 semaines) — art. L3141-3 du Code du travail.

### Période d'acquisition
Les congés s'acquièrent sur la **période de référence**, généralement du 1er juin au 31 mai de l'année suivante (sauf accord collectif fixant une autre période).

### Prise des congés
- Le salarié doit prendre au minimum **12 jours ouvrables consécutifs** pendant la période légale (1er mai – 31 octobre).
- Le solde peut être pris en dehors de cette période selon les règles de l'entreprise.

### Indemnité de congés payés
Elle est calculée selon le mode le plus favorable entre :
- **1/10e de la rémunération annuelle brute** perçue durant la période de référence
- Le maintien du salaire habituel`,
      sources: MOCK_SOURCES_CONGES,
      supportLevel: "direct",
      missingInformation: [],
      meta: { timings: { total_elapsed_s: 1.5 } },
    };
  }

  if (topic === "cdd_conges") {
    return {
      answer: `## Congés payés pour les salariés en CDD

Les salariés en **contrat à durée déterminée (CDD)** bénéficient des mêmes droits aux congés payés que les salariés en CDI : **2,5 jours ouvrables par mois** de travail effectif.

### Indemnité compensatrice de congés payés
En pratique, à la fin d'un CDD, si le salarié n'a pas pu prendre tous ses congés, l'employeur doit verser une **indemnité compensatrice de congés payés**, égale à 10 % de la rémunération brute totale perçue pendant le contrat.

Cette indemnité est due même si le contrat a été rompu avant son terme ou si le salarié a été embauché en CDI par la suite (sous certaines conditions).

### Calcul
> Indemnité = Rémunération brute totale du CDD × 10 %`,
      sources: MOCK_SOURCES_CDD,
      supportLevel: "direct",
      missingInformation: [],
      meta: { timings: { total_elapsed_s: 1.5 } },
    };
  }

  // Default response
  return {
    answer: `## Assistant juridique LegiChat

Je suis votre assistant juridique spécialisé dans le **droit du travail français**. Je peux vous aider sur des sujets tels que :

- **Durée du travail** : heures supplémentaires, temps partiel, forfaits
- **Congés payés** : acquisition, prise, indemnisation
- **Contrats de travail** : CDI, CDD, ruptures conventionnelles
- **Rémunération** : salaire minimum, primes, avantages
- **Représentation du personnel** : CSE, syndicats, négociation collective

Posez-moi votre question pour obtenir une réponse fondée sur les textes du Code du travail.`,
    sources: [
      {
        articleId: "LEGIARTI000006900846",
        numero: "L1121-1",
        hierarchie: ["Code du travail", "Partie législative", "Livre Ier : Les relations individuelles de travail", "Titre II : Formation et exécution du contrat de travail", "Chapitre Ier : Libertés et droits des salariés dans l'entreprise"],
        extrait: "Article L1121-1\nNul ne peut apporter aux droits des personnes et aux libertés individuelles et collectives de restrictions qui ne seraient pas justifiées par la nature de la tâche à accomplir ni proportionnées au but recherché.",
        url: legifranceUrl("LEGIARTI000006900846"),
        exactMatch: false,
      },
    ],
    supportLevel: "insufficient",
    missingInformation: ["Aucune question précise détectée."],
    meta: {},
  };
}

// ─── MCP REAL MODE ────────────────────────────────────────────────────────────

interface McpRawResponse {
  content: Array<{ type: string; text: string }>;
}

interface McpArticleSource {
  article_id: string;
  article_numero: string;
  hierarchie: string[];
  preview: string;
  chunk_text?: string;
  exact_article_match: boolean;
}

interface McpAnswerResult {
  answer: string;
  answer_support_level: "direct" | "partial" | "insufficient";
  missing_information: string[];
  articles_used: string[];
  sources: McpArticleSource[];
  timings?: Record<string, unknown>;
  cost_estimate?: Record<string, unknown>;
}

async function mcpAsk(messages: ChatMessage[]): Promise<ChatResponse> {
  const baseUrl = process.env.MCP_BASE_URL ?? "http://localhost:1791";
  const token = process.env.MCP_TOKEN ?? "";

  const userMessages = messages.filter((m) => m.role === "user");
  const query = userMessages[userMessages.length - 1]?.content ?? "";
  const history = messages.slice(0, -1).map((m) => ({ role: m.role, content: m.content }));

  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "answer_articles_rag",
      arguments: {
        query,
        history: history.length > 0 ? history : undefined,
        candidateK: 10,
        answerTopK: 5,
      },
    },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 70_000);

  let raw: McpRawResponse;
  try {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`MCP HTTP ${res.status}: ${await res.text()}`);
    }
    raw = await res.json();
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }

  if (!raw.content?.[0]?.text) {
    throw new Error("MCP response missing content[0].text");
  }

  const data: McpAnswerResult = JSON.parse(raw.content[0].text);

  const sources: LegalSource[] = (data.sources ?? []).map((s) => ({
    articleId: s.article_id,
    numero: s.article_numero,
    hierarchie: s.hierarchie ?? [],
    extrait: s.preview ?? s.chunk_text ?? "",
    url: legifranceUrl(s.article_id),
    exactMatch: s.exact_article_match ?? false,
  }));

  return {
    answer: data.answer,
    sources,
    supportLevel: data.answer_support_level,
    missingInformation: data.missing_information ?? [],
    meta: {
      timings: data.timings,
      cost_estimate: data.cost_estimate,
    },
  };
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

export async function ask(messages: ChatMessage[], onStep?: StepCallback): Promise<ChatResponse> {
  const mode = process.env.MCP_MODE ?? "mock";
  if (mode === "mcp") {
    return mcpAsk(messages);
  }
  return mockAsk(messages, onStep);
}

export { MOCK_STEPS };
