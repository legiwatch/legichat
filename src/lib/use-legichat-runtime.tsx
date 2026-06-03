import { useExternalStoreRuntime } from "@assistant-ui/react";
import type { AppendMessage, ThreadMessageLike } from "@assistant-ui/react";
import { useState, useCallback } from "react";
import type { ChatMessage, ChatResponse, LegalSource } from "@/types/contract";

const API_URL = import.meta.env.VITE_API_URL || "/api/chat";

const TOTAL_STEPS = 3;

export interface LegalCustomMeta {
  sources?: LegalSource[];
  stepLabel?: string;
  stepIndex?: number;
  isLoading?: boolean;
}

// assistant-ui stores custom data in metadata.custom
type LegalMessage = ThreadMessageLike & {
  id: string;
  metadata?: {
    custom?: LegalCustomMeta;
  };
};

export function useLegichatRuntime() {
  const [messages, setMessages] = useState<LegalMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const onNew = useCallback(async (message: AppendMessage) => {
    const userText =
      message.content.find((c): c is Extract<typeof c, { type: "text" }> => c.type === "text")?.text ?? "";

    const userMsg: LegalMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: [{ type: "text", text: userText }],
    };

    const assistantId = crypto.randomUUID();
    const loadingMsg: LegalMessage = {
      id: assistantId,
      role: "assistant",
      content: [{ type: "text", text: "" }],
      metadata: {
        custom: {
          isLoading: true,
          stepLabel: "Recherche des articles pertinents…",
          stepIndex: 0,
        },
      },
    };

    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setIsRunning(true);

    // Build the full history to send (includes new user message)
    const history: ChatMessage[] = [...messages, userMsg].map((m) => ({
      role: m.role as "user" | "assistant",
      content:
        typeof m.content === "string"
          ? m.content
          : (m.content as Array<{ type: string; text?: string }>).find((c) => c.type === "text")?.text ?? "",
    }));

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const chunk of lines) {
          if (!chunk.startsWith("data: ")) continue;
          let event: { type: string; label?: string; data?: ChatResponse; message?: string };
          try {
            event = JSON.parse(chunk.slice(6));
          } catch {
            continue;
          }

          if (event.type === "step") {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantId) return m;
                const prevIdx = m.metadata?.custom?.stepIndex ?? 0;
                return {
                  ...m,
                  metadata: {
                    custom: {
                      ...m.metadata?.custom,
                      stepLabel: event.label,
                      stepIndex: Math.min(prevIdx + 1, TOTAL_STEPS - 1),
                    },
                  },
                };
              })
            );
          } else if (event.type === "response" && event.data) {
            const resp = event.data;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: [{ type: "text", text: resp.answer }],
                      metadata: {
                        custom: { isLoading: false, sources: resp.sources },
                      },
                    }
                  : m
              )
            );
          } else if (event.type === "error") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: [
                        { type: "text", text: `Une erreur est survenue : ${event.message}` },
                      ],
                      metadata: { custom: { isLoading: false } },
                    }
                  : m
              )
            );
          }
        }
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: [{ type: "text", text: "La connexion a été interrompue. Réessayez." }],
                metadata: { custom: { isLoading: false } },
              }
            : m
        )
      );
    } finally {
      setIsRunning(false);
    }
  }, [messages]);

  return useExternalStoreRuntime<LegalMessage>({
    messages,
    isRunning,
    onNew,
    convertMessage: (m) => m,
  });
}

export { TOTAL_STEPS };
