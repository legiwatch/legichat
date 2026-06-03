import type { LegalSource } from "@/types/contract";

interface Props {
  sources: LegalSource[];
}

export default function SourcesList({ sources }: Props) {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-slate-200">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
        Sources — Code du travail
      </p>
      <div className="flex flex-col gap-2">
        {sources.map((s) => (
          <SourceCard key={s.articleId} source={s} />
        ))}
      </div>
    </div>
  );
}

function SourceCard({ source }: { source: LegalSource }) {
  const breadcrumb = source.hierarchie.slice(-2).join(" › ");

  const inner = (
    <div className="group flex flex-col gap-0.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm transition-colors hover:border-blue-300 hover:bg-blue-50">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs font-semibold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
          Art. {source.numero}
        </span>
        {source.exactMatch && (
          <span className="text-xs text-emerald-600 font-medium">✓ article exact</span>
        )}
      </div>
      {breadcrumb && (
        <p className="text-xs text-slate-400 truncate">{breadcrumb}</p>
      )}
      <p className="text-xs text-slate-600 line-clamp-2 mt-1 leading-relaxed">
        {source.extrait.replace(/^Article [A-Z0-9-]+\n/, "")}
      </p>
    </div>
  );

  if (source.url) {
    return (
      <a href={source.url} target="_blank" rel="noopener noreferrer" className="no-underline">
        {inner}
      </a>
    );
  }
  return inner;
}
