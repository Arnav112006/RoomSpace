import { useEffect, useMemo, useState } from "react";
import { useRoomStore } from "@/shared/store/roomStore";
import { productImageUrl, recommendForCategory } from "@/shared/lib/catalog";
import { api, ApiError } from "@/shared/lib/api";
import type { Product, ProductCategory } from "@/shared/types";
import { Badge, Card, EmptyState, SectionHeading, Spinner } from "@/shared/ui/Primitives";

const CATEGORY_KEYWORDS: [ProductCategory, string[]][] = [
  ["bed", ["bed"]],
  ["wardrobe", ["wardrobe", "closet"]],
  ["sofa", ["sofa", "couch"]],
  ["desk", ["desk"]],
  ["table", ["table"]],
  ["chair", ["chair"]],
  ["shelf", ["shelf", "bookcase"]],
  ["lamp", ["lamp"]],
  ["decor", ["decor", "plant"]],
];

function guessCategory(label: string): ProductCategory {
  const lower = label.toLowerCase();
  for (const [category, words] of CATEGORY_KEYWORDS) {
    if (words.some((w) => lower.includes(w))) return category;
  }
  return "other";
}

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export function RecommendationsStage() {
  const { room, activePlacements, chosenProducts, chooseProduct, reset } = useRoomStore();

  const groups = useMemo(() => {
    if (!room) return [];
    const budget = room.budget ?? 100000;
    return activePlacements
      .map((p) => {
        const category = guessCategory(p.label);
        if (category === "other") return null;
        const matches = recommendForCategory(
          category,
          p.width_cm * 1.15,
          p.depth_cm * 1.15,
          budget,
          room.theme,
          3
        );
        return { placement: p, category, matches };
      })
      .filter((g): g is NonNullable<typeof g> => g !== null && g.matches.length > 0);
  }, [room, activePlacements]);

  // The user's pick for each placement, or the top match if they haven't
  // picked one. Only current placements count, so removed items drop out.
  const selections = useMemo(() => {
    const out: Record<string, Product> = {};
    for (const { placement, matches } of groups) {
      const chosen = chosenProducts[placement.item_id];
      out[placement.item_id] =
        chosen && matches.some((m) => m.product.id === chosen.id) ? chosen : matches[0].product;
    }
    return out;
  }, [groups, chosenProducts]);

  const total = Object.values(selections).reduce((sum, p) => sum + p.price, 0);

  if (!room) return null;

  return (
    <div>
      <SectionHeading
        eyebrow="Stage 12"
        title="Products that fit this room"
        description={`Matched against your ${room.theme.toLowerCase()} theme${room.budget ? `, a ${rupees(room.budget)} budget,` : ""} and each placement's footprint — closest style match first. Click a product to choose it.`}
      />

      {groups.length === 0 ? (
        <Card>
          <EmptyState
            title="No catalog matches yet"
            description="Nothing in the sample catalog fits this layout's categories, sizes or budget. Widen the budget or adjust the layout, then come back."
          />
        </Card>
      ) : (
        <>
          <p className="text-sm mb-4">
            Chosen total <span className="font-mono text-brass-700">{rupees(total)}</span>
            {room.budget ? (
              <span className={total > room.budget ? "text-clay-400" : "text-ink-muted"}>
                {" "}
                of {rupees(room.budget)} budget{total > room.budget ? " — over budget" : ""}
              </span>
            ) : null}
          </p>

          <div className="space-y-8 stagger">
            {groups.map(({ placement, category, matches }) => (
              <div key={placement.item_id}>
                <p className="text-sm font-medium mb-2">
                  For your <span className="text-blueprint-700">{placement.label}</span>{" "}
                  <span className="text-ink-muted text-xs font-mono">
                    ({placement.width_cm}×{placement.depth_cm}cm space, {category})
                  </span>
                </p>
                <div className="grid grid-cols-3 gap-4 stagger">
                  {matches.map(({ product, score }) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      score={score}
                      chosen={selections[placement.item_id]?.id === product.id}
                      onChoose={() => chooseProduct(placement.item_id, product)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <ConceptImage roomId={room.id} selections={selections} />
        </>
      )}

      <div className="mt-8 border-t border-white/10 pt-5">
        <button className="btn-ghost" onClick={reset}>
          Start a new room
        </button>
      </div>
    </div>
  );
}

function ProductCard({
  product,
  score,
  chosen,
  onChoose,
}: {
  product: Product;
  score: number;
  chosen: boolean;
  onChoose: () => void;
}) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const [photoLoaded, setPhotoLoaded] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={chosen}
      onClick={onChoose}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onChoose();
        }
      }}
      className={`group panel-interactive p-3 cursor-pointer ${
        chosen ? "!border-brass-400/80 shadow-glow-brass hover:shadow-glow-brass" : ""
      }`}
    >
      <div className={`relative h-36 rounded-sm mb-3 overflow-hidden ${photoLoaded || photoFailed ? "bg-ink-800" : "skeleton"}`}>
        {photoFailed ? (
          <div className="h-full flex items-center justify-center text-ink-muted text-[11px]">
            Photo unavailable (is the backend running?)
          </div>
        ) : (
          <img
            src={productImageUrl(product)}
            alt={product.name}
            loading="lazy"
            onLoad={() => setPhotoLoaded(true)}
            onError={() => setPhotoFailed(true)}
            className={`h-full w-full object-cover transition-all duration-700 ease-out group-hover:scale-105 ${
              photoLoaded ? "opacity-100" : "opacity-0"
            }`}
          />
        )}
        {/* Soft fade at the bottom so the badge and photo edge read cleanly. */}
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-ink-950/50 to-transparent" aria-hidden />
        {chosen && (
          <span className="absolute top-2 left-2 animate-fade-in">
            <span className="inline-flex items-center gap-1 rounded-full bg-brass-400 text-ink-950 px-2 py-0.5 text-[11px] font-semibold shadow-glow-brass">
              ✓ Chosen
            </span>
          </span>
        )}
      </div>
      <p className="text-sm font-medium leading-tight">{product.name}</p>
      <p className="text-xs text-ink-muted mt-0.5">
        {product.width_cm}×{product.depth_cm}cm
      </p>
      <div className="flex items-center justify-between mt-2">
        <span className="font-mono text-sm text-brass-700">{rupees(product.price)}</span>
        <Badge tone="brass">{Math.round(score * 100)}% match</Badge>
      </div>
      <a
        href={product.product_url}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="inline-block text-xs text-ink-muted hover:text-paper mt-2"
      >
        View product ↗
      </a>
    </div>
  );
}

/** The backend's final concept sheet: the active layout with each chosen
 * product's photo drawn in its footprint. */
function ConceptImage({ roomId, selections }: { roomId: string; selections: Record<string, Product> }) {
  const activePlacements = useRoomStore((s) => s.activePlacements);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Free the previous image whenever it's replaced or the stage unmounts.
  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  async function render() {
    setLoading(true);
    setError(null);
    try {
      const blob = await api.conceptImage(roomId, { placements: activePlacements, selections });
      setImageUrl(URL.createObjectURL(blob));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't render the concept image.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mt-8 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-medium">Final concept</p>
          <p className="text-xs text-ink-muted">
            Your layout with the chosen products' photos placed in it.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {imageUrl && (
            <a className="btn-ghost" href={imageUrl} download="roomspace-concept.png">
              Download PNG
            </a>
          )}
          <button className="btn-brass" disabled={loading} onClick={render}>
            {loading ? <Spinner label="Rendering…" /> : imageUrl ? "Update concept" : "Show final concept"}
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-clay-400">{error}</p>}
      {loading && !imageUrl && <div className="skeleton rounded-sm aspect-[4/3]" aria-hidden />}
      {imageUrl && (
        <img key={imageUrl} src={imageUrl} alt="Final room concept" className="w-full rounded-sm animate-fade-up shadow-lift" />
      )}
    </Card>
  );
}
