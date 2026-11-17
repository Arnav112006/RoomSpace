import { useRef, useState } from "react";
import { MAX_PHOTOS, useRoomStore } from "@/shared/store/roomStore";
import { Card, Field, Spinner } from "@/shared/ui/Primitives";
import { RoomPreview } from "./RoomPreview";
import { NumberInput } from "@/shared/ui/NumberInput";

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
    photoPreviewUrls, creating, createError, analyzing,
    setDraftDimensions, setDraftField, toggleFurnitureNeed, addPhotos, removePhoto, clearPhotos, submitRoomInput,
  } = useRoomStore();
  const [dragging, setDragging] = useState(false);
  const photoCount = photoPreviewUrls.length;
  const canAddMore = photoCount < MAX_PHOTOS;

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_420px] gap-10 items-start">
      <div className="min-w-0">
      <header className="mb-8 stagger">
        <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-brass-300/90">
          <span className="h-px w-6 bg-gradient-to-r from-brass-400 to-transparent" aria-hidden />
          Stage 1 · Room input
        </p>
        <h1 className="mt-4 text-[44px] sm:text-[56px] leading-[1.02] tracking-tight font-medium">
          <span className="text-gradient">Plan a room that</span>{" "}
          <em className="text-gradient-brass font-normal">actually</em>{" "}
          <span className="text-gradient">fits.</span>
        </h1>
        <p className="mt-4 text-[15px] text-paper/60 max-w-xl leading-relaxed">
          Describe the room — or add a few photos of it — and RoomSpace builds layouts that respect walls,
          doors, windows and walking space, then finds real furniture to match.
        </p>
      </header>

      <Card className="p-6 sm:p-7 space-y-7 stagger">
        <div>
          <p className="field-label mb-2">
            Room photos (optional) <span className="text-ink-muted font-normal">· {photoCount}/{MAX_PHOTOS}</span>
          </p>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              addPhotos(Array.from(e.target.files ?? []));
              e.target.value = ""; // allow picking the same file again after removing it
            }}
          />
          <div className="flex flex-wrap gap-3">
            {photoPreviewUrls.map((url, i) => (
              <div
                key={url}
                className="group relative h-24 w-32 rounded-sm overflow-hidden border border-white/15 animate-fade-up"
              >
                <img
                  src={url}
                  alt={`Room photo ${i + 1}`}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  aria-label={`Remove photo ${i + 1}`}
                  className="absolute top-1 right-1 h-6 w-6 rounded-full bg-ink-950/80 text-paper text-sm leading-none opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all hover:bg-clay-500"
                >
                  ×
                </button>
              </div>
            ))}
            {canAddMore && (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  addPhotos(Array.from(e.dataTransfer.files));
                }}
                className={`h-24 w-32 rounded-sm border border-dashed flex items-center justify-center text-xs text-center px-2 transition-all duration-300 ${
                  dragging
                    ? "border-blueprint-600 bg-blueprint-600/10 text-paper scale-105"
                    : "border-white/25 bg-ink-800/60 text-ink-muted hover:border-blueprint-600/60 hover:text-paper hover:bg-blueprint-600/5"
                }`}
              >
                {photoCount === 0 ? (
                  <span>
                    Add photos
                    <br />
                    or drop them here
                  </span>
                ) : (
                  <span>+ Add more</span>
                )}
              </button>
            )}
          </div>
          <div className="flex items-center gap-4 mt-2">
            <p className="text-xs text-ink-muted">
              {photoCount === 0
                ? "No photo means an empty room. Photos from a few angles help the vision model spot existing furniture for you to verify next."
                : "Furniture seen in more than one photo is only counted once."}
            </p>
            {photoCount > 0 && (
              <button type="button" className="text-xs text-clay-400 shrink-0" onClick={clearPhotos}>
                Remove all, start empty
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Length">
            <div className="flex">
              <NumberInput
                min={1}
                value={draftDimensions.length}
                onChange={(length) => setDraftDimensions({ length })}
                className="rounded-r-none w-full"
              />
            </div>
          </Field>
          <Field label="Width">
            <NumberInput
              min={1}
              value={draftDimensions.width}
              onChange={(width) => setDraftDimensions({ width })}
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
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-all duration-200 active:scale-95 ${
                    active
                      ? "bg-blueprint-600/15 text-paper border-blueprint-600/70 shadow-glow"
                      : "bg-white/[0.03] text-paper/80 border-white/15 hover:border-white/35 hover:text-paper"
                  }`}
                >
                  <span
                    className={`text-[11px] text-blueprint-700 transition-all duration-200 ${
                      active ? "w-3 opacity-100" : "w-0 opacity-0"
                    } overflow-hidden`}
                    aria-hidden
                  >
                    ✓
                  </span>
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {createError && (
          <p className="text-sm text-clay-400 bg-clay-500/10 border border-clay-500/30 rounded-sm px-3 py-2">
            {createError}
          </p>
        )}

        <div className="flex items-center gap-4 pt-2">
          <button className="btn-primary px-7 py-3 text-[15px]" disabled={creating || analyzing} onClick={submitRoomInput}>
            {creating || analyzing ? (
              <Spinner label={analyzing ? `Analyzing ${photoCount} photo${photoCount === 1 ? "" : "s"}…` : "Creating room…"} />
            ) : (
              <>
                Continue <span className="btn-arrow" aria-hidden>→</span>
              </>
            )}
          </button>
          <p className="text-xs text-ink-muted">
            {draftFurnitureNeeds.length} furniture type{draftFurnitureNeeds.length === 1 ? "" : "s"} requested
          </p>
        </div>
      </Card>
      </div>

      <aside className="lg:sticky lg:top-24 animate-fade-up [animation-delay:150ms]">
        <RoomPreview dimensions={draftDimensions} furniture={draftFurnitureNeeds} photoCount={photoCount} />
      </aside>
    </div>
  );
}
