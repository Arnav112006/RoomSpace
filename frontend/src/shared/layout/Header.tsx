import { useRoomStore } from "@/shared/store/roomStore";

export function Header() {
  const backendOnline = useRoomStore((s) => s.backendOnline);
  const reset = useRoomStore((s) => s.reset);
  const room = useRoomStore((s) => s.room);

  const status =
    backendOnline === null
      ? { dot: "bg-paper/40 text-paper/40", label: "Checking API…" }
      : backendOnline
      ? { dot: "bg-moss-500 text-moss-500", label: "API connected" }
      : { dot: "bg-clay-500 text-clay-500", label: "API offline · local fallback" };

  return (
    <header className="sticky top-0 z-30 bg-ink-950/70 backdrop-blur-xl">
      <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between gap-4">
        <button onClick={reset} className="flex items-center gap-3 group" aria-label="RoomSpace — start over">
          <span className="relative h-7 w-7 border border-brass-400/80 flex items-center justify-center transition-transform duration-500 group-hover:rotate-90">
            <span className="h-2 w-2 bg-blueprint-500 transition-all duration-500 group-hover:h-3 group-hover:w-3 group-hover:bg-brass-400" />
          </span>
          <span className="font-display text-lg tracking-tight">
            Room<span className="italic text-brass-300">Space</span>
          </span>
        </button>

        <div className="flex items-center gap-5 text-xs">
          {room && (
            <span
              key={room.id}
              className="hidden sm:inline-flex items-center gap-2 text-paper/60 font-mono animate-fade-in"
            >
              <span className="text-paper/30">room</span>
              {room.id.slice(0, 8)}
              <span className="text-paper/30">·</span>
              {room.dimensions.length}×{room.dimensions.width} {room.dimensions.unit}
            </span>
          )}
          <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
            <span className="relative flex h-1.5 w-1.5">
              {backendOnline && <span className={`absolute inset-0 rounded-full animate-pulse-ring ${status.dot}`} />}
              <span className={`relative h-1.5 w-1.5 rounded-full ${status.dot}`} />
            </span>
            <span className="text-paper/70">{status.label}</span>
          </span>
        </div>
      </div>
      {/* Hairline that fades out at both ends. */}
      <div className="h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
    </header>
  );
}
