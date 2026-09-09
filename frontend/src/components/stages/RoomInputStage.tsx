import { useRef } from "react";
import { useRoomStore } from "../../store/roomStore";
import { Card, Field, SectionHeading, Spinner } from "../ui/Primitives";

const ROOM_TYPES = ["Bedroom", "Living Room", "Home Office", "Dining Room", "Kids Room", "Studio Apartment"];
const THEMES = ["Modern", "Minimalist", "Scandinavian", "Industrial", "Traditional", "Bohemian"];
const FURNITURE_OPTIONS = [
  { id: "bed", label: "Bed" },
  { id: "wardrobe", label: "Wardrobe" },
  { id: "sofa", label: "Sofa" },
  { id: "table", label: "Table" },
  { id: "chair", label: "Chair(s)" },
  { id: "desk", label: "Desk" },
  { id: "shelf", label: "Shelving" },
];

export function RoomInputStage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const {
    draftDimensions, draftRoomType, draftTheme, draftOccasion, draftBudget, draftFurnitureNeeds,
    photoPreviewUrl, creating, createError, analyzing,
    setDraftDimensions, setDraftField, toggleFurnitureNeed, setPhotoFile, submitRoomInput,
  } = useRoomStore();

  return (
    <div className="max-w-3xl">
      <SectionHeading
        eyebrow="Stage 1"
        title="Tell RoomSpace about the room"
        description="Start from an empty room or upload a photo of an existing one — either way, we'll turn this into a structured room model the layout engine can work with."
      />

      <Card className="space-y-6">
        <div>
          <p className="field-label mb-2">Room photo (optional)</p>
          <div className="flex items-center gap-4">
            <div
              className="h-24 w-32 shrink-0 rounded-sm border border-dashed border-ink/25 bg-paper-dim flex items-center justify-center overflow-hidden cursor-pointer"
              onClick={() => fileInput.current?.click()}
            >
              {photoPreviewUrl ? (
                <img src={photoPreviewUrl} alt="Uploaded room" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs text-ink-muted text-center px-2">Empty room<br />(no photo)</span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
              />
              <button type="button" className="btn-ghost" onClick={() => fileInput.current?.click()}>
                {photoPreviewUrl ? "Change photo" : "Upload a photo"}
              </button>
              {photoPreviewUrl && (
                <button type="button" className="text-xs text-clay-600 text-left" onClick={() => setPhotoFile(null)}>
                  Remove photo, start empty
                </button>
              )}
              <p className="text-xs text-ink-muted max-w-xs">
                A photo lets our vision model detect existing furniture, doors and windows for you to verify in the next step.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Length">
            <div className="flex">
              <input
                type="number"
                min={1}
                value={draftDimensions.length}
                onChange={(e) => setDraftDimensions({ length: Number(e.target.value) })}
                className="rounded-r-none w-full"
              />
            </div>
          </Field>
          <Field label="Width">
            <input
              type="number"
              min={1}
              value={draftDimensions.width}
              onChange={(e) => setDraftDimensions({ width: Number(e.target.value) })}
              className="w-full"
            />
          </Field>
          <Field label="Unit">
            <select
              value={draftDimensions.unit}
              onChange={(e) => setDraftDimensions({ unit: e.target.value as any })}
              className="w-full"
            >
              <option value="ft">feet</option>
              <option value="m">meters</option>
              <option value="cm">centimeters</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Room type">
            <select value={draftRoomType} onChange={(e) => setDraftField("draftRoomType", e.target.value)} className="w-full">
              {ROOM_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Preferred theme / style">
            <select value={draftTheme} onChange={(e) => setDraftField("draftTheme", e.target.value)} className="w-full">
              {THEMES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Occasion" hint="Optional — e.g. moving in, redecorating, guest room">
            <input
              type="text"
              value={draftOccasion}
              onChange={(e) => setDraftField("draftOccasion", e.target.value)}
              placeholder="e.g. Moving in"
              className="w-full"
            />
          </Field>
          <Field label="Budget" hint="Optional — total for furniture, in ₹">
            <input
              type="number"
              min={0}
              value={draftBudget}
              onChange={(e) => setDraftField("draftBudget", e.target.value)}
              placeholder="e.g. 60000"
              className="w-full"
            />
          </Field>
        </div>

        <div>
          <p className="field-label mb-2">Furniture you need</p>
          <div className="flex flex-wrap gap-2">
            {FURNITURE_OPTIONS.map((opt) => {
              const active = draftFurnitureNeeds.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleFurnitureNeed(opt.id)}
                  className={`px-3 py-1.5 rounded-sm border text-sm transition-colors ${
                    active
                      ? "bg-blueprint-700 text-paper border-blueprint-700"
                      : "bg-white/60 text-ink border-ink/15 hover:border-ink/40"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {createError && (
          <p className="text-sm text-clay-600 bg-clay-500/10 border border-clay-500/30 rounded-sm px-3 py-2">
            {createError}
          </p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button className="btn-primary" disabled={creating || analyzing} onClick={submitRoomInput}>
            {creating || analyzing ? <Spinner label={analyzing ? "Analyzing photo…" : "Creating room…"} /> : "Continue"}
          </button>
          <p className="text-xs text-ink-muted">
            {draftFurnitureNeeds.length} furniture type{draftFurnitureNeeds.length === 1 ? "" : "s"} requested
          </p>
        </div>
      </Card>
    </div>
  );
}
