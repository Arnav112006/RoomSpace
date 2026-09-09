import { useRoomStore } from "../../store/roomStore";
import { Card, EmptyState, SectionHeading } from "../ui/Primitives";
import type { FurnitureType } from "../../types";

const TYPE_OPTIONS: FurnitureType[] = ["bed", "wardrobe", "table", "chair", "desk", "sofa", "shelf", "window", "door", "other"];
const ZONE_OPTIONS = ["north wall", "south wall", "east wall", "west wall", "center", "left corner", "right corner"];

export function AnalysisStage() {
  const { furniture, photoPreviewUrl, analysisError, updateFurnitureItem, removeFurnitureItem, confirmRoomModel } = useRoomStore();
  const detected = furniture.filter((f) => f.source === "vision");
  const manual = furniture.filter((f) => f.source !== "vision");

  return (
    <div className="max-w-3xl">
      <SectionHeading
        eyebrow="Stage 2"
        title="Verify what the vision model found"
        description="A YOLO model (fine-tuned for indoor furniture) detected these items from your photo. Computer vision can misjudge type, size or position — correct anything that's off before we build the room model."
      />

      {analysisError && (
        <p className="text-sm text-clay-600 bg-clay-500/10 border border-clay-500/30 rounded-sm px-3 py-2 mb-4">
          {analysisError} Detection is skipped for this room; you can still add furniture manually below.
        </p>
      )}

      <div className="grid grid-cols-[1fr,1.4fr] gap-5">
        {photoPreviewUrl && (
          <Card className="p-2 h-fit">
            <img src={photoPreviewUrl} alt="Uploaded room" className="w-full rounded-sm object-cover" />
          </Card>
        )}

        <div className="space-y-3">
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
                    <button className="text-xs text-clay-600" onClick={() => removeFurnitureItem(index)}>
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
                      <input
                        type="number"
                        value={item.width_cm}
                        onChange={(e) => updateFurnitureItem(index, { width_cm: Number(e.target.value) })}
                        className="w-full mt-1"
                      />
                    </label>
                    <label className="text-xs text-ink-muted">
                      Depth (cm)
                      <input
                        type="number"
                        value={item.depth_cm}
                        onChange={(e) => updateFurnitureItem(index, { depth_cm: Number(e.target.value) })}
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
                  <Badge_ />
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
