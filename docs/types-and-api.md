# Types and API Contracts

This document defines the next-level planning spec for the dual-game shell and the Yu-Gi-Oh product. It is intended to make implementation nearly mechanical.

## Design Rule

Use separate domain types for MTG and Yu-Gi-Oh, with a very small shared layer.

Do not try to force both games into one giant generic deck model.

## Shared Types

These types belong in `src/lib/games/shared/types.ts`.

```ts
export type GameId = "mtg" | "yugioh";

export type SourceAudit = {
  sourceName: string;
  sourceType: "official" | "community" | "derived";
  sourceUrl: string;
  fetchedAt: string;
  confidence?: "low" | "medium" | "high";
  notes?: string;
};

export type ImageSet = {
  full: string | null;
  small: string | null;
  crop: string | null;
};

export type PrintableCard = {
  id: string;
  name: string;
  image: string | null;
  typeLine: string | null;
};

export type PrintProfile = {
  game: GameId;
  cardWidthMm: number;
  cardHeightMm: number;
  gutterMm: number;
  cardsPerPage: number;
  supportsCalibration: boolean;
};
```

## Yu-Gi-Oh Domain Types

These types belong in `src/lib/games/yugioh/types.ts`.

```ts
export type YugiohFormatMode =
  | "open-lab"
  | "tcg-advanced"
  | "master-duel"
  | "edison"
  | "goat";

export type YugiohBuildIntent =
  | "pure"
  | "hybrid"
  | "anti-meta"
  | "consistency-first"
  | "ceiling-first"
  | "blind-second"
  | "grind";

export type YugiohStrengthTarget =
  | "casual"
  | "strong"
  | "tournament-level"
  | "degenerate";

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

export type YugiohThemeSelection = {
  query: string;
  resolvedArchetype: string | null;
  resolvedBossCards: string[];
  resolvedSupportCards: string[];
};

export type YugiohMetaTarget = {
  archetype: string;
  weight: number;
};

export type YugiohGeneratorRequest = {
  formatMode: YugiohFormatMode;
  strengthTarget: YugiohStrengthTarget;
  buildIntent: YugiohBuildIntent;
  theme: YugiohThemeSelection;
  metaTargets: YugiohMetaTarget[];
  constraints: YugiohConstraint[];
  preferredCards?: string[];
  excludedCards?: string[];
};

export type YugiohScoringBreakdown = {
  consistency: number;
  synergy: number;
  antiMeta: number;
  recovery: number;
  openerQuality: number;
  brickRiskPenalty: number;
  sectionBalance: number;
  finalScore: number;
};

export type YugiohGeneratedDeck = {
  main: YugiohDeckEntry[];
  extra: YugiohDeckEntry[];
  side: YugiohDeckEntry[];
  coreCards: string[];
  flexCards: string[];
  techCards: string[];
  scoring: YugiohScoringBreakdown;
  buildNotes: string[];
  sourceAudit: SourceAudit[];
};
```

## Shared App Store Shape

This belongs in `src/store/app-store.ts`.

```ts
type AppStoreState = {
  activeGame: GameId;
  setActiveGame: (game: GameId) => void;
};
```

## Yu-Gi-Oh Store Shape

This belongs in `src/store/yugioh-store.ts`.

```ts
type YugiohStoreState = {
  formatMode: YugiohFormatMode;
  strengthTarget: YugiohStrengthTarget;
  buildIntent: YugiohBuildIntent;
  theme: YugiohThemeSelection | null;
  metaTargets: YugiohMetaTarget[];
  constraints: YugiohConstraint[];
  main: YugiohDeckEntry[];
  extra: YugiohDeckEntry[];
  side: YugiohDeckEntry[];
  buildNotes: string[];
  sourceAudit: SourceAudit[];
  setTheme: (theme: YugiohThemeSelection | null) => void;
  setFormatMode: (mode: YugiohFormatMode) => void;
  setStrengthTarget: (target: YugiohStrengthTarget) => void;
  setBuildIntent: (intent: YugiohBuildIntent) => void;
  setMetaTargets: (targets: YugiohMetaTarget[]) => void;
  setConstraints: (constraints: YugiohConstraint[]) => void;
  setGeneratedDeck: (deck: YugiohGeneratedDeck) => void;
  addCard: (entry: YugiohDeckEntry) => void;
  removeCard: (cardName: string, section: YugiohDeckSection) => void;
  clearDeck: () => void;
};
```

## API Surface

Recommended route contracts:

### `GET /api/yugioh/cards`
Purpose:
- search cards by name or archetype

Query params:
- `q`
- `archetype`
- `limit`

Response:

```ts
type YugiohCardSearchResponse = {
  results: YugiohCard[];
  sourceAudit: SourceAudit[];
};
```

### `GET /api/yugioh/archetypes`
Purpose:
- search or list archetypes

Query params:
- `q`

Response:

```ts
type YugiohArchetypeSearchResponse = {
  archetypes: Array<{
    name: string;
    representativeCards: string[];
    deckCount: number | null;
  }>;
  sourceAudit: SourceAudit[];
};
```

### `GET /api/yugioh/meta`
Purpose:
- expose the stored meta corpus for a theme or time window

Query params:
- `archetype`
- `days`

Response:

```ts
type YugiohMetaResponse = {
  archetype: string | null;
  deckCount: number;
  freshness: "fresh" | "aging" | "stale";
  commonCards: Array<{ name: string; percentage: number }>;
  commonPackages: Array<{ label: string; cards: string[] }>;
  sourceAudit: SourceAudit[];
};
```

### `POST /api/yugioh/deck-generate`
Purpose:
- generate a Yu-Gi-Oh deck shell

Body:
- `YugiohGeneratorRequest`

Response:
- `YugiohGeneratedDeck`

### `POST /api/yugioh/opening-hands`
Purpose:
- simulate opening hands for a generated deck

Body:

```ts
type OpeningHandRequest = {
  main: YugiohDeckEntry[];
  trials?: number;
};
```

Response:

```ts
type OpeningHandResponse = {
  playableRate: number;
  brickRate: number;
  sampleHands: Array<{ cards: string[]; tags: string[] }>;
};
```

### `POST /api/yugioh/print-assets`
Purpose:
- normalize selected print assets and attach print-profile metadata

Body:

```ts
type PrintAssetsRequest = {
  cards: PrintableCard[];
  printVariant?: "full-card";
};
```

## Validation Rules

Use `zod` for all external request validation.

Recommended request validation boundaries:
- reject empty theme input for deck generation
- cap meta-target count
- cap excluded-card count
- cap preferred-card count
- cap opening-hand simulation trials

## What This Spec Avoids On Purpose

- It does not force MTG and Yu-Gi-Oh into one shared deck-entry type.
- It does not pretend the heuristic model is finished.
- It does not define persistence beyond browser-local first.
