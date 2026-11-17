import { create } from "zustand";
import type {
  FurnitureItem,
  Layout,
  LayoutVersion,
  Opening,
  OpeningKind,
  Placement,
  Product,
  RoomDimensions,
  RoomResponse,
  ScoredLayout,
} from "@/shared/types";
import { api, ApiError } from "@/shared/lib/api";
import { generateCandidates, rankCandidates, type LayoutStyle } from "@/shared/lib/layoutEngine";
import { MIN_CLEARANCE_CM, openingFitErrors, validateLayoutLocal } from "@/shared/lib/constraintEngine";
import { parseCommand, describeAction } from "@/shared/lib/commandParser";
import { roomDimensionsCm } from "@/shared/lib/units";
import { defaultFootprint } from "@/shared/lib/furniture";

export type WizardStep = "input" | "analysis" | "model" | "studio" | "recommendations";

interface CandidateEntry {
  style: LayoutStyle;
  layout: Layout;
}

interface RoomStoreState {
  step: WizardStep;
  backendOnline: boolean | null; // null = unchecked

  // Stage 1
  draftDimensions: RoomDimensions;
  draftRoomType: string;
  draftTheme: string;
  draftOccasion: string;
  draftBudget: string;
  draftFurnitureNeeds: string[];
  photoFiles: File[];
  photoPreviewUrls: string[]; // same order as photoFiles

  // Stage 1-3 result
  room: RoomResponse | null;
  furniture: FurnitureItem[];
  creating: boolean;
  createError: string | null;

  // Stage 3 — doors and windows (docs/room-model.md §4). Edited locally,
  // saved to the room when layouts are generated.
  openings: Opening[];
  openingsError: string | null;

  // Stage 2
  analyzing: boolean;
  analysisError: string | null;

  // Stage 4-7
  candidates: CandidateEntry[];
  rankedLayouts: ScoredLayout[];
  selectedLayoutId: string | null;
  generating: boolean;

  // Stage 8-10 (active working placements + live validation)
  activePlacements: Placement[];
  activeFeasible: boolean;
  activeViolations: string[];
  validating: boolean;
  usingRemoteValidation: boolean;

  // Stage 9 command log
  commandLog: { id: string; text: string; result: string; ok: boolean }[];

  // Stage 11
  versions: LayoutVersion[];

  // Stage 12 — products the user picked for each placement. An empty entry
  // means "use the top recommendation", so the final image always has one.
  chosenProducts: Record<string, Product>;
  chooseProduct: (itemId: string, product: Product) => void;

  // actions
  checkBackend: () => Promise<void>;
  setDraftDimensions: (d: Partial<RoomDimensions>) => void;
  setDraftField: (field: "draftRoomType" | "draftTheme" | "draftOccasion" | "draftBudget", value: string) => void;
  toggleFurnitureNeed: (need: string) => void;
  addPhotos: (files: File[]) => void;
  removePhoto: (index: number) => void;
  clearPhotos: () => void;
  submitRoomInput: () => Promise<void>;

  updateFurnitureItem: (index: number, patch: Partial<FurnitureItem>) => void;
  removeFurnitureItem: (index: number) => void;
  addManualFurnitureItem: (item: FurnitureItem) => void;
  confirmRoomModel: () => void;

  addOpening: (kind: OpeningKind) => void;
  updateOpening: (id: string, patch: Partial<Opening>) => void;
  removeOpening: (id: string) => void;

  generateAndRank: () => Promise<void>;
  selectLayout: (layoutId: string) => void;

  revalidateActive: (placements: Placement[], note: string) => Promise<void>;
  applyCommand: (text: string) => Promise<void>;

  restoreVersion: (versionId: string) => void;

  reset: () => void;
}

/** Matches backend room_analysis.MAX_PHOTOS_PER_ROOM. */
export const MAX_PHOTOS = 8;

const DEFAULT_DIMENSIONS: RoomDimensions = { length: 12, width: 10, unit: "ft" };

/** FastAPI error bodies are {"detail": string | string[] | object[]}. */
function firstDetail(body: string): string {
  try {
    const detail = JSON.parse(body).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      return typeof detail[0] === "string" ? detail[0] : detail[0].msg ?? body;
    }
  } catch {
    // not JSON — fall through
  }
  return body;
}

function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export const useRoomStore = create<RoomStoreState>((set, get) => ({
  step: "input",
  backendOnline: null,

  draftDimensions: DEFAULT_DIMENSIONS,
  draftRoomType: "Bedroom",
  draftTheme: "Modern",
  draftOccasion: "",
  draftBudget: "",
  draftFurnitureNeeds: ["bed", "wardrobe"],
  photoFiles: [],
  photoPreviewUrls: [],

  room: null,
  furniture: [],
  creating: false,
  createError: null,

  openings: [],
  openingsError: null,

  analyzing: false,
  analysisError: null,

  candidates: [],
  rankedLayouts: [],
  selectedLayoutId: null,
  generating: false,

  activePlacements: [],
  activeFeasible: true,
  activeViolations: [],
  validating: false,
  usingRemoteValidation: false,

  commandLog: [],
  versions: [],

  chosenProducts: {},
  chooseProduct: (itemId, product) =>
    set((s) => ({ chosenProducts: { ...s.chosenProducts, [itemId]: product } })),

  checkBackend: async () => {
    try {
      await api.health();
      set({ backendOnline: true });
    } catch {
      set({ backendOnline: false });
    }
  },

  setDraftDimensions: (d) => set((s) => ({ draftDimensions: { ...s.draftDimensions, ...d } })),
  setDraftField: (field, value) => set({ [field]: value } as any),
  toggleFurnitureNeed: (need) =>
    set((s) => ({
      draftFurnitureNeeds: s.draftFurnitureNeeds.includes(need)
        ? s.draftFurnitureNeeds.filter((n) => n !== need)
        : [...s.draftFurnitureNeeds, need],
    })),
  addPhotos: (files) => {
    const s = get();
    const room = MAX_PHOTOS - s.photoFiles.length;
    const added = files.filter((f) => f.type.startsWith("image/")).slice(0, Math.max(0, room));
    set({
      photoFiles: [...s.photoFiles, ...added],
      photoPreviewUrls: [...s.photoPreviewUrls, ...added.map((f) => URL.createObjectURL(f))],
    });
  },
  removePhoto: (index) => {
    const s = get();
    const url = s.photoPreviewUrls[index];
    if (url) URL.revokeObjectURL(url);
    set({
      photoFiles: s.photoFiles.filter((_, i) => i !== index),
      photoPreviewUrls: s.photoPreviewUrls.filter((_, i) => i !== index),
    });
  },
  clearPhotos: () => {
    get().photoPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    set({ photoFiles: [], photoPreviewUrls: [] });
  },

  submitRoomInput: async () => {
    const s = get();
    set({ creating: true, createError: null });
    try {
      const room = await api.createRoom({
        dimensions: s.draftDimensions,
        room_type: s.draftRoomType,
        theme: s.draftTheme,
        occasion: s.draftOccasion || null,
        budget: s.draftBudget ? Number(s.draftBudget) : null,
      });

      let finalRoom = room;
      let furniture: FurnitureItem[] = [];

      if (s.photoFiles.length > 0) {
        set({ analyzing: true, analysisError: null });
        try {
          finalRoom = await api.analyzePhotos(room.id, s.photoFiles);
          furniture = finalRoom.furniture;
        } catch (err) {
          set({ analysisError: err instanceof ApiError ? err.message : "Photo analysis failed." });
        } finally {
          set({ analyzing: false });
        }
      }

      // Seed manual furniture entries for anything the user asked for
      // that vision detection didn't already surface (or when there
      // was no photo at all — the empty-room path).
      for (const need of s.draftFurnitureNeeds) {
        const already = furniture.some((f) => f.type === need);
        if (!already) {
          const [w, d] = defaultFootprint(need);
          furniture.push({
            type: need as FurnitureItem["type"],
            label: need.charAt(0).toUpperCase() + need.slice(1),
            width_cm: w,
            depth_cm: d,
            is_fixed: false,
            source: "manual",
          });
        }
      }

      set({
        room: finalRoom,
        furniture,
        openings: finalRoom.openings ?? [],
        creating: false,
        step: s.photoFiles.length > 0 ? "analysis" : "model",
      });
    } catch (err) {
      set({
        creating: false,
        createError: err instanceof ApiError ? err.message : "Couldn't create the room. Try again.",
      });
    }
  },

  updateFurnitureItem: (index, patch) =>
    set((s) => ({ furniture: s.furniture.map((f, i) => (i === index ? { ...f, ...patch } : f)) })),
  removeFurnitureItem: (index) => set((s) => ({ furniture: s.furniture.filter((_, i) => i !== index) })),
  addManualFurnitureItem: (item) => set((s) => ({ furniture: [...s.furniture, item] })),
  confirmRoomModel: () => set({ step: "model" }),

  addOpening: (kind) =>
    set((s) => ({
      openingsError: null,
      openings: [
        ...s.openings,
        kind === "door"
          ? { id: newId("door"), kind, wall: "south", offset_cm: 30, width_cm: 90, hinge: "start", swing: "inward" }
          : { id: newId("window"), kind, wall: "north", offset_cm: 30, width_cm: 120 },
      ],
    })),
  updateOpening: (id, patch) =>
    set((s) => ({ openingsError: null, openings: s.openings.map((o) => (o.id === id ? { ...o, ...patch } : o)) })),
  removeOpening: (id) => set((s) => ({ openingsError: null, openings: s.openings.filter((o) => o.id !== id) })),

  generateAndRank: async () => {
    const s = get();
    if (!s.room) return;

    const [lengthCm, widthCm] = roomDimensionsCm(s.room.dimensions);
    const fitErrors = openingFitErrors(s.openings, lengthCm, widthCm);
    if (fitErrors.length > 0) {
      set({ openingsError: fitErrors[0] });
      return;
    }

    set({ generating: true, openingsError: null });

    // Save doors/windows on the room so server-side validation (stages 5/10)
    // checks them too. If the API is unreachable, carry on locally.
    let room: RoomResponse = { ...s.room, openings: s.openings };
    try {
      room = await api.setOpenings(s.room.id, s.openings);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        set({ generating: false, openingsError: firstDetail(err.message) });
        return;
      }
    }

    set({ room, step: "studio" });
    const candidates = generateCandidates(s.furniture, room.dimensions, room.id, room.openings);
    const ranked = rankCandidates(candidates, room.dimensions, room.theme, room.budget);

    set({ candidates, rankedLayouts: ranked, generating: false });

    if (ranked.length > 0) {
      get().selectLayout(ranked[0].layout.id);
    } else if (candidates.length > 0) {
      // Nothing was feasible — still show the least-bad candidate so
      // the user has something concrete to fix via commands.
      const fallback = candidates[0].layout;
      set({
        selectedLayoutId: fallback.id,
        activePlacements: fallback.placements,
        activeFeasible: fallback.feasible,
        activeViolations: fallback.violations,
      });
    }
  },

  selectLayout: (layoutId) => {
    const s = get();
    const entry = s.candidates.find((c) => c.layout.id === layoutId);
    if (!entry) return;
    set({
      selectedLayoutId: layoutId,
      activePlacements: entry.layout.placements,
      activeFeasible: entry.layout.feasible,
      activeViolations: entry.layout.violations,
    });
    const version: LayoutVersion = {
      id: newId("v"),
      label: `Selected ${entry.style.replace("-", " ")} layout`,
      createdAt: Date.now(),
      placements: entry.layout.placements,
      feasible: entry.layout.feasible,
      violations: entry.layout.violations,
      note: "Initial selection",
    };
    set({ versions: [version, ...s.versions] });
  },

  revalidateActive: async (placements, note) => {
    const s = get();
    if (!s.room) return;
    set({ validating: true });
    try {
      const result = await api.validateLayout(s.room.id, placements);
      set({
        activePlacements: placements,
        activeFeasible: result.feasible,
        activeViolations: result.violations,
        usingRemoteValidation: true,
      });
    } catch {
      const local = validateLayoutLocal(s.room.dimensions, placements, MIN_CLEARANCE_CM, s.room.openings ?? []);
      set({
        activePlacements: placements,
        activeFeasible: local.feasible,
        activeViolations: local.violations,
        usingRemoteValidation: false,
      });
    } finally {
      set({ validating: false });
      const state = get();
      const version: LayoutVersion = {
        id: newId("v"),
        label: note,
        createdAt: Date.now(),
        placements: state.activePlacements,
        feasible: state.activeFeasible,
        violations: state.activeViolations,
        note,
      };
      set({ versions: [version, ...state.versions] });
    }
  },

  applyCommand: async (text) => {
    const s = get();
    const knownLabels = s.activePlacements.map((p) => p.label);
    const action = parseCommand(text, knownLabels);
    const summary = describeAction(action);

    if (action.kind === "unknown") {
      set({ commandLog: [{ id: newId("cmd"), text, result: `Not recognized — try "move the sofa to the left wall".`, ok: false }, ...s.commandLog] });
      return;
    }

    let nextPlacements = [...s.activePlacements];

    if (action.kind === "remove") {
      nextPlacements = nextPlacements.filter((p) => p.label !== action.label);
    } else if (action.kind === "rotate") {
      nextPlacements = nextPlacements.map((p) =>
        p.label === action.label ? { ...p, rotation_deg: (((p.rotation_deg + 90) % 360) as Placement["rotation_deg"]) } : p
      );
    } else if (action.kind === "move" && s.room) {
      const [lengthCm, widthCm] = roomDimensionsCm(s.room.dimensions);
      nextPlacements = nextPlacements.map((p) => {
        if (p.label !== action.label) return p;
        const w = p.rotation_deg === 90 || p.rotation_deg === 270 ? p.depth_cm : p.width_cm;
        const d = p.rotation_deg === 90 || p.rotation_deg === 270 ? p.width_cm : p.depth_cm;
        switch (action.target) {
          case "left-wall":
            return { ...p, x_cm: 10, y_cm: p.y_cm };
          case "right-wall":
            return { ...p, x_cm: lengthCm - w - 10, y_cm: p.y_cm };
          case "back-wall":
            return { ...p, x_cm: p.x_cm, y_cm: 10 };
          case "front-wall":
          case "window":
            return { ...p, x_cm: p.x_cm, y_cm: widthCm - d - 10 };
          case "center":
            return { ...p, x_cm: (lengthCm - w) / 2, y_cm: (widthCm - d) / 2 };
          default:
            return p;
        }
      });
    } else if (action.kind === "add") {
      const [w, d] = defaultFootprint(action.itemType);
      const label = `${action.itemType.charAt(0).toUpperCase()}${action.itemType.slice(1)} ${nextPlacements.length + 1}`;
      nextPlacements.push({
        item_id: newId("item"),
        label,
        x_cm: 20,
        y_cm: 20,
        width_cm: w,
        depth_cm: d,
        rotation_deg: 0,
      });
    }

    await get().revalidateActive(nextPlacements, summary);
    const latest = get();
    set({
      commandLog: [
        {
          id: newId("cmd"),
          text,
          result: latest.activeFeasible ? `Applied — ${summary}` : `Applied with issues: ${latest.activeViolations[0] ?? ""}`,
          ok: latest.activeFeasible,
        },
        ...s.commandLog,
      ],
    });
  },

  restoreVersion: (versionId) => {
    const s = get();
    const version = s.versions.find((v) => v.id === versionId);
    if (!version) return;
    set({
      activePlacements: version.placements,
      activeFeasible: version.feasible,
      activeViolations: version.violations,
    });
  },

  reset: () => {
    get().clearPhotos();
    set({
      step: "input",
      draftDimensions: DEFAULT_DIMENSIONS,
      draftRoomType: "Bedroom",
      draftTheme: "Modern",
      draftOccasion: "",
      draftBudget: "",
      draftFurnitureNeeds: ["bed", "wardrobe"],
      photoFiles: [],
      photoPreviewUrls: [],
      room: null,
      furniture: [],
      openings: [],
      openingsError: null,
      chosenProducts: {},
      creating: false,
      createError: null,
      candidates: [],
      rankedLayouts: [],
      selectedLayoutId: null,
      activePlacements: [],
      activeFeasible: true,
      activeViolations: [],
      commandLog: [],
      versions: [],
    });
  },
}));
