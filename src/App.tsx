import {
  AssistantRuntimeProvider,
  ThreadPrimitive,
  MessagePrimitive,
  ComposerPrimitive,
  useMessage,
} from "@assistant-ui/react";
import { useLegichatRuntime, TOTAL_STEPS } from "@/lib/use-legichat-runtime";
import type { LegalCustomMeta } from "@/lib/use-legichat-runtime";
import SourcesList from "@/components/SourcesList";
import LoadingSteps from "@/components/LoadingSteps";
import ReactMarkdown from "react-markdown";

// ─── Message Components ───────────────────────────────────────────────────────

function UserMessage() {
  return (
    <MessagePrimitive.Root className="flex justify-end px-4 py-2">
      <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-blue-600 px-4 py-2.5 text-sm text-white">
        <MessagePrimitive.Parts components={{ Text: ({ text }) => <span>{text}</span> }} />
      </div>
    </MessagePrimitive.Root>
  );
}

function AssistantMessageText() {
  const custom = useMessage((s) => s.metadata?.custom) as LegalCustomMeta | undefined;
  const content = useMessage((s) => s.content);
  const text = content.find((c) => c.type === "text")?.text ?? "";

  if (custom?.isLoading) {
    return (
      <LoadingSteps
        currentStep={custom.stepLabel ?? "Recherche des articles pertinents…"}
        stepIndex={custom.stepIndex ?? 0}
        totalSteps={TOTAL_STEPS}
      />
    );
  }

  return (
    <div>
      <div className="prose max-w-none">
        <ReactMarkdown>{text}</ReactMarkdown>
      </div>
      {custom?.sources && custom.sources.length > 0 && (
        <SourcesList sources={custom.sources} />
      )}
    </div>
  );
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="flex justify-start px-4 py-2">
      <div className="flex gap-3 max-w-[90%]">
        <div className="flex-shrink-0 mt-0.5 flex items-center justify-center w-7 h-7 rounded-full bg-slate-200 text-slate-600 text-xs font-bold">
          L
        </div>
        <div className="flex-1 rounded-2xl rounded-tl-sm bg-white border border-slate-200 px-4 py-3 text-sm text-slate-800 shadow-sm">
          <AssistantMessageText />
        </div>
      </div>
    </MessagePrimitive.Root>
  );
}

// ─── Suggestions ─────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  "Quelles sont les règles sur les heures supplémentaires ?",
  "Combien de jours de congés payés ai-je droit par an ?",
  "Quels sont les droits aux congés payés pour un salarié en CDD ?",
];

function WelcomeScreen() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center gap-6">
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-600 text-white font-bold text-lg shadow-sm">
          L
        </div>
        <h2 className="text-lg font-semibold text-slate-800">LegiChat</h2>
        <p className="text-sm text-slate-500 max-w-md">
          Assistant juridique spécialisé dans le droit du travail français. Posez vos questions sur les contrats, congés, heures supplémentaires et plus.
        </p>
      </div>
      <div className="flex flex-col gap-2 w-full max-w-md">
        {SUGGESTIONS.map((s) => (
          <ThreadPrimitive.Suggestion
            key={s}
            prompt={s}
            method="replace"
            autoSend
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 text-left hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer shadow-sm"
          >
            {s}
          </ThreadPrimitive.Suggestion>
        ))}
      </div>
    </div>
  );
}

// ─── Composer ────────────────────────────────────────────────────────────────

function Composer() {
  return (
    <div className="border-t border-slate-200 bg-white px-4 py-3">
      <ComposerPrimitive.Root className="flex items-end gap-2 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 focus-within:border-blue-400 focus-within:bg-white transition-colors">
        <ComposerPrimitive.Input
          className="flex-1 resize-none bg-transparent text-sm text-slate-800 placeholder:text-slate-400 outline-none min-h-[1.5rem] max-h-32"
          placeholder="Posez votre question juridique…"
          autoFocus
          rows={1}
        />
        <ComposerPrimitive.Send className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          <SendIcon />
        </ComposerPrimitive.Send>
      </ComposerPrimitive.Root>
      <p className="mt-1.5 text-center text-xs text-slate-400">
        Les réponses sont basées sur les textes officiels du Code du travail.
      </p>
    </div>
  );
}

function SendIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
    </svg>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Home() {
  const runtime = useLegichatRuntime();

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex flex-col h-screen max-w-3xl mx-auto bg-slate-50">
        {/* Header */}
        <header className="flex items-center gap-3 px-6 py-3.5 border-b border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white font-bold text-sm shadow-sm">
            L
          </div>
          <div>
            <h1 className="text-sm font-semibold text-slate-900">LegiChat</h1>
            <p className="text-xs text-slate-400">Assistant juridique — Droit du travail français</p>
          </div>
        </header>

        {/* Thread */}
        <ThreadPrimitive.Root className="flex flex-col flex-1 overflow-hidden">
          <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto py-4">
            <ThreadPrimitive.Empty>
              <WelcomeScreen />
            </ThreadPrimitive.Empty>

            <ThreadPrimitive.Messages
              components={{
                UserMessage,
                AssistantMessage,
              }}
            />
          </ThreadPrimitive.Viewport>

          <Composer />
        </ThreadPrimitive.Root>
      </div>
    </AssistantRuntimeProvider>
  );
}
