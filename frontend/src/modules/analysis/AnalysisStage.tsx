import { useRoomStore } from "@/shared/store/roomStore";
import { Card, EmptyState, SectionHeading } from "@/shared/ui/Primitives";
import type { FurnitureType } from "@/shared/types";
import { NumberInput } from "@/shared/ui/NumberInput";

const TYPE_OPTIONS: FurnitureType[] = ["bed", "wardrobe", "table", "chair", "desk", "sofa", "shelf", "other"];
const ZONE_OPTIONS = ["north wall", "south wall", "east wall", "west wall", "center", "left corner", "right corner"];

export function AnalysisStage() {
  const { furniture, photoPreviewUrls, analysisError, updateFurnitureItem, removeFurnitureItem, confirmRoomModel } = useRoomStore();
  const detected = furniture.filter((f) => f.source === "vision");
  const manual = furniture.filter((f) => f.source !== "vision");

  return (
    <div className="max-w-3xl">
      <SectionHeading
        eyebrow="Stage 2"
        title="Verify what the vision model found"
        description="A pretrained YOLO model detected these items from your photos. Computer vision can misjudge type, size or position — correct anything that's off before we build the room model."
      />

      {analysisError && (
        <p className="text-sm text-clay-400 bg-clay-500/10 border border-clay-500/30 rounded-sm px-3 py-2 mb-4">
          {analysisError} Detection is skipped for this room; you can still add furniture manually below.
        </p>
      )}

      <div className="grid grid-cols-[1fr,1.4fr] gap-5">
        {photoPreviewUrls.length > 0 && (
          <Card className="p-2 h-fit space-y-2 lg:sticky lg:top-24 stagger">
            {photoPreviewUrls.map((url, i) => (
              <img key={url} src={url} alt={`Room photo ${i + 1}`} className="w-full rounded-sm object-cover" />
            ))}
            {photoPreviewUrls.length > 1 && (
              <p className="text-[11px] text-ink-muted px-1">
                {photoPreviewUrls.length} photos — furniture seen in more than one is counted once.
              </p>
            )}
          </Card>
        )}

        <div className="space-y-3 stagger">
          {detected.length === 0 ? (
            <Card>
              <EmptyState
                title="Nothing confidently detected"
                description="That's fine — add anything already in the room manually, or continue with an empty floor."
              />
            </Card>
          ) : (
            detected.map((item, i) => {
              const index = furniture.indexOf(item);
              return (
                <Card key={i} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <input
                      value={item.label}
                      onChange={(e) => updateFurnitureItem(index, { label: e.target.value })}
                      className="font-medium text-sm !bg-transparent !border-0 !p-0 focus:!border-0"
                    />
                    <button className="text-xs text-clay-400" onClick={() => removeFurnitureItem(index)}>
                      Not actually there
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    <label className="text-xs text-ink-muted">
                      Type
                      <select
                        value={item.type}
                        onChange={(e) => updateFurnitureItem(index, { type: e.target.value as FurnitureType })}
                        className="w-full mt-1"
                      >
                        {TYPE_OPTIONS.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs text-ink-muted">
                      Width (cm)
                      <NumberInput
                        min={1}
                        value={item.width_cm}
                        onChange={(width_cm) => updateFurnitureItem(index, { width_cm })}
                        className="w-full mt-1"
                      />
                    </label>
                    <label className="text-xs text-ink-muted">
                      Depth (cm)
                      <NumberInput
                        min={1}
                        value={item.depth_cm}
                        onChange={(depth_cm) => updateFurnitureItem(index, { depth_cm })}
                        className="w-full mt-1"
                      />
                    </label>
                    <label className="text-xs text-ink-muted">
                      Position
                      <select
                        value={item.approximate_zone ?? ""}
                        onChange={(e) => updateFurnitureItem(index, { approximate_zone: e.target.value })}
                        className="w-full mt-1"
                      >
                        <option value="">unspecified</option>
                        {ZONE_OPTIONS.map((z) => (
                          <option key={z} value={z}>{z}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-ink-muted">
                    <input
                      type="checkbox"
                      checked={item.is_fixed}
                      onChange={(e) => updateFurnitureItem(index, { is_fixed: e.target.checked })}
                    />
                    Fixed in place (layout generator won't move this)
                  </label>
                </Card>
              );
            })
          )}

          {manual.length > 0 && (
            <>
              <p className="label-eyebrow pt-2">From your furniture list</p>
              {manual.map((item, i) => (
                <Card key={`m-${i}`} className="flex items-center justify-between py-3">
                  <span className="text-sm">{item.label}</span>
                  <span className="flex items-center gap-3">
                    <Badge_ />
                    <button
                      className="text-xs text-clay-400 hover:underline"
                      onClick={() => removeFurnitureItem(furniture.indexOf(item))}
                      aria-label={`Remove ${item.label}`}
                    >
                      Remove
                    </button>
                  </span>
                </Card>
              ))}
            </>
          )}
        </div>
      </div>

      <div className="mt-6">
        <button className="btn-primary" onClick={confirmRoomModel}>
          Build the room model
        </button>
      </div>
    </div>
  );
}

function Badge_() {
  return <span className="text-xs text-ink-muted font-mono">will be placed by the layout engine</span>;
}
