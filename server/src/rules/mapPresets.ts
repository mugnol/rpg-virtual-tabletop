export interface MapPreset {
  key: string;
  name: string;
  category: "dungeon" | "wilderness" | "settlement";
  url: string;
  description: string;
}

export const MAP_PRESETS: MapPreset[] = [
  {
    key: "cave",
    name: "Natural Cave",
    category: "dungeon",
    url: "/map-presets/cave.svg",
    description: "Natural subterranean cavern with rough rock crevices and stalagmites (pg. 131).",
  },
  {
    key: "tomb",
    name: "Ancient Tomb",
    category: "dungeon",
    url: "/map-presets/tomb.svg",
    description: "Stone burial crypt featuring sarcophagi and ancient ceremonial pillars (pg. 131).",
  },
  {
    key: "deep-tunnels",
    name: "Deep Tunnels",
    category: "dungeon",
    url: "/map-presets/deep-tunnels.svg",
    description: "Abyssal subterranean labyrinth with glowing mineral veins and dark chasms (pg. 131).",
  },
  {
    key: "ruins",
    name: "Crumbling Ruins",
    category: "dungeon",
    url: "/map-presets/ruins.svg",
    description: "Ancient collapsed masonry with mossy flagstones and broken column bases (pg. 131).",
  },
  {
    key: "overland-hex",
    name: "Overland Hex Map",
    category: "wilderness",
    url: "/map-presets/overland-hex.svg",
    description: "Overland wilderness exploration canvas with hexes, forests, and winding rivers (pg. 132).",
  },
  {
    key: "settlement",
    name: "Settlement District",
    category: "settlement",
    url: "/map-presets/settlement.svg",
    description: "Cobblestone streets, tavern quarters, and town square marketplace (pg. 134).",
  },
];

export function getMapPresets(): MapPreset[] {
  return MAP_PRESETS;
}

export function getMapPreset(key: string): MapPreset | undefined {
  return MAP_PRESETS.find((p) => p.key.toLowerCase() === key.toLowerCase());
}

export interface ResolveMapPresetInput {
  presetKey?: string | null;
  imageUrl?: string | null;
}

export function resolveMapPreset(input: ResolveMapPresetInput): {
  presetKey: string | null;
  imageUrl: string | null;
} {
  if (input.imageUrl && input.imageUrl.trim().length > 0) {
    return {
      presetKey: input.presetKey ?? null,
      imageUrl: input.imageUrl.trim(),
    };
  }

  if (input.presetKey && input.presetKey.trim().length > 0) {
    const matched = getMapPreset(input.presetKey.trim());
    if (matched) {
      return {
        presetKey: matched.key,
        imageUrl: matched.url,
      };
    }
    return {
      presetKey: input.presetKey.trim(),
      imageUrl: `/map-presets/${input.presetKey.trim().toLowerCase()}.svg`,
    };
  }

  return {
    presetKey: null,
    imageUrl: null,
  };
}
