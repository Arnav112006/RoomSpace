import { useState } from "react";
import { useRoomStore } from "../../store/roomStore";
import { Badge, Spinner } from "../ui/Primitives";

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
        className="flex gap-2"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='"Move the sofa to the left wall"'
          className="flex-1"
        />
        <button className="btn-brass" disabled={submitting || validating}>
          {submitting || validating ? <Spinner /> : "Apply"}
        </button>
      </form>

      <div className="flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => submit(s)} className="text-[11px] text-blueprint-700 border border-blueprint-200 rounded-sm px-2 py-1 hover:bg-blueprint-50">
            {s}
          </button>
        ))}
      </div>

      {commandLog.length > 0 && (
        <div className="border-t border-ink/10 pt-3 space-y-2 max-h-40 overflow-y-auto">
          {commandLog.map((entry) => (
            <div key={entry.id} className="text-xs">
              <p className="text-ink">“{entry.text}”</p>
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
