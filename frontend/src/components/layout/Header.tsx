import { useRoomStore } from "../../store/roomStore";

export function Header() {
  const backendOnline = useRoomStore((s) => s.backendOnline);
  const reset = useRoomStore((s) => s.reset);
  const room = useRoomStore((s) => s.room);

  return (
    <header className="border-b border-ink/10 bg-ink text-paper">
      <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center justify-between gap-4">
        <button onClick={reset} className="flex items-center gap-3 group">
          <span className="h-7 w-7 border border-brass-400 flex items-center justify-center">
            <span className="h-2 w-2 bg-blueprint-400" />
          </span>
          <span className="font-display text-lg tracking-tight">RoomSpace</span>
        </button>

        <div className="flex items-center gap-4 text-xs">
          {room && (
            <span className="hidden sm:inline text-paper/60 font-mono">
              room {room.id.slice(0, 8)} · {room.dimensions.length}×{room.dimensions.width}{room.dimensions.unit}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                backendOnline === null ? "bg-paper/30" : backendOnline ? "bg-moss-500" : "bg-clay-500"
              }`}
            />
            <span className="text-paper/70">
              {backendOnline === null ? "checking api…" : backendOnline ? "api connected" : "api offline — using local fallback"}
            </span>
          </span>
        </div>
      </div>
    </header>
  );
}
