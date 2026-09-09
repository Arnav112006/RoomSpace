import type { PropsWithChildren, ReactNode } from "react";

export function Card({ children, className = "" }: PropsWithChildren<{ className?: string }>) {
  return <div className={`panel p-5 ${className}`}>{children}</div>;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-5">
      {eyebrow && <p className="label-eyebrow mb-1">{eyebrow}</p>}
      <h2 className="text-xl text-ink font-medium">{title}</h2>
      {description && <p className="text-sm text-ink-muted mt-1 max-w-prose">{description}</p>}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: PropsWithChildren<{ label: string; hint?: string }>) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="block text-xs text-ink-muted mt-1">{hint}</span>}
    </label>
  );
}

export function Badge({
  tone = "neutral",
  children,
}: PropsWithChildren<{ tone?: "neutral" | "good" | "bad" | "brass" }>) {
  const tones: Record<string, string> = {
    neutral: "bg-ink/5 text-ink-muted border-ink/10",
    good: "bg-moss-500/10 text-moss-600 border-moss-500/30",
    bad: "bg-clay-500/10 text-clay-600 border-clay-500/30",
    brass: "bg-brass-400/15 text-brass-700 border-brass-400/40",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="text-center py-14 px-6">
      <p className="text-ink font-display text-lg mb-1">{title}</p>
      <p className="text-sm text-ink-muted max-w-sm mx-auto mb-4">{description}</p>
      {action}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-ink-muted">
      <span className="h-3.5 w-3.5 rounded-full border-2 border-blueprint-600 border-t-transparent animate-spin" />
      {label}
    </div>
  );
}
