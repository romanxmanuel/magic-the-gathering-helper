import type { ImageSet, SourceAudit } from "@/lib/games/shared/types";

export type YugiohFormatMode =
  | "open-lab"
  | "tcg-advanced"
  | "master-duel"
  | "edison"
  | "goat";

export type YugiohTurnPreference = "going-first" | "going-second";

export type YugiohBuildIntent =
  | "pure"
  | "hybrid"
  | "anti-meta"
  | "consistency-first"
  | "ceiling-first"
  | "blind-second"
  | "grind";

export type YugiohStrengthTarget = "casual" | "strong" | "tournament-level" | "degenerate";

export type YugiohDeckSection = "main" | "extra" | "side";

export type YugiohCardRole =
  | "starter"
  | "extender"
  | "searcher"
  | "payoff"
  | "engine-core"
  | "engine-support"
  | "hand-trap"
  | "board-breaker"
  | "grind-tool"
  | "brick-risk"
  | "side-tech"
  | "extra-toolbox";

export type YugiohConstraint =
  | "pure-only"
  | "avoid-floodgates"
  | "low-brick"
  | "fewer-hand-traps"
  | "limit-traps"
  | "low-extra-reliance"
  | "budget-aware";

export type YugiohCard = {
  id: number;
  name: string;
  slug: string;
  archetype: string | null;
  typeLine: string;
  desc: string;
  race: string | null;
  attribute: string | null;
  levelRankLink: number | null;
  atk: number | null;
  def: number | null;
  images: ImageSet;
  aliases: string[];
};

export type YugiohDeckEntry = {
  card: YugiohCard;
  quantity: number;
  section: YugiohDeckSection;
  roles: YugiohCardRole[];
  rationale?: string;
  locked?: boolean;
};

export type YugiohDeckSeed = {
  cardId: number;
  quantity: number;
  section: YugiohDeckSection;
};

export type YugiohArchetype = {
  id: string;
  name: string;
  slug: string;
  previewCardImageUrl: string | null;
  previewCardName: string | null;
};

export type YugiohThemeSelection = {
  query: string;
  resolvedArchetype: string | null;
  resolvedBossCards: string[];
  resolvedSupportCards: string[];
  inactiveBossCards: string[];
  inactiveSupportCards: string[];
};

export type YugiohMetaTarget = {
  archetype: string;
  weight: number;
};

export type YugiohMetaDeckSample = {
  deckName: string;
  deckUrl: string;
  tournamentName: string | null;
  placement: string | null;
  submitDateLabel: string | null;
};

export type YugiohMetaArchetypeStat = {
  name: string;
  count: number;
};

export type YugiohDeckVersionOption = {
  id: string;
  label: string;
  count: number;
  sampleDecks: YugiohMetaDeckSample[];
};

export type YugiohMetaSnapshot = {
  themeQuery: string;
  matchedDeckCount: number;
  fieldSampleSize: number;
  topFieldDecks: YugiohMetaArchetypeStat[];
  matchedDecks: YugiohMetaDeckSample[];
  deckVersions: YugiohDeckVersionOption[];
  selectedDeckVersion: string | null;
};

export type YugiohStructuralReadout = {
  consistency: number;
  synergy: number;
  pressure: number;
  adaptability: number;
  structuralIntegrity: number;
  finalScore: number;
  warnings: string[];
  notes: string[];
};

export type YugiohCardSearchResponse = {
  cards: YugiohCard[];
  sourceAudit: SourceAudit[];
};

export type YugiohArchetypeSearchResponse = {
  archetypes: YugiohArchetype[];
  sourceAudit: SourceAudit[];
};

export type YugiohGeneratedDeckResponse = {
  main: YugiohDeckEntry[];
  extra: YugiohDeckEntry[];
  side: YugiohDeckEntry[];
  buildNotes: string[];
  sourceAudit: SourceAudit[];
  metaSnapshot: YugiohMetaSnapshot;
  structuralReadout: YugiohStructuralReadout;
};
