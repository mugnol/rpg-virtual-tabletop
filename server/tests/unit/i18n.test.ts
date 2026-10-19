import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const localesDir = path.resolve(__dirname, "../../../client/src/locales");

function getLeaves(obj: Record<string, any>, prefix = ""): string[] {
  const leaves: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      leaves.push(...getLeaves(value, fullKey));
    } else {
      leaves.push(fullKey);
    }
  }
  return leaves.sort();
}

describe("Internationalization Resource Bundles (BR-59, BR-60)", () => {
  const enPath = path.join(localesDir, "en.json");
  const ptBrPath = path.join(localesDir, "pt-BR.json");

  it("loads both en.json and pt-BR.json files", () => {
    expect(fs.existsSync(enPath)).toBe(true);
    expect(fs.existsSync(ptBrPath)).toBe(true);
  });

  it("enforces 100% key parity between English and Brazilian Portuguese bundles", () => {
    const en = JSON.parse(fs.readFileSync(enPath, "utf-8"));
    const ptBr = JSON.parse(fs.readFileSync(ptBrPath, "utf-8"));

    const enKeys = getLeaves(en);
    const ptBrKeys = getLeaves(ptBr);

    expect(enKeys.length).toBeGreaterThan(0);
    expect(ptBrKeys).toEqual(enKeys);
  });

  it("ensures no empty translation values exist in either dictionary", () => {
    const en = JSON.parse(fs.readFileSync(enPath, "utf-8"));
    const ptBr = JSON.parse(fs.readFileSync(ptBrPath, "utf-8"));

    function checkNonEmpty(obj: Record<string, any>, name: string) {
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === "string") {
          expect(v.trim().length, `Empty value for key "${k}" in ${name}`).toBeGreaterThan(0);
        } else if (typeof v === "object" && v !== null) {
          checkNonEmpty(v, `${name}.${k}`);
        }
      }
    }

    checkNonEmpty(en, "en.json");
    checkNonEmpty(ptBr, "pt-BR.json");
  });
});
