import { useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "min" | "max"> & {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
};

/**
 * A number field that can be cleared while typing.
 *
 * A plain `<input type="number" value={n} onChange={e => set(Number(e.target.value))}>`
 * turns an empty box into 0 and writes it straight back, so deleting "49"
 * leaves a stuck "0". While focused, this shows exactly what was typed and
 * only reports valid numbers within [min, max]; when focus leaves, it shows
 * the stored value again, so an empty or out-of-range box snaps back to the
 * last valid number.
 */
export function NumberInput({ value, onChange, min, max, onBlur, onFocus, ...rest }: Props) {
  // Text being typed; null when not editing (then the stored value is shown).
  const [draft, setDraft] = useState<string | null>(null);

  function parse(raw: string): number | null {
    if (raw.trim() === "") return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    if (min !== undefined && n < min) return null;
    if (max !== undefined && n > max) return null;
    return n;
  }

  return (
    <input
      {...rest}
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      value={draft ?? String(value)}
      onFocus={(e) => {
        setDraft(String(value));
        onFocus?.(e);
      }}
      onChange={(e) => {
        setDraft(e.target.value);
        const n = parse(e.target.value);
        if (n !== null && n !== value) onChange(n);
      }}
      onBlur={(e) => {
        setDraft(null);
        onBlur?.(e);
      }}
    />
  );
}
