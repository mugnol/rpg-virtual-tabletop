export interface PredefinedAvatar {
  key: string;
  name: string;
  category: "class" | "monster" | "role";
  url: string;
}

export const PREDEFINED_AVATARS: PredefinedAvatar[] = [
  // Classes
  { key: "peasant", name: "Peasant (Level 0)", category: "class", url: "/avatars/peasant.svg" },
  { key: "fighter", name: "Fighter", category: "class", url: "/avatars/fighter.svg" },
  { key: "priest", name: "Priest", category: "class", url: "/avatars/priest.svg" },
  { key: "thief", name: "Thief", category: "class", url: "/avatars/thief.svg" },
  { key: "wizard", name: "Wizard", category: "class", url: "/avatars/wizard.svg" },

  // Generic Monster Roles
  { key: "mook", name: "Mook", category: "role", url: "/avatars/mook.svg" },
  { key: "soldier", name: "Soldier", category: "role", url: "/avatars/soldier.svg" },
  { key: "striker", name: "Striker", category: "role", url: "/avatars/striker.svg" },
  { key: "tank", name: "Tank", category: "role", url: "/avatars/tank.svg" },
  { key: "controller", name: "Controller", category: "role", url: "/avatars/controller.svg" },
  { key: "legendary", name: "Legendary", category: "role", url: "/avatars/legendary.svg" },

  // Monster Categories & Compendium
  { key: "goblin", name: "Goblin", category: "monster", url: "/avatars/goblin.svg" },
  { key: "skeleton", name: "Skeleton", category: "monster", url: "/avatars/skeleton.svg" },
  { key: "zombie", name: "Zombie", category: "monster", url: "/avatars/zombie.svg" },
  { key: "dragon", name: "Dragon", category: "monster", url: "/avatars/dragon.svg" },
  { key: "beast", name: "Beast", category: "monster", url: "/avatars/beast.svg" },
  { key: "demon", name: "Demon", category: "monster", url: "/avatars/demon.svg" },
  { key: "aberration", name: "Aberration", category: "monster", url: "/avatars/aberration.svg" },
  { key: "undead", name: "Undead", category: "monster", url: "/avatars/undead.svg" },
];

export function getPredefinedAvatars(): PredefinedAvatar[] {
  return PREDEFINED_AVATARS;
}

export function getPredefinedAvatar(key: string): PredefinedAvatar | undefined {
  return PREDEFINED_AVATARS.find((a) => a.key.toLowerCase() === key.toLowerCase());
}

export interface ResolveAvatarInput {
  type: string;
  avatarKey?: string | null;
  imageUrl?: string | null;
  characterClassId?: string | null;
  characterLevel?: number | null;
  monsterKey?: string | null;
  monsterRole?: string | null;
}

export function resolveTokenAvatar(input: ResolveAvatarInput): {
  avatarKey: string | null;
  imageUrl: string | null;
} {
  // 1. Explicit custom imageUrl provided
  if (input.imageUrl && input.imageUrl.trim().length > 0) {
    return {
      avatarKey: input.avatarKey ?? null,
      imageUrl: input.imageUrl.trim(),
    };
  }

  // 2. Explicit avatarKey provided
  if (input.avatarKey && input.avatarKey.trim().length > 0) {
    const matched = getPredefinedAvatar(input.avatarKey.trim());
    if (matched) {
      return {
        avatarKey: matched.key,
        imageUrl: matched.url,
      };
    }
    return {
      avatarKey: input.avatarKey.trim(),
      imageUrl: `/avatars/${input.avatarKey.trim().toLowerCase()}.svg`,
    };
  }

  // 3. Auto-assign for CHARACTER
  if (input.type === "CHARACTER") {
    if (input.characterLevel === 0 || !input.characterClassId) {
      return {
        avatarKey: "peasant",
        imageUrl: "/avatars/peasant.svg",
      };
    }
    const classKey = input.characterClassId.toLowerCase();
    const matched = getPredefinedAvatar(classKey);
    if (matched) {
      return {
        avatarKey: matched.key,
        imageUrl: matched.url,
      };
    }
    return {
      avatarKey: "peasant",
      imageUrl: "/avatars/peasant.svg",
    };
  }

  // 4. Auto-assign for MONSTER
  if (input.type === "MONSTER") {
    // Check monsterKey
    if (input.monsterKey) {
      const slug = input.monsterKey.toLowerCase();
      if (slug.includes("goblin")) return { avatarKey: "goblin", imageUrl: "/avatars/goblin.svg" };
      if (slug.includes("skeleton")) return { avatarKey: "skeleton", imageUrl: "/avatars/skeleton.svg" };
      if (slug.includes("zombie")) return { avatarKey: "zombie", imageUrl: "/avatars/zombie.svg" };
      if (slug.includes("dragon")) return { avatarKey: "dragon", imageUrl: "/avatars/dragon.svg" };
      if (slug.includes("demon") || slug.includes("devil") || slug.includes("balor") || slug.includes("imp")) {
        return { avatarKey: "demon", imageUrl: "/avatars/demon.svg" };
      }
      if (slug.includes("ghoul") || slug.includes("ghast") || slug.includes("wight") || slug.includes("wraith") || slug.includes("ghost") || slug.includes("lich") || slug.includes("mummy")) {
        return { avatarKey: "undead", imageUrl: "/avatars/undead.svg" };
      }
      if (slug.includes("wolf") || slug.includes("bear") || slug.includes("boar") || slug.includes("lion") || slug.includes("badger") || slug.includes("spider") || slug.includes("rat") || slug.includes("ape") || slug.includes("beast")) {
        return { avatarKey: "beast", imageUrl: "/avatars/beast.svg" };
      }
      if (slug.includes("aboleth") || slug.includes("cloaker") || slug.includes("mouther") || slug.includes("eye") || slug.includes("chuul")) {
        return { avatarKey: "aberration", imageUrl: "/avatars/aberration.svg" };
      }

      // Check direct avatar key match
      const matched = getPredefinedAvatar(slug);
      if (matched) {
        return {
          avatarKey: matched.key,
          imageUrl: matched.url,
        };
      }
    }

    // Check monsterRole
    if (input.monsterRole) {
      const roleKey = input.monsterRole.toLowerCase();
      const matched = getPredefinedAvatar(roleKey);
      if (matched) {
        return {
          avatarKey: matched.key,
          imageUrl: matched.url,
        };
      }
    }

    // Default monster avatar
    return {
      avatarKey: "soldier",
      imageUrl: "/avatars/soldier.svg",
    };
  }

  return {
    avatarKey: null,
    imageUrl: null,
  };
}
