import { describe, expect, it } from "vitest";
import { validateThemeConfig, type ThemeConfigInput } from "../../src/modules/themes/schema.js";

const validMedievalTheme: ThemeConfigInput = {
  key: "medieval",
  name: "Medieval Tavern",
  description: "Warm parchment and dark tavern aesthetic with aged gold accents",
  colors: {
    bgPrimary: "#181411",
    bgSecondary: "#26201b",
    bgPanel: "#302822",
    textPrimary: "#f5ece1",
    textSecondary: "#b8a898",
    accent: "#c99a3e",
    accentHover: "#dbae53",
    border: "#4a3e35",
    danger: "#b91c1c",
  },
  typography: {
    fontFamilySans: "'Cinzel', 'Trajan Pro', Georgia, serif",
    fontFamilyHeading: "'Cinzel Decorative', Georgia, serif",
    fontFamilyMono: "'Courier Prime', monospace",
  },
  borderRadius: "6px",
};

const validCyberpunkTheme: ThemeConfigInput = {
  key: "cyberpunk",
  name: "Cyberpunk Matrix",
  description: "High-contrast dark synth aesthetic with neon cyan and magenta accents",
  colors: {
    bgPrimary: "#050811",
    bgSecondary: "#0c1322",
    bgPanel: "#131b2e",
    textPrimary: "#e2f1ff",
    textSecondary: "#7ea3cc",
    accent: "#00f0ff",
    accentHover: "#3df3ff",
    border: "#1f2f4d",
    danger: "#ff0055",
  },
  typography: {
    fontFamilySans: "'Rajdhani', -apple-system, sans-serif",
    fontFamilyHeading: "'Orbitron', sans-serif",
    fontFamilyMono: "'Share Tech Mono', monospace",
  },
  borderRadius: "2px",
};

describe("Theme JSON Schema Validation (BR-52)", () => {
  it("validates a complete, compliant theme definition", () => {
    const res = validateThemeConfig(validMedievalTheme);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.theme.key).toBe("medieval");
      expect(res.theme.colors.accent).toBe("#c99a3e");
    }
  });

  it("validates the cyberpunk theme definition", () => {
    const res = validateThemeConfig(validCyberpunkTheme);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.theme.key).toBe("cyberpunk");
      expect(res.theme.colors.accent).toBe("#00f0ff");
    }
  });

  it("rejects theme with invalid hex colors", () => {
    const invalid = {
      ...validMedievalTheme,
      colors: {
        ...validMedievalTheme.colors,
        accent: "not-a-color",
      },
    };
    const res = validateThemeConfig(invalid);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.some((e) => e.path.includes("accent"))).toBe(true);
    }
  });

  it("rejects theme with missing required colors", () => {
    const invalid = {
      ...validMedievalTheme,
      colors: {
        bgPrimary: "#111",
        bgSecondary: "#222",
        // missing others
      },
    };
    const res = validateThemeConfig(invalid);
    expect(res.ok).toBe(false);
  });

  it("rejects theme with invalid key slug", () => {
    const invalid = {
      ...validMedievalTheme,
      key: "INVALID KEY WITH SPACES!",
    };
    const res = validateThemeConfig(invalid);
    expect(res.ok).toBe(false);
  });

  it("rejects theme with invalid borderRadius format", () => {
    const invalid = {
      ...validMedievalTheme,
      borderRadius: "ten-pixels",
    };
    const res = validateThemeConfig(invalid);
    expect(res.ok).toBe(false);
  });

  it("rejects non-object or null input", () => {
    expect(validateThemeConfig(null).ok).toBe(false);
    expect(validateThemeConfig("string").ok).toBe(false);
    expect(validateThemeConfig([]).ok).toBe(false);
  });
});
