import { useState } from "react";
import { useRoomStore } from "@/shared/store/roomStore";
import { Badge, Spinner } from "@/shared/ui/Primitives";

const SUGGESTIONS = ["Move the sofa to the left wall", "Add a table near the window", "Remove the chair", "Rotate the desk"];

export function CommandBar() {
  const { commandLog, applyCommand, validating } = useRoomStore();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(value?: string) {
    const command = value ?? text;
    if (!command.trim() || submitting) return;
    setSubmitting(true);
    await applyCommand(command);
    setSubmitting(false);
    setText("");
  }

  return (
    <div className="space-y-3">
      <p className="label-eyebrow">Refine with a command</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-2"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='"Move the sofa to the left wall"'
          className="flex-1"
        />
        <button className="btn-brass w-full" disabled={submitting || validating}>
          {submitting || validating ? <Spinner /> : "Apply"}
        </button>
      </form>

      <div className="flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => submit(s)}
            className="text-[11px] text-blueprint-700 border border-blueprint-500/30 rounded-full px-2.5 py-1 transition-all duration-200 hover:bg-blueprint-500/10 hover:border-blueprint-500/60 active:scale-95"
          >
            {s}
          </button>
        ))}
      </div>

      {commandLog.length > 0 && (
        <div className="border-t border-white/10 pt-3 space-y-2 max-h-40 overflow-y-auto">
          {commandLog.map((entry) => (
            <div key={entry.id} className="text-xs animate-fade-up">
              <p className="text-paper">“{entry.text}”</p>
              <p className="flex items-center gap-1.5 mt-0.5">
                <Badge tone={entry.ok ? "good" : "bad"}>{entry.ok ? "applied" : "rejected"}</Badge>
                <span className="text-ink-muted">{entry.result}</span>
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
