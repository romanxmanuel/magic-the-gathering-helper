import { MANA_COLORS } from "@/lib/constants";
import type { ManaColor } from "@/lib/types";

export function toEdhrecSlug(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeColors(colors: string[]) {
  const normalized = colors
    .map((color) => color.toUpperCase())
    .filter((color): color is ManaColor => MANA_COLORS.includes(color as ManaColor));

  return MANA_COLORS.filter((color) => normalized.includes(color));
}

export function colorIdentityLabel(colors: ManaColor[]) {
  return colors.length ? colors.join("") : "Colorless";
}

export function isColorSubset(cardColors: ManaColor[], commanderColors: ManaColor[]) {
  if (!commanderColors.length) {
    return true;
  }

  return cardColors.every((color) => commanderColors.includes(color));
}
