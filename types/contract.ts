export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LegalSource {
  articleId: string;
  numero: string;
  hierarchie: string[];
  extrait: string;
  url: string | null;
  exactMatch: boolean;
}

export interface ChatResponse {
  answer: string;
  sources: LegalSource[];
  supportLevel: "direct" | "partial" | "insufficient";
  missingInformation: string[];
  meta?: Record<string, unknown>;
}
