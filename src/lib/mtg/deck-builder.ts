import { BASIC_LAND_BY_COLOR, isSubsetOfColorIdentity } from "@/lib/mtg/colors";
import { deriveCommanderMechanics } from "@/lib/mtg/mechanics";
import type {
  CardRole,
  CardSummary,
  CommanderMeta,
  CommanderOption,
  DeckEntry,
  DeckValidation,
  GeneratedDeck,
  PowerPreset,
  TagOption,
} from "@/lib/mtg/types";

const POWER_CONFIG: Record<
  PowerPreset,
  { lands: number; ramp: number; draw: number; interaction: number; wipes: number; protection: number }
> = {
  battlecruiser: { lands: 37, ramp: 12, draw: 12, interaction: 8, wipes: 2, protection: 2 },
  focused: { lands: 36, ramp: 11, draw: 10, interaction: 10, wipes: 3, protection: 2 },
  high: { lands: 35, ramp: 10, draw: 10, interaction: 12, wipes: 3, protection: 2 },
  cooked: { lands: 34, ramp: 10, draw: 9, interaction: 14, wipes: 2, protection: 1 },
};

const CARD_EXCLUSIONS_BY_POWER: Record<PowerPreset, Set<string>> = {
  battlecruiser: new Set([
    "Mana Crypt",
    "Jeweled Lotus",
    "Dockside Extortionist",
    "Demonic Tutor",
    "Vampiric Tutor",
    "Mana Vault",
    "Grim Monolith",
  ]),
  focused: new Set(["Mana Crypt", "Jeweled Lotus"]),
  high: new Set(),
  cooked: new Set(),
};

const COMBO_IDEA_SCORE_ADJUSTMENT: Record<PowerPreset, number> = {
  battlecruiser: -30,
  focused: -10,
  high: 18,
  cooked: 30,
};

function includesAny(text: string, patterns: string[]) {
  return patterns.some((pattern) => text.includes(pattern));
}

function uniqueEntries(cards: CardSummary[]) {
  const entries = new Map<string, CardSummary>();

  for (const card of cards) {
    entries.set(card.name, card);
  }

  return [...entries.values()];
}

function comboPiecesFromIdeas(comboIdeas: string[], commanderName: string) {
  const pieces = new Set<string>();

  for (const comboIdea of comboIdeas) {
    for (const piece of comboIdea.split(/\s+\+\s+/)) {
      const trimmed = piece.trim();

      if (!trimmed || trimmed === commanderName) {
        continue;
      }

      pieces.add(trimmed);
    }
  }

  return pieces;
}

function classifyCard(card: CardSummary): CardRole {
  const text = (card.oracleText ?? "").toLowerCase();
  const typeLine = card.typeLine.toLowerCase();

  if (card.typeLine.includes("Land")) {
    return "land";
  }

  if (
    text.includes("add {") ||
    text.includes("search your library for a basic land") ||
    text.includes("create a treasure")
  ) {
    return "ramp";
  }

  if (text.includes("draw ") || text.includes("draw a card") || text.includes("draw two cards")) {
    return "draw";
  }

  if (
    (text.includes("destroy target") || text.includes("exile target") || text.includes("counter target")) &&
    !text.includes("each")
  ) {
    return "interaction";
  }

  if (
    (text.includes("destroy all") || text.includes("exile all") || text.includes("each creature")) &&
    (text.includes("creature") || text.includes("artifact") || text.includes("permanent"))
  ) {
    return "wipe";
  }

  if (text.includes("hexproof") || text.includes("indestructible") || text.includes("phase out")) {
    return "protection";
  }

  if (typeLine.includes("creature") && text.includes("whenever")) {
    return "synergy";
  }

  return "synergy";
}

function scoreCard(
  card: CardSummary,
  candidateMap: Map<string, CommanderMeta["cards"][number]>,
  powerPreset: PowerPreset,
  comboPieces: Set<string>,
) {
  const candidate = candidateMap.get(card.name);
  const baseScore = candidate ? candidate.synergy * 100 + Math.log10(candidate.inclusion + 10) * 20 : 0;
  const cmcAdjustment = powerPreset === "cooked" ? Math.max(0, 8 - card.cmc) : Math.max(0, 6 - card.cmc);
  const edhrecAdjustment = card.edhrecRank ? Math.max(0, 1000 - card.edhrecRank) / 100 : 0;
  const oracleText = (card.oracleText ?? "").toLowerCase();
  const comboPotential = includesAny(oracleText, [
    "search your library",
    "take an extra turn",
    "you win the game",
    "if there are no cards in your library",
    "untap all",
    "cast this spell from your graveyard",
  ]);
  const comboAdjustment = comboPotential
    ? powerPreset === "cooked"
      ? 18
      : powerPreset === "high"
        ? 10
        : powerPreset === "battlecruiser"
          ? -12
          : -2
    : 0;
  const comboIdeaAdjustment = comboPieces.has(card.name)
    ? COMBO_IDEA_SCORE_ADJUSTMENT[powerPreset]
    : 0;

  return baseScore + cmcAdjustment + edhrecAdjustment + comboAdjustment + comboIdeaAdjustment;
}

function addCardsByRole(
  deckMap: Map<string, DeckEntry>,
  cards: CardSummary[],
  count: number,
  role: CardRole,
  commander: CommanderOption,
) {
  for (const card of cards) {
    if (deckMap.size >= 99) {
      break;
    }

    if (card.name === commander.name || deckMap.has(card.name)) {
      continue;
    }

    if (!card.isBasicLand && deckMap.has(card.name)) {
      continue;
    }

    deckMap.set(card.name, {
      ...card,
      quantity: 1,
      role,
    });

    if ([...deckMap.values()].filter((entry) => entry.role === role).length >= count) {
      break;
    }
  }
}

function fillBasics(deckMap: Map<string, DeckEntry>, commander: CommanderOption, landTarget: number) {
  const landCount = [...deckMap.values()].filter((entry) => entry.role === "land").length;
  const colors = commander.colorIdentity.length > 0 ? commander.colorIdentity : [];

  if (colors.length === 0) {
    const quantity = Math.max(0, landTarget - landCount);

    for (let count = 0; count < quantity; count += 1) {
      const name = `Wastes ${count + 1}`;
      deckMap.set(name, {
        id: name,
        name: "Wastes",
        slug: "wastes",
        manaCost: null,
        typeLine: "Basic Land",
        oracleText: null,
        colorIdentity: [],
        colors: [],
        cmc: 0,
        imageUris: {
          normal: "",
          png: "",
          artCrop: "",
        },
        edhrecRank: null,
        legalCommander: true,
        isBasicLand: true,
        layout: "normal",
        quantity: 1,
        role: "land",
      });
    }

    return;
  }

  const quantity = Math.max(0, landTarget - landCount);

  for (let count = 0; count < quantity; count += 1) {
    const color = colors[count % colors.length];
    const basicName = BASIC_LAND_BY_COLOR[color];
    const key = `${basicName} ${count + 1}`;

    deckMap.set(key, {
      id: key,
      name: basicName,
      slug: basicName.toLowerCase(),
      manaCost: null,
      typeLine: "Basic Land",
      oracleText: null,
      colorIdentity: [color],
      colors: [],
      cmc: 0,
      imageUris: {
        normal: "",
        png: "",
        artCrop: "",
      },
      edhrecRank: null,
      legalCommander: true,
      isBasicLand: true,
      layout: "normal",
      quantity: 1,
      role: "land",
    });
  }
}

export function validateDeck(entries: DeckEntry[], commander: CommanderOption, bannedCards: string[]) {
  const bannedSet = new Set(bannedCards);
  const counts = new Map<string, number>();
  const duplicates: string[] = [];

  for (const entry of entries) {
    counts.set(entry.name, (counts.get(entry.name) ?? 0) + entry.quantity);
  }

  for (const [name, count] of counts.entries()) {
    const entry = entries.find((deckEntry) => deckEntry.name === name);

    if (count > 1 && !entry?.isBasicLand) {
      duplicates.push(name);
    }
  }

  const offColorCards = entries
    .filter((entry) => !isSubsetOfColorIdentity(entry.colorIdentity, commander.colorIdentity))
    .map((entry) => entry.name);
  const bannedCardsInDeck = entries.filter((entry) => bannedSet.has(entry.name)).map((entry) => entry.name);
  const size = entries.reduce((total, entry) => total + entry.quantity, 0) + 1;
  const warnings: string[] = [];

  if (size < 100) {
    warnings.push(`Deck is at ${size} cards including the commander.`);
  }

  if (entries.filter((entry) => entry.role === "land").length < 34) {
    warnings.push("Land count is low for most Commander tables.");
  }

  return {
    size,
    isComplete: size === 100 && duplicates.length === 0 && offColorCards.length === 0 && bannedCardsInDeck.length === 0,
    hasCommander: Boolean(commander),
    bannedCards: bannedCardsInDeck,
    offColorCards,
    duplicates,
    warnings,
  } satisfies DeckValidation;
}

export function buildCommanderDeck(
  commander: CommanderOption,
  meta: CommanderMeta,
  cardPool: CardSummary[],
  bannedCards: string[],
  powerPreset: PowerPreset,
  focusTag: TagOption | null,
): GeneratedDeck {
  const candidateMap = new Map(meta.cards.map((card) => [card.name, card]));
  const exclusions = CARD_EXCLUSIONS_BY_POWER[powerPreset];
  const config = POWER_CONFIG[powerPreset];
  const comboPieces = comboPiecesFromIdeas(meta.comboIdeas, commander.name);
  const mechanics = deriveCommanderMechanics(commander, meta.tags, meta.spellbook);

  const rankedPool = uniqueEntries(
    cardPool.filter(
      (card) =>
        card.legalCommander &&
        card.name !== commander.name &&
        !bannedCards.includes(card.name) &&
        !exclusions.has(card.name) &&
        isSubsetOfColorIdentity(card.colorIdentity, commander.colorIdentity),
    ),
  ).sort(
    (left, right) =>
      scoreCard(right, candidateMap, powerPreset, comboPieces) -
      scoreCard(left, candidateMap, powerPreset, comboPieces),
  );

  const lands = rankedPool.filter((card) => classifyCard(card) === "land");
  const ramp = rankedPool.filter((card) => classifyCard(card) === "ramp");
  const draw = rankedPool.filter((card) => classifyCard(card) === "draw");
  const interaction = rankedPool.filter((card) => classifyCard(card) === "interaction");
  const wipes = rankedPool.filter((card) => classifyCard(card) === "wipe");
  const protection = rankedPool.filter((card) => classifyCard(card) === "protection");
  const synergy = rankedPool.filter((card) => classifyCard(card) === "synergy");

  const deckMap = new Map<string, DeckEntry>();

  addCardsByRole(deckMap, lands, config.lands, "land", commander);
  addCardsByRole(deckMap, ramp, config.ramp, "ramp", commander);
  addCardsByRole(deckMap, draw, config.draw, "draw", commander);
  addCardsByRole(deckMap, interaction, config.interaction, "interaction", commander);
  addCardsByRole(deckMap, wipes, config.wipes, "wipe", commander);
  addCardsByRole(deckMap, protection, config.protection, "protection", commander);
  addCardsByRole(deckMap, synergy, 99, "synergy", commander);

  fillBasics(deckMap, commander, config.lands);

  if (deckMap.size > 99) {
    const trimmedDeck = [...deckMap.values()]
      .sort((left, right) => {
        const priority: Record<CardRole, number> = {
          commander: 100,
          land: 90,
          ramp: 80,
          draw: 70,
          interaction: 60,
          wipe: 50,
          protection: 40,
          synergy: 10,
        };

        return priority[right.role] - priority[left.role];
      })
      .slice(0, 99);

    deckMap.clear();

    for (const entry of trimmedDeck) {
      deckMap.set(entry.name, entry);
    }
  }

  const entries = [...deckMap.values()];
  const validation = validateDeck(entries, commander, bannedCards);
  const buildNotes = [
    `Built around ${commander.name}${focusTag ? ` with a ${focusTag.label} lean` : ""}.`,
    `${meta.cards.length} EDHREC meta candidates were considered for the shell.`,
    `Power preset "${powerPreset}" adjusted the amount of ramp, interaction, and fast-mana tolerance.`,
  ];

  if (meta.spellbook) {
    buildNotes.push(
      `Commander Spellbook tracks ${meta.spellbook.variantCount} known combo variant(s) for ${commander.name}.`,
    );

    const sharpSignals = [
      meta.spellbook.gameChanger ? "game changer pressure" : "",
      meta.spellbook.tutor ? "tutor lines" : "",
      meta.spellbook.extraTurn ? "extra-turn lines" : "",
      meta.spellbook.massLandDenial ? "mass land denial" : "",
    ].filter(Boolean);

    if (sharpSignals.length > 0) {
      buildNotes.push(`Spellbook flags sharper patterns around ${sharpSignals.join(", ")}.`);
    }
  }

  if (comboPieces.size > 0) {
    const highlightedPieces = [...comboPieces].slice(0, 4);
    const comboVerb =
      powerPreset === "high" || powerPreset === "cooked"
        ? "boosted"
        : "deprioritized";

    buildNotes.push(
      `Known combo pieces were ${comboVerb} during card scoring: ${highlightedPieces.join(", ")}.`,
    );
  }

  if (mechanics) {
    buildNotes.push(mechanics.primer);
  }

  return {
    commander,
    focusTag,
    powerPreset,
    entries,
    validation,
    buildNotes,
    spellbookEstimate: null,
  };
}
