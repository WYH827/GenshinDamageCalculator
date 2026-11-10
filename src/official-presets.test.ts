import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { officialIndexSchema, parseOfficialPreset } from "./official-presets";
import { newProject, character } from "./model";
describe("official preset library", () => {
  it("validates the committed index and every listed file; no unregistered JSON files", () => {
    const root = resolve("public/presets"),
      index = officialIndexSchema.parse(
        JSON.parse(readFileSync(resolve(root, "index.json"), "utf8")),
      );
    for (const entry of index.presets)
      expect(() =>
        parseOfficialPreset(
          entry,
          JSON.parse(readFileSync(resolve(root, entry.file), "utf8")),
        ),
      ).not.toThrow();
    const files = ["方案预设", "角色", "武器"].flatMap((folder) =>
      readdirSync(resolve(root, folder))
        .filter((f) => f.endsWith(".json"))
        .map((f) => `${folder}/${f}`),
    );
    expect([...index.presets.map((p) => p.file)].sort()).toEqual(files.sort());
  });
  it("rejects path traversal, external paths, duplicate IDs and wrong file types", () => {
    const entry = {
      id: "x",
      kind: "character",
      name: "角色",
      file: "角色/test.json",
    };
    for (const file of [
      "../secret.json",
      "角色/../x.json",
      "https://example.com/p.json",
      "武器/test.json",
    ])
      expect(() =>
        officialIndexSchema.parse({
          version: 1,
          presets: [{ ...entry, file }],
        }),
      ).toThrow();
    expect(() =>
      officialIndexSchema.parse({ version: 1, presets: [entry, entry] }),
    ).toThrow();
    const valid = officialIndexSchema.parse({ version: 1, presets: [entry] })
      .presets[0];
    expect(
      parseOfficialPreset(valid, {
        id: "c",
        kind: "character",
        name: "角色",
        data: character(),
      }).kind,
    ).toBe("character");
    expect(() => parseOfficialPreset(valid, newProject())).toThrow();
  });
});
