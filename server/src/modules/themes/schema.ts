import Ajv2020, { type Ajv2020 as Ajv2020Class, type ErrorObject } from "ajv/dist/2020.js";

const AjvCtor = Ajv2020 as unknown as typeof Ajv2020Class;
const ajv = new AjvCtor({ allErrors: true });

export interface ThemeColors {
  bgPrimary: string;
  bgSecondary: string;
  bgPanel: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  accentHover: string;
  border: string;
  danger: string;
}

export interface ThemeTypography {
  fontFamilySans: string;
  fontFamilyHeading: string;
  fontFamilyMono: string;
}

export interface ThemeConfigInput {
  key: string;
  name: string;
  description?: string;
  colors: ThemeColors;
  typography: ThemeTypography;
  borderRadius: string;
  customProperties?: Record<string, string>;
}

export interface ThemeConfig extends ThemeConfigInput {
  builtin?: boolean;
}

const HEX_COLOR_REGEX = "^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$";

export const themeJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  required: ["key", "name", "colors", "typography", "borderRadius"],
  additionalProperties: false,
  properties: {
    key: {
      type: "string",
      pattern: "^[a-z0-9_-]{2,50}$",
    },
    name: {
      type: "string",
      minLength: 1,
      maxLength: 60,
    },
    description: {
      type: "string",
      maxLength: 200,
    },
    colors: {
      type: "object",
      required: [
        "bgPrimary",
        "bgSecondary",
        "bgPanel",
        "textPrimary",
        "textSecondary",
        "accent",
        "accentHover",
        "border",
        "danger",
      ],
      additionalProperties: false,
      properties: {
        bgPrimary: { type: "string", pattern: HEX_COLOR_REGEX },
        bgSecondary: { type: "string", pattern: HEX_COLOR_REGEX },
        bgPanel: { type: "string", pattern: HEX_COLOR_REGEX },
        textPrimary: { type: "string", pattern: HEX_COLOR_REGEX },
        textSecondary: { type: "string", pattern: HEX_COLOR_REGEX },
        accent: { type: "string", pattern: HEX_COLOR_REGEX },
        accentHover: { type: "string", pattern: HEX_COLOR_REGEX },
        border: { type: "string", pattern: HEX_COLOR_REGEX },
        danger: { type: "string", pattern: HEX_COLOR_REGEX },
      },
    },
    typography: {
      type: "object",
      required: ["fontFamilySans", "fontFamilyHeading", "fontFamilyMono"],
      additionalProperties: false,
      properties: {
        fontFamilySans: { type: "string", minLength: 1 },
        fontFamilyHeading: { type: "string", minLength: 1 },
        fontFamilyMono: { type: "string", minLength: 1 },
      },
    },
    borderRadius: {
      type: "string",
      pattern: "^[0-9]+(px|rem|em|%)$",
    },
    customProperties: {
      type: "object",
      additionalProperties: { type: "string" },
    },
  },
};

const compiledValidator = ajv.compile<ThemeConfigInput>(themeJsonSchema);

export interface ValidationSuccess {
  ok: true;
  theme: ThemeConfigInput;
}

export interface ValidationErrorItem {
  path: string;
  message: string;
}

export interface ValidationFailure {
  ok: false;
  errors: ValidationErrorItem[];
}

export type ThemeValidationResult = ValidationSuccess | ValidationFailure;

function formatAjvError(err: ErrorObject): ValidationErrorItem {
  const path = err.instancePath
    ? err.instancePath.replace(/^\//, "").replace(/\//g, ".")
    : (err.params as { missingProperty?: string }).missingProperty ?? "theme";
  return {
    path,
    message: err.message ?? "Invalid value",
  };
}

export function validateThemeConfig(input: unknown): ThemeValidationResult {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return {
      ok: false,
      errors: [{ path: "theme", message: "Theme configuration must be an object" }],
    };
  }

  const valid = compiledValidator(input);
  if (!valid && compiledValidator.errors) {
    return {
      ok: false,
      errors: compiledValidator.errors.map(formatAjvError),
    };
  }

  return {
    ok: true,
    theme: input as ThemeConfigInput,
  };
}
