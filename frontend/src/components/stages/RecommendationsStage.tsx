import { useMemo } from "react";
import { useRoomStore } from "../../store/roomStore";
import { recommendForCategory } from "../../lib/catalog";
import type { ProductCategory } from "../../types";
import { Badge, Card, EmptyState, SectionHeading } from "../ui/Primitives";

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

export function RecommendationsStage() {
  const { room, activePlacements, reset } = useRoomStore();

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

  if (!room) return null;

  return (
    <div>
      <SectionHeading
        eyebrow="Stage 12"
        title="Products that fit this room"
        description={`Matched against your ${room.theme.toLowerCase()} theme${room.budget ? `, a ₹${room.budget.toLocaleString("en-IN")} budget,` : ""} and each placement's footprint — closest style match first.`}
      />

      {groups.length === 0 ? (
        <Card>
          <EmptyState
            title="No catalog matches yet"
            description="Nothing in the sample catalog fits this layout's categories, sizes or budget. Widen the budget or adjust the layout, then come back."
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.map(({ placement, category, matches }) => (
            <div key={placement.item_id}>
              <p className="text-sm font-medium mb-2">
                For your <span className="text-blueprint-700">{placement.label}</span>{" "}
                <span className="text-ink-muted text-xs font-mono">
                  ({placement.width_cm}×{placement.depth_cm}cm space, {category})
                </span>
              </p>
              <div className="grid grid-cols-3 gap-4">
                {matches.map(({ product, score }) => (
                  <a
                    key={product.id}
                    href={product.product_url}
                    target="_blank"
                    rel="noreferrer"
                    className="panel p-3 block hover:border-brass-400 transition-colors"
                  >
                    <div className="h-24 bg-paper-dim rounded-sm mb-2 flex items-center justify-center text-ink-muted text-[11px]">
                      {product.image_url}
                    </div>
                    <p className="text-sm font-medium leading-tight">{product.name}</p>
                    <p className="text-xs text-ink-muted mt-0.5">
                      {product.width_cm}×{product.depth_cm}cm
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="font-mono text-sm text-brass-700">₹{product.price.toLocaleString("en-IN")}</span>
                      <Badge tone="brass">{Math.round(score * 100)}% match</Badge>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 border-t border-ink/10 pt-5">
        <button className="btn-ghost" onClick={reset}>
          Start a new room
        </button>
      </div>
    </div>
  );
}
