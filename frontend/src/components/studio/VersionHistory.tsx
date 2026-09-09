import { useRoomStore } from "../../store/roomStore";
import { Badge } from "../ui/Primitives";

export function VersionHistory() {
  const { versions, restoreVersion } = useRoomStore();

  return (
    <div className="space-y-3">
      <p className="label-eyebrow">Version history</p>
      {versions.length === 0 ? (
        <p className="text-sm text-ink-muted">Versions appear here as you select or refine layouts.</p>
      ) : (
        <ol className="space-y-2 max-h-52 overflow-y-auto">
          {versions.map((v, i) => (
            <li key={v.id} className="flex items-center justify-between gap-2 border-l-2 border-ink/10 pl-3 py-1">
              <div className="min-w-0">
                <p className="text-xs text-ink truncate">{v.note || v.label}</p>
                <p className="text-[10px] text-ink-muted font-mono">
                  {new Date(v.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Badge tone={v.feasible ? "good" : "bad"}>{v.feasible ? "ok" : "issue"}</Badge>
                {i !== 0 && (
                  <button className="text-[11px] text-blueprint-700 underline underline-offset-2" onClick={() => restoreVersion(v.id)}>
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
