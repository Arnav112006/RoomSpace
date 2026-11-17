import { useRoomStore } from "@/shared/store/roomStore";
import { Badge } from "@/shared/ui/Primitives";

export function VersionHistory() {
  const { versions, restoreVersion } = useRoomStore();

  return (
    <div className="space-y-3">
      <p className="label-eyebrow">Version history</p>
      {versions.length === 0 ? (
        <p className="text-sm text-ink-muted">Versions appear here as you select or refine layouts.</p>
      ) : (
        <ol className="relative max-h-52 overflow-y-auto pl-1">
          {versions.map((v, i) => (
            <li
              key={v.id}
              className="relative flex items-center justify-between gap-2 pl-4 py-1.5 border-l border-white/10 animate-fade-up"
            >
              {/* Timeline dot; the newest version is highlighted. */}
              <span
                className={`absolute -left-[4.5px] top-1/2 -translate-y-1/2 h-2 w-2 rounded-full ring-2 ring-ink-900 ${
                  i === 0 ? "bg-blueprint-600 shadow-glow" : v.feasible ? "bg-moss-500/70" : "bg-clay-500/70"
                }`}
                aria-hidden
              />
              <div className="min-w-0">
                <p className="text-xs text-paper truncate">{v.note || v.label}</p>
                <p className="text-[10px] text-ink-muted font-mono">
                  {new Date(v.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Badge tone={v.feasible ? "good" : "bad"}>{v.feasible ? "ok" : "issue"}</Badge>
                {i !== 0 && (
                  <button
                    className="text-[11px] text-blueprint-700 underline-offset-2 hover:underline transition-colors hover:text-paper"
                    onClick={() => restoreVersion(v.id)}
                  >
                    Restore
                  </button>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
