import type { CommanderBracket, ManaColor } from "@/lib/types";

export const MANA_COLORS: ManaColor[] = ["W", "U", "B", "R", "G", "C"];

export const BASIC_LANDS_BY_COLOR: Record<ManaColor, string> = {
  W: "Plains",
  U: "Island",
  B: "Swamp",
  R: "Mountain",
  G: "Forest",
  C: "Wastes",
};

export const BRACKET_DETAILS: Record<
  CommanderBracket,
  { name: string; summary: string }
> = {
  1: {
    name: "Bracket 1 - Exhibition",
    summary: "Very social games. Avoids Game Changers and sharp combo pressure.",
  },
  2: {
    name: "Bracket 2 - Core",
    summary: "Upgraded casual Commander with stable mana and cleaner interaction.",
  },
  3: {
    name: "Bracket 3 - Upgraded",
    summary: "Tuned casual. Allows a few sharper cards while staying table-friendly.",
  },
  4: {
    name: "Bracket 4 - Optimized",
    summary: "Powerful, focused Commander with stronger mana and combo-adjacent pressure.",
  },
  5: {
    name: "Bracket 5 - cEDH",
    summary: "Competitive Commander assumptions. Prioritizes efficiency and fast closers.",
  },
};

export const SECTION_ORDER = [
  "High Synergy Cards",
  "Top Cards",
  "New Cards",
  "Game Changers",
  "Creatures",
  "Instants",
  "Sorceries",
  "Utility Artifacts",
  "Enchantments",
  "Planeswalkers",
  "Mana Artifacts",
  "Utility Lands",
  "Lands",
  "Custom Add",
  "Auto Basics",
] as const;
