"use client";

interface Props {
  currentStep: string;
  stepIndex: number;
  totalSteps: number;
}

const STEP_LABELS = [
  "Recherche des articles pertinents…",
  "Analyse et classement des textes…",
  "Rédaction de la réponse juridique…",
];

export default function LoadingSteps({ currentStep, stepIndex, totalSteps }: Props) {
  return (
    <div className="flex flex-col gap-3 py-4 px-1">
      <div className="flex items-center gap-3 text-sm text-slate-600">
        <Spinner />
        <span className="font-medium">{currentStep || STEP_LABELS[0]}</span>
      </div>
      <div className="flex gap-1.5">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-500 ${
              i < stepIndex
                ? "bg-blue-500"
                : i === stepIndex
                ? "bg-blue-300 animate-pulse"
                : "bg-slate-200"
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-slate-400">
        L&apos;analyse des textes juridiques peut prendre jusqu&apos;à 40 secondes.
      </p>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 text-blue-500 flex-shrink-0"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
