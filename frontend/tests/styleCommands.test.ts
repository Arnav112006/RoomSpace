import { beforeEach, describe, expect, it } from "vitest";
import * as THREE from "three";
import { useRoomStore } from "@/shared/store/roomStore";
import { buildRoom } from "@/shared/lib/room3d";
import { NAMED_COLOURS } from "@/shared/lib/colours";
import type { Placement, RoomResponse, StyleOverrides } from "@/shared/types";

const SOFA: Placement = { item_id: "sofa-1", label: "Sofa", x_cm: 10, y_cm: 10, width_cm: 180, depth_cm: 90, rotation_deg: 0 };
const ROOM = {
  id: "r", dimensions: { length: 12, width: 10, unit: "ft" }, room_type: "Bedroom", theme: "Industrial",
  openings: [], furniture: [],
} as unknown as RoomResponse;

describe("appearance commands in the store", () => {
  beforeEach(() => {
    useRoomStore.getState().reset();
    useRoomStore.setState({ room: ROOM, activePlacements: [SOFA], activeFeasible: true });
  });

  it("paints walls, recolours furniture and changes the floor without touching the layout", async () => {
    const { applyCommand } = useRoomStore.getState();
    await applyCommand("change the colour of my walls to beige");
    await applyCommand("make the sofa navy");
    await applyCommand("make the floor dark wood");
    const s = useRoomStore.getState();
    expect(s.styleOverrides).toMatchObject({
      wall: NAMED_COLOURS.beige, floorKind: "oakPlanks", items: { "sofa-1": NAMED_COLOURS.navy },
    });
    expect(s.activePlacements).toEqual([SOFA]);
    expect(s.versions).toHaveLength(0); // appearance isn't a layout version
    expect(s.commandLog.map((c) => c.ok)).toEqual([true, true, true]);
    expect(s.commandLog[2].result).toBe("Applied — Paint the walls beige");
  });

  it("switches the 3D theme and resets colours on request", async () => {
    const { applyCommand } = useRoomStore.getState();
    await applyCommand("paint the walls sage");
    await applyCommand("make it bohemian");
    expect(useRoomStore.getState().viewTheme).toBe("Bohemian");
    await applyCommand("reset colours");
    expect(useRoomStore.getState().styleOverrides).toEqual({ items: {} });
  });

  it("uses the colours CLIP found in the photos, and can stop using them", () => {
    useRoomStore.setState({ styleSuggestion: { themes: [{ theme: "Scandinavian", score: 0.6 }], palette: [], wall: "#e2d3ba", floor: "#5c3e28" } });
    useRoomStore.getState().applyRoomColours(true);
    expect(useRoomStore.getState().styleOverrides).toMatchObject({ wall: "#e2d3ba", floor: "#5c3e28" });
    useRoomStore.getState().applyRoomColours(false);
    expect(useRoomStore.getState().styleOverrides.wall).toBeUndefined();
  });
});

describe("buildRoom with the user's colours", () => {
  const colourOf = (o: THREE.Object3D) => {
    const found = new Set<string>();
    o.traverse((c) => {
      if (c instanceof THREE.Mesh && c.material instanceof THREE.MeshStandardMaterial) found.add(`#${c.material.color.getHexString()}`);
    });
    return found;
  };

  it("paints over industrial brick and recolours just the chosen piece", () => {
    const overrides: StyleOverrides = { wall: "#e2d3ba", items: { "sofa-1": "#243b5a" } };
    const other: Placement = { ...SOFA, item_id: "sofa-2", label: "Sofa 2", y_cm: 200 };
    const built = buildRoom(366, 305, [], [{ placement: SOFA, category: "sofa" }, { placement: other, category: "sofa" }], "industrial", overrides);
    expect(colourOf(built.walls[0].group)).toContain("#e2d3ba");
    expect(colourOf(built.furniture[0])).toContain("#243b5a");
    expect(colourOf(built.furniture[1])).not.toContain("#243b5a");
    built.dispose();
  });
});
