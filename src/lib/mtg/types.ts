export type ManaColor = "W" | "U" | "B" | "R" | "G";

export type PowerPreset = "battlecruiser" | "focused" | "high" | "cooked";
export type BracketTag = "R" | "S" | "P" | "O" | "C" | "E" | "B";

export type CardRole =
  | "commander"
  | "land"
  | "ramp"
  | "draw"
  | "interaction"
  | "wipe"
  | "protection"
  | "synergy";

export type CardImageSet = {
  normal: string;
  png: string;
  artCrop: string;
};

export type CardSummary = {
  id: string;
  name: string;
  slug: string;
  manaCost: string | null;
  typeLine: string;
  oracleText: string | null;
  colorIdentity: ManaColor[];
  colors: ManaColor[];
  cmc: number;
  imageUris: CardImageSet;
  edhrecRank: number | null;
  legalCommander: boolean;
  isBasicLand: boolean;
  layout: string;
};

export type DeckEntry = CardSummary & {
  quantity: number;
  role: CardRole;
  notes?: string;
};

export type DeckValidation = {
  size: number;
  isComplete: boolean;
  hasCommander: boolean;
  bannedCards: string[];
  offColorCards: string[];
  duplicates: string[];
  warnings: string[];
};

export type TagOption = {
  label: string;
  slug: string;
};

export type CommanderOption = Pick<
  CardSummary,
  "id" | "name" | "slug" | "typeLine" | "oracleText" | "colorIdentity" | "colors" | "imageUris"
> & {
  source: "scryfall" | "edhrec-color";
  inclusion?: number;
};

export type EdhrecCardCandidate = {
  name: string;
  header: string;
  synergy: number;
  inclusion: number;
};

export type CommanderMeta = {
  description: string;
  tags: TagOption[];
  cards: EdhrecCardCandidate[];
  comboIdeas: string[];
  averageTypeDistribution: Array<{ label: string; value: number; color: string }>;
  spellbook: SpellbookCardInsight | null;
};

export type SpellbookCardInsight = {
  variantCount: number;
  gameChanger: boolean;
  tutor: boolean;
  massLandDenial: boolean;
  extraTurn: boolean;
  keywords: string[];
  features: string[];
};

export type SpellbookComboPreview = {
  id: string;
  uses: string[];
  bracketTag: BracketTag;
  description: string;
  prerequisites: string;
  speed?: number;
};

export type SpellbookDeckEstimate = {
  bracketTag: BracketTag;
  bracketLabel: string;
  gameChangerCards: string[];
  massLandDenialCards: string[];
  extraTurnCards: string[];
  comboCount: number;
  twoCardComboCount: number;
  lockComboCount: number;
  extraTurnComboCount: number;
  comboHighlights: SpellbookComboPreview[];
};

export type CommanderMechanicInsight = {
  primer: string;
  signatureMechanics: string[];
  playPatterns: string[];
};

export type GeneratedDeck = {
  commander: CommanderOption;
  focusTag: TagOption | null;
  powerPreset: PowerPreset;
  entries: DeckEntry[];
  validation: DeckValidation;
  buildNotes: string[];
  spellbookEstimate: SpellbookDeckEstimate | null;
};
