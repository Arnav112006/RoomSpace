import type { Product, ProductCategory } from "../types";

// Stand-in product catalog. In production this is the real product
// feed described in backend/app/services/product_filter.py +
// product_recommendation.py; the shape here matches Product exactly so
// swapping in a live /api/rooms/{id}/recommendations endpoint later is
// a data-source change, not a UI change.

export const CATALOG: Product[] = [
  { id: "p-sofa-01", name: "Harlow 2-Seater Sofa", category: "sofa", image_url: "sofa-modern", product_url: "https://example-furniture.test/harlow-sofa", price: 24999, width_cm: 180, depth_cm: 90, height_cm: 80, theme: "modern" },
  { id: "p-sofa-02", name: "Wren Linen Sofa", category: "sofa", image_url: "sofa-scandi", product_url: "https://example-furniture.test/wren-sofa", price: 21999, width_cm: 170, depth_cm: 85, height_cm: 78, theme: "scandinavian" },
  { id: "p-sofa-03", name: "Marrakesh Kilim Sofa", category: "sofa", image_url: "sofa-boho", product_url: "https://example-furniture.test/marrakesh-sofa", price: 27999, width_cm: 190, depth_cm: 95, height_cm: 82, theme: "bohemian" },
  { id: "p-bed-01", name: "Oslo Platform Bed", category: "bed", image_url: "bed-scandi", product_url: "https://example-furniture.test/oslo-bed", price: 18999, width_cm: 150, depth_cm: 200, height_cm: 40, theme: "scandinavian" },
  { id: "p-bed-02", name: "Foundry Iron-Frame Bed", category: "bed", image_url: "bed-industrial", product_url: "https://example-furniture.test/foundry-bed", price: 22999, width_cm: 150, depth_cm: 205, height_cm: 110, theme: "industrial" },
  { id: "p-bed-03", name: "Windsor Panel Bed", category: "bed", image_url: "bed-traditional", product_url: "https://example-furniture.test/windsor-bed", price: 26999, width_cm: 160, depth_cm: 210, height_cm: 120, theme: "traditional" },
  { id: "p-table-01", name: "Pebble Coffee Table", category: "table", image_url: "table-minimal", product_url: "https://example-furniture.test/pebble-table", price: 6499, width_cm: 100, depth_cm: 55, height_cm: 42, theme: "minimalist" },
  { id: "p-table-02", name: "Foundry Reclaimed-Wood Table", category: "table", image_url: "table-industrial", product_url: "https://example-furniture.test/foundry-table", price: 8999, width_cm: 140, depth_cm: 80, height_cm: 75, theme: "industrial" },
  { id: "p-table-03", name: "Lotus Rattan Side Table", category: "table", image_url: "table-boho", product_url: "https://example-furniture.test/lotus-table", price: 3499, width_cm: 45, depth_cm: 45, height_cm: 50, theme: "bohemian" },
  { id: "p-chair-01", name: "Bruno Accent Chair", category: "chair", image_url: "chair-modern", product_url: "https://example-furniture.test/bruno-chair", price: 8499, width_cm: 70, depth_cm: 75, height_cm: 80, theme: "modern" },
  { id: "p-chair-02", name: "Lund Wishbone Chair", category: "chair", image_url: "chair-scandi", product_url: "https://example-furniture.test/lund-chair", price: 6999, width_cm: 55, depth_cm: 55, height_cm: 78, theme: "scandinavian" },
  { id: "p-desk-01", name: "Meridian Writing Desk", category: "desk", image_url: "desk-minimal", product_url: "https://example-furniture.test/meridian-desk", price: 9999, width_cm: 120, depth_cm: 60, height_cm: 75, theme: "minimalist" },
  { id: "p-wardrobe-01", name: "Kessler 3-Door Wardrobe", category: "wardrobe", image_url: "wardrobe-classic", product_url: "https://example-furniture.test/kessler-wardrobe", price: 32999, width_cm: 150, depth_cm: 60, height_cm: 210, theme: "traditional" },
  { id: "p-shelf-01", name: "Ladder Bookshelf", category: "shelf", image_url: "shelf-modern", product_url: "https://example-furniture.test/ladder-shelf", price: 6999, width_cm: 80, depth_cm: 30, height_cm: 180, theme: "modern" },
  { id: "p-lamp-01", name: "Halo Floor Lamp", category: "lamp", image_url: "lamp-modern", product_url: "https://example-furniture.test/halo-lamp", price: 4499, width_cm: 35, depth_cm: 35, height_cm: 150, theme: "modern" },
  { id: "p-decor-01", name: "Terracotta Planter Set", category: "decor", image_url: "decor-boho", product_url: "https://example-furniture.test/terracotta-planters", price: 2199, width_cm: 30, depth_cm: 30, height_cm: 40, theme: "bohemian" },
];

/** Stands in for the fine-tuned CLIP zero-shot score described in
 * ml/clip_matching/zero_shot.py — cosine-similarity-shaped, seeded by
 * theme keyword overlap so results are stable and explainable in a UI
 * without shipping a model to the browser. */
export function clipStyleScore(product: Product, styleText: string): number {
  const theme = (product.theme || "").toLowerCase();
  const query = styleText.toLowerCase();
  if (!theme) return 0.5;
  if (query.includes(theme)) return 0.92;
  const RELATED: Record<string, string[]> = {
    modern: ["contemporary", "sleek", "minimal"],
    minimalist: ["modern", "simple", "clean"],
    scandinavian: ["scandi", "nordic", "minimalist"],
    industrial: ["loft", "urban", "raw"],
    traditional: ["classic", "formal", "vintage"],
    bohemian: ["boho", "eclectic", "global"],
  };
  const related = RELATED[theme] || [];
  if (related.some((w) => query.includes(w))) return 0.74;
  return 0.45;
}

export function recommendForCategory(
  category: ProductCategory,
  maxWidthCm: number,
  maxDepthCm: number,
  budgetRemaining: number,
  styleText: string,
  topK = 3
): { product: Product; score: number }[] {
  const eligible = CATALOG.filter(
    (p) => p.category === category && p.width_cm <= maxWidthCm && p.depth_cm <= maxDepthCm && p.price <= budgetRemaining
  );
  return eligible
    .map((product) => ({ product, score: clipStyleScore(product, styleText) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
