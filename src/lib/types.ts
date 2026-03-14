export type ManaColor = "W" | "U" | "B" | "R" | "G" | "C";

export type CommanderBracket = 1 | 2 | 3 | 4 | 5;

export type DeckRole =
  | "land"
  | "ramp"
  | "draw"
  | "interaction"
  | "wipe"
  | "protection"
  | "game-changer"
  | "combo"
  | "synergy";

export interface CommanderOption {
  name: string;
  slug: string;
  image: string;
  colors: ManaColor[];
  deckCount?: number;
  salt?: number;
  rank?: number;
  source: "edhrec" | "scryfall";
}

export interface DeckCard {
  id: string;
  name: string;
  quantity: number;
  section: string;
  typeLine: string;
  oracleText: string;
  manaValue: number;
  colorIdentity: ManaColor[];
  image: string;
  normalImage: string;
  scryfallUri?: string;
  edhrecUri?: string;
  spellbookUri?: string;
  salt?: number;
  synergy?: number;
  inclusion?: number;
  priceUsd?: number | null;
  gameChanger: boolean;
  legalCommander: boolean;
  combos: boolean;
  roles: DeckRole[];
  source: string;
}

export interface DeckStats {
  deckSize: number;
  landCount: number;
  rampCount: number;
  drawCount: number;
  interactionCount: number;
  protectionCount: number;
  averageManaValue: number;
  totalPriceUsd: number;
  gameChangerCount: number;
  comboEnabledCount: number;
}

export interface BuiltDeck {
  commander: DeckCard;
  cards: DeckCard[];
  colors: ManaColor[];
  bracket: CommanderBracket;
  chosenFocus: string;
  popularThemes: string[];
  stats: DeckStats;
  notes: string[];
  sources: string[];
  generatedAt: string;
}
