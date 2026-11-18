import { describe, expect, it } from "vitest";
import { parseCommand } from "@/shared/lib/commandParser";
import { NAMED_COLOURS, parseColour, shadeHex } from "@/shared/lib/colours";

const LABELS = ["Bed", "Desk", "Wardrobe", "Sofa"];

describe("parseCommand", () => {
  it.each([
    ["Move the desk to the window", { kind: "move", label: "Desk", target: "window" }],
    ["move the sofa to the left wall", { kind: "move", label: "Sofa", target: "left-wall" }],
    ["Remove the wardrobe", { kind: "remove", label: "Wardrobe" }],
    ["Rotate the bed", { kind: "rotate", label: "Bed" }],
    ["Add a table near the window", { kind: "add", itemType: "table", near: "window" }],
    ["Add a chair near the door", { kind: "add", itemType: "chair", near: "door" }],
    ["get rid of the couch", { kind: "remove", label: "Sofa" }],
  ])("%s", (text, expected) => {
    expect(parseCommand(text, LABELS)).toMatchObject(expected);
  });

  it("reports commands it doesn't understand", () => {
    expect(parseCommand("make it cosy", LABELS).kind).toBe("unknown");
  });
});

describe("parseCommand — appearance", () => {
  it.each([
    ["change the colour of my walls to beige", { kind: "colour", target: "walls", colour: NAMED_COLOURS.beige, name: "beige" }],
    ["Paint the walls light grey", { kind: "colour", target: "walls", name: "light grey" }],
    ["walls #e8dcc4", { kind: "colour", target: "walls", colour: "#e8dcc4" }],
    ["make the sofa navy", { kind: "colour", target: "item", label: "Sofa", colour: NAMED_COLOURS.navy }],
    ["paint the wardrobe dark green", { kind: "colour", target: "item", label: "Wardrobe", name: "dark green" }],
    ["make the couch sky blue", { kind: "colour", target: "item", label: "Sofa", name: "sky blue" }],
    ["make the floor dark wood", { kind: "floor", floor: "oakPlanks", name: "dark wood" }],
    ["I want a concrete floor", { kind: "floor", floor: "concrete" }],
    ["change the flooring to herringbone parquet", { kind: "floor", floor: "herringbone" }],
    ["make the floor sage", { kind: "colour", target: "floor", colour: NAMED_COLOURS.sage }],
    ["make it industrial", { kind: "theme", theme: "Industrial" }],
    ["switch to a boho style", { kind: "theme", theme: "Bohemian" }],
    ["reset the colours", { kind: "reset-style" }],
  ])("%s", (text, expected) => {
    expect(parseCommand(text, LABELS)).toMatchObject(expected);
  });

  it("explains an unknown colour instead of guessing", () => {
    const action = parseCommand("paint the walls blorange", LABELS);
    expect(action.kind).toBe("unknown");
    expect(action.kind === "unknown" && action.hint).toMatch(/Not a colour I know/);
  });

  it("still treats layout commands as layout commands", () => {
    expect(parseCommand("move the sofa to the left wall", LABELS)).toMatchObject({ kind: "move", target: "left-wall" });
    expect(parseCommand("Remove the wardrobe", LABELS)).toMatchObject({ kind: "remove" });
    expect(parseCommand("Add a table near the window", LABELS)).toMatchObject({ kind: "add" });
  });
});

describe("parseColour", () => {
  it("prefers the longest name and applies light/dark", () => {
    expect(parseColour("sky blue")).toEqual({ hex: NAMED_COLOURS["sky blue"], name: "sky blue" });
    expect(parseColour("off white walls")?.name).toBe("off white");
    expect(parseColour("dark beige")?.hex).toBe(shadeHex(NAMED_COLOURS.beige, -0.35));
    expect(parseColour("pale sage")?.hex).toBe(shadeHex(NAMED_COLOURS.sage, 0.35));
    expect(parseColour("#abc")?.hex).toBe("#aabbcc");
    expect(parseColour("move the desk")).toBeNull();
  });
});
