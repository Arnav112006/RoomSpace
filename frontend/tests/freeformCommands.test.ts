import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { commandCandidates, parseCommand, splitClauses } from "@/shared/lib/commandParser";
import { ACCEPT_SCORE, decide, SUGGEST_SCORE } from "@/shared/lib/commandModel";
import { api } from "@/shared/lib/api";
import { useRoomStore } from "@/shared/store/roomStore";
import { buildRoom } from "@/shared/lib/room3d";
import type { Placement, RoomResponse } from "@/shared/types";

const LABELS = ["Bed", "Wardrobe", "Sofa"];

describe("fixture commands", () => {
  it.each([
    ["remove hanging light", { kind: "fixture", fixture: "pendant", on: false }],
    ["add fan", { kind: "fixture", fixture: "fan", on: true }],
    ["add a ceiling fan", { kind: "fixture", fixture: "fan", on: true }],
    ["get rid of the ceiling fan", { kind: "fixture", fixture: "fan", on: false }],
    ["change the light to a chandelier", { kind: "fixture", fixture: "pendant", on: true, variant: "chandelier" }],
    ["I want a paper lantern light", { kind: "fixture", fixture: "pendant", on: true, variant: "globe" }],
    ["remove the rug", { kind: "fixture", fixture: "rug", on: false }],
    ["no plants", { kind: "fixture", fixture: "plants", on: false }],
    ["i don't need the carpet", { kind: "fixture", fixture: "rug", on: false }],
    ["I do not want a ceiling fan", { kind: "fixture", fixture: "fan", on: false }],
    ["I need a rug", { kind: "fixture", fixture: "rug", on: true }],
    ["add a floor lamp", { kind: "fixture", fixture: "floorLamp", on: true }],
    ["get rid of the lamp dangling from the ceiling", { kind: "fixture", fixture: "pendant", on: false }],
  ])("%s", (text, expected) => {
    expect(parseCommand(text, LABELS)).toMatchObject(expected);
  });

  it("doesn't confuse colours and furniture with fixtures", () => {
    expect(parseCommand("paint the walls light grey", LABELS)).toMatchObject({ kind: "colour", target: "walls" });
    expect(parseCommand("make the floor light wood", LABELS)).toMatchObject({ kind: "floor" });
    expect(parseCommand("remove the wardrobe", LABELS)).toMatchObject({ kind: "remove", label: "Wardrobe" });
  });
});

describe("splitClauses", () => {
  it.each([
    ["remove hanging light and add fan", ["remove hanging light", "add fan"]],
    ["paint the walls beige, then make the sofa navy", ["paint the walls beige", "make the sofa navy"]],
    ["replace the hanging light with a ceiling fan", ["remove hanging light", "add a ceiling fan"]],
    ["make the sofa black and white", ["make the sofa black and white"]],
    ["move the bed to the left wall", ["move the bed to the left wall"]],
  ])("%s", (text, clauses) => {
    expect(splitClauses(text)).toEqual(clauses);
  });
});

describe("candidate commands for the local model", () => {
  it("are all understood by the rules, so the model can only choose allowed commands", () => {
    const candidates = commandCandidates(LABELS);
    expect(candidates.length).toBeGreaterThan(50);
    for (const c of candidates) expect(parseCommand(c, LABELS).kind, c).not.toBe("unknown");
  });
});

describe("decide", () => {
  it("applies confident matches, suggests vague ones and drops unrelated text", () => {
    expect(decide([{ candidate: "rotate the Bed", score: 0.84 }, { candidate: "remove the Bed", score: 0.71 }]))
      .toEqual({ status: "apply", command: "rotate the Bed", score: 0.84 });
    expect(decide([{ candidate: "add plants", score: 0.4 }, { candidate: "remove the plants", score: 0.36 }]).status).toBe("suggest");
    // Confident but too close to the runner-up: ask instead of guessing.
    expect(decide([{ candidate: "add a rug", score: 0.6 }, { candidate: "remove the rug", score: 0.58 }]).status).toBe("suggest");
    expect(decide([{ candidate: "remove the Bed", score: 0.21 }]).status).toBe("none");
    expect(ACCEPT_SCORE).toBeGreaterThan(SUGGEST_SCORE);
  });

  it("never turns one kind of change into another", () => {
    const addSofa = [{ candidate: "add a sofa near the window", score: 0.7 }, { candidate: "add a desk near the window", score: 0.5 }];
    expect(decide(addSofa, "shift the couch next to the window")).toMatchObject({ status: "suggest" });
    expect(decide(addSofa, "I'd love a couch by the window")).toMatchObject({ status: "apply" });
    expect(decide([{ candidate: "rotate the Bed", score: 0.84 }], "spin the bed around").status).toBe("apply");
  });
});

describe("store: compound and free-form commands", () => {
  const BED: Placement = { item_id: "bed-1", label: "Bed", x_cm: 10, y_cm: 10, width_cm: 150, depth_cm: 200, rotation_deg: 0 };
  const ROOM = { id: "r", dimensions: { length: 12, width: 10, unit: "ft" }, room_type: "Bedroom", theme: "Modern", openings: [], furniture: [] } as unknown as RoomResponse;

  beforeEach(() => {
    useRoomStore.getState().reset();
    useRoomStore.setState({ room: ROOM, activePlacements: [BED], activeFeasible: true });
  });
  afterEach(() => vi.restoreAllMocks());

  it("runs both halves of 'remove hanging light and add fan'", async () => {
    await useRoomStore.getState().applyCommand("remove hanging light and add fan");
    const s = useRoomStore.getState();
    expect(s.styleOverrides.fixtures).toEqual({ pendant: "none", fan: true });
    expect(s.commandLog.map((c) => [c.text, c.ok])).toEqual([["add fan", true], ["remove hanging light", true]]);
  });

  it("asks the local model when the rules don't understand, and applies a confident match", async () => {
    const spy = vi.spyOn(api, "interpretCommand").mockResolvedValue({
      matches: [{ candidate: "add a ceiling fan", score: 0.86 }, { candidate: "remove the ceiling fan", score: 0.74 }],
    });
    await useRoomStore.getState().applyCommand("put something on the ceiling to keep me cool");
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][1]).toContain("add a ceiling fan");
    const [entry] = useRoomStore.getState().commandLog;
    expect(entry.text).toBe("put something on the ceiling to keep me cool");
    expect(entry.result).toMatch(/^Understood as “add a ceiling fan” · Applied/);
    expect(useRoomStore.getState().styleOverrides.fixtures?.fan).toBe(true);
  });

  it("only suggests on a weak match, and changes nothing", async () => {
    vi.spyOn(api, "interpretCommand").mockResolvedValue({ matches: [{ candidate: "add plants", score: 0.4 }] });
    await useRoomStore.getState().applyCommand("some greenery please");
    expect(useRoomStore.getState().commandLog[0]).toMatchObject({ ok: false, result: "Not sure — did you mean “add plants”?" });
    expect(useRoomStore.getState().styleOverrides.fixtures).toBeUndefined();
  });

  it("rotates about the centre and keeps the piece inside the room", async () => {
    await useRoomStore.getState().applyCommand("spin the bed around");
    const [bed] = useRoomStore.getState().activePlacements;
    expect(bed.rotation_deg).toBe(90);
    // 150×200 at (10,10) → 200×150 centred on (85,110), pushed back inside the walls.
    expect(bed).toMatchObject({ x_cm: 0, y_cm: 35 });
  });

  it("falls back to the rules' message when the model isn't available", async () => {
    vi.spyOn(api, "interpretCommand").mockRejectedValue(new Error("503"));
    await useRoomStore.getState().applyCommand("bake a cake");
    expect(useRoomStore.getState().commandLog[0].result).toMatch(/^Not recognized/);
  });
});

describe("3D fixtures", () => {
  it("adds a spinning ceiling fan, removes the hanging light, rug and plants", () => {
    const base = buildRoom(366, 305, [], [], "bohemian");
    expect(base.lamps.length).toBeGreaterThan(0);
    expect(base.rug).not.toBeNull();
    expect(base.decor.some((d) => d.kind.toLowerCase().includes("plant"))).toBe(true);

    const built = buildRoom(366, 305, [], [], "bohemian", {
      items: {}, fixtures: { pendant: "none", fan: true, rug: false, plants: false },
    });
    expect(built.spinners).toHaveLength(1);
    expect(built.lamps).toHaveLength(1); // the fan's light kit only
    expect(built.rug).toBeNull();
    expect(built.decor.some((d) => d.kind.toLowerCase().includes("plant"))).toBe(false);
    // Blades stay inside the room.
    const b = new THREE.Box3().setFromObject(built.spinners[0]);
    expect(b.min.x).toBeGreaterThan(0);
    expect(b.max.x).toBeLessThan(3.66);
    base.dispose();
    built.dispose();
  });
});
