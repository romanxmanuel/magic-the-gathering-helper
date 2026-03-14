import type { ManaColor } from "@/lib/mtg/types";

export const COLOR_NAME_BY_SYMBOL: Record<ManaColor, string> = {
  W: "White",
  U: "Blue",
  B: "Black",
  R: "Red",
  G: "Green",
};

export const BASIC_LAND_BY_COLOR: Record<ManaColor, string> = {
  W: "Plains",
  U: "Island",
  B: "Swamp",
  R: "Mountain",
  G: "Forest",
};

export const COLOR_IDENTITY_SLUGS: Record<string, string> = {
  C: "colorless",
  W: "mono-white",
  U: "mono-blue",
  B: "mono-black",
  R: "mono-red",
  G: "mono-green",
  WU: "azorius",
  UB: "dimir",
  BR: "rakdos",
  RG: "gruul",
  GW: "selesnya",
  WB: "orzhov",
  UR: "izzet",
  BG: "golgari",
  RW: "boros",
  GU: "simic",
  WUB: "esper",
  UBR: "grixis",
  BRG: "jund",
  RGW: "naya",
  GWU: "bant",
  WBG: "abzan",
  URW: "jeskai",
  BGU: "sultai",
  RWB: "mardu",
  GUR: "temur",
  UBRG: "sans-white",
  BRGW: "sans-blue",
  RGWU: "sans-black",
  GWUB: "sans-red",
  WUBR: "sans-green",
  WUBRG: "five-color",
};

export const ORDERED_COLORS: ManaColor[] = ["W", "U", "B", "R", "G"];

export function normalizeColorIdentity(colors: string[] | undefined | null): ManaColor[] {
  return ORDERED_COLORS.filter((color) => colors?.includes(color));
}

export function colorIdentityKey(colors: ManaColor[]) {
  if (colors.length === 0) {
    return "C";
  }

  return ORDERED_COLORS.filter((color) => colors.includes(color)).join("");
}

export function getEdhrecColorSlug(colors: ManaColor[]) {
  return COLOR_IDENTITY_SLUGS[colorIdentityKey(colors)] ?? null;
}

export function isSubsetOfColorIdentity(cardColors: ManaColor[], commanderColors: ManaColor[]) {
  return cardColors.every((color) => commanderColors.includes(color));
}

export function formatColorIdentity(colors: ManaColor[]) {
  return colors.length === 0 ? "Colorless" : colors.map((color) => COLOR_NAME_BY_SYMBOL[color]).join(" / ");
}
