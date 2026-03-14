import { BASIC_LANDS_BY_COLOR } from "@/lib/constants";
import { sortDeckCards, summarizeDeckCards } from "@/lib/deck-math";
import { isColorSubset, normalizeColors } from "@/lib/slug";
import {
  fetchCommanderSpellbookCard,
  fetchEdhrecCommanderPage,
  fetchScryfallCardByName,
  fetchScryfallCollectionByNames,
  pickCommanderFromColors,
} from "@/lib/mtg";
import type {
  BuiltDeck,
  CommanderBracket,
  DeckCard,
  DeckRole,
  ManaColor,
} from "@/lib/types";
import { round, uniqueBy } from "@/lib/utils";

const BRACKET_TARGETS: Record<
  CommanderBracket,
  {
    landTarget: number;
    rampTarget: number;
    drawTarget: number;
    interactionTarget: number;
    protectionTarget: number;
    gameChangerLimit: number;
    comboBias: number;
    saltPenalty: number;
  }
> = {
  1: {
    landTarget: 37,
    rampTarget: 8,
    drawTarget: 9,
    interactionTarget: 10,
    protectionTarget: 4,
    gameChangerLimit: 0,
    comboBias: -8,
    saltPenalty: 9,
  },
  2: {
    landTarget: 36,
    rampTarget: 9,
    drawTarget: 9,
    interactionTarget: 10,
    protectionTarget: 4,
    gameChangerLimit: 0,
    comboBias: -5,
    saltPenalty: 7,
  },
  3: {
    landTarget: 36,
    rampTarget: 10,
    drawTarget: 9,
    interactionTarget: 10,
    protectionTarget: 4,
    gameChangerLimit: 3,
    comboBias: 1,
    saltPenalty: 4,
  },
  4: {
    landTarget: 35,
    rampTarget: 11,
    drawTarget: 8,
    interactionTarget: 10,
    protectionTarget: 3,
    gameChangerLimit: 8,
    comboBias: 5,
    saltPenalty: 1,
  },
  5: {
    landTarget: 34,
    rampTarget: 12,
    drawTarget: 8,
    interactionTarget: 10,
    protectionTarget: 3,
    gameChangerLimit: Number.POSITIVE_INFINITY,
    comboBias: 8,
    saltPenalty: 0,
  },
};

type CandidateCard = DeckCard & {
  score: number;
  trend: number;
};

function includesAny(text: string, tokens: string[]) {
  return tokens.some((token) => text.includes(token));
}

function toCardKey(name: string) {
  return name.trim().toLowerCase();
}

function inferRoles(card: DeckCard): DeckRole[] {
  const typeLine = card.typeLine.toLowerCase();
  const oracleText = card.oracleText.toLowerCase();
  const roles: DeckRole[] = [];

  if (typeLine.includes("land")) {
    roles.push("land");
  }

  if (
    oracleText.includes("add {") ||
    (oracleText.includes("search your library") &&
      includesAny(oracleText, [
        "land card",
        "basic land",
        "forest",
        "plains",
        "island",
        "swamp",
        "mountain",
      ]))
  ) {
    roles.push("ramp");
  }

  if (
    oracleText.includes("draw ") ||
    oracleText.includes("investigate") ||
    oracleText.includes("discover")
  ) {
    roles.push("draw");
  }

  if (
    includesAny(oracleText, [
      "destroy target",
      "exile target",
      "counter target",
      "return target",
      "each opponent sacrifices",
      "target creature gets -",
      "fight target",
    ])
  ) {
    roles.push("interaction");
  }

  if (
    includesAny(oracleText, [
      "destroy all",
      "exile all",
      "all creatures",
      "all artifacts",
      "all enchantments",
    ])
  ) {
    roles.push("wipe");
  }

  if (
    includesAny(oracleText, [
      "hexproof",
      "indestructible",
      "ward",
      "phase out",
      "protection from",
      "can't be countered",
    ])
  ) {
    roles.push("protection");
  }

  if (card.gameChanger) {
    roles.push("game-changer");
  }

  if (card.combos) {
    roles.push("combo");
  }

  if (!roles.length && !typeLine.includes("land")) {
    roles.push("synergy");
  }

  return uniqueBy(roles, (role) => role);
}

function scoreCard(
  card: DeckCard,
  bracket: CommanderBracket,
  focus: string,
  trend: number,
) {
  const profile = BRACKET_TARGETS[bracket];
  const focusTokens = focus
    .toLowerCase()
    .split(/[^a-z0-9+/-]+/)
    .filter(Boolean);

  const sectionBonus =
    {
      "High Synergy Cards": 18,
      "Top Cards": 12,
      "New Cards": 6,
      "Game Changers": bracket >= 3 ? 4 : -20,
      "Mana Artifacts": 10,
      Lands: 8,
    }[card.section] ?? 0;

  const text = `${card.name} ${card.typeLine} ${card.oracleText}`.toLowerCase();
  const focusBonus = focusTokens.reduce((bonus, token) => {
    if (text.includes(token)) {
      return bonus + 8;
    }

    return bonus;
  }, 0);

  let score = 0;

  score += (card.synergy ?? 0) * 120;
  score += Math.log((card.inclusion ?? 1) + 1) * 7;
  score += trend * 4;
  score += sectionBonus;
  score += focusBonus;
  score += card.roles.includes("ramp") ? 5 : 0;
  score += card.roles.includes("draw") ? 4 : 0;
  score += card.roles.includes("interaction") ? 4 : 0;
  score += card.roles.includes("protection") ? 3 : 0;
  score += card.combos ? profile.comboBias : 0;
  score -= (card.salt ?? 0) * profile.saltPenalty;

  if (card.gameChanger && bracket < 3) {
    score -= 100;
  }

  return round(score);
}

function addCardToDeck(
  deck: DeckCard[],
  card: DeckCard,
  forceBasicIncrement = false,
) {
  const existing = deck.find((entry) => entry.name === card.name);

  if (existing && (forceBasicIncrement || existing.typeLine.includes("Basic"))) {
    existing.quantity += 1;
    return;
  }

  if (!existing) {
    deck.push({ ...card });
  }
}

function deckHasCard(deck: DeckCard[], name: string) {
  return deck.some((card) => card.name === name);
}

function deckGameChangerCount(deck: DeckCard[]) {
  return deck.reduce(
    (total, card) => total + (card.gameChanger ? card.quantity : 0),
    0,
  );
}

function totalCardCount(deck: DeckCard[]) {
  return deck.reduce((total, card) => total + card.quantity, 0);
}

function chooseCards(
  deck: DeckCard[],
  candidates: CandidateCard[],
  amount: number,
  bracket: CommanderBracket,
) {
  const profile = BRACKET_TARGETS[bracket];

  for (const card of candidates) {
    if (amount <= 0) {
      return;
    }

    if (deckHasCard(deck, card.name) || !card.legalCommander) {
      continue;
    }

    if (
      card.gameChanger &&
      deckGameChangerCount(deck) >= profile.gameChangerLimit
    ) {
      continue;
    }

    addCardToDeck(deck, card);
    amount -= 1;
  }
}

function padWithBasics(deck: DeckCard[], commanderColors: ManaColor[]) {
  const basics = commanderColors.length
    ? commanderColors.map((color) => BASIC_LANDS_BY_COLOR[color])
    : [BASIC_LANDS_BY_COLOR.C];

  let index = 0;

  while (totalCardCount(deck) < 99) {
    const basicName = basics[index % basics.length];
    const existing = deck.find((card) => card.name === basicName);

    if (existing) {
      existing.quantity += 1;
    } else {
      deck.push({
        id: `${basicName.toLowerCase()}-auto-basic`,
        name: basicName,
        quantity: 1,
        section: "Auto Basics",
        typeLine: "Basic Land",
        oracleText: "",
        manaValue: 0,
        colorIdentity: normalizeColors(
          Object.entries(BASIC_LANDS_BY_COLOR)
            .filter(([, landName]) => landName === basicName)
            .map(([color]) => color),
        ),
        image: "",
        normalImage: "",
        gameChanger: false,
        legalCommander: true,
        combos: false,
        roles: ["land"],
        source: "Auto basic land padding",
      });
    }

    index += 1;
  }
}

function trimDeck(deck: DeckCard[]) {
  const removable = deck
    .filter((card) => !card.roles.includes("land"))
    .sort((left, right) => {
      const leftScore = (left.synergy ?? 0) + (left.inclusion ?? 0) / 100000;
      const rightScore = (right.synergy ?? 0) + (right.inclusion ?? 0) / 100000;

      return leftScore - rightScore;
    });

  while (totalCardCount(deck) > 99 && removable.length) {
    const card = removable.shift();

    if (!card) {
      break;
    }

    const deckCard = deck.find((entry) => entry.name === card.name);

    if (!deckCard) {
      continue;
    }

    if (deckCard.quantity > 1) {
      deckCard.quantity -= 1;
      continue;
    }

    const index = deck.findIndex((entry) => entry.name === card.name);
    deck.splice(index, 1);
  }
}

function buildNotes(
  commanderName: string,
  bracket: CommanderBracket,
  focus: string,
  autoChosenCommander: boolean,
  comboFlags: {
    gameChanger: boolean;
    tutor: boolean;
    massLandDenial: boolean;
    extraTurn: boolean;
  } | null,
) {
  const notes = [
    `${commanderName} was built from EDHREC commander panels, then filtered through Scryfall Commander legality and image data.`,
    `Bracket ${bracket} is a heuristic target, not an official certification. Use it as a pregame conversation aid.`,
  ];

  if (autoChosenCommander) {
    notes.push(
      "The commander was auto-selected from EDHREC top commanders based on the chosen color identity.",
    );
  }

  if (focus.trim()) {
    notes.push(
      `The build score gave extra weight to cards whose text or type line echoed the focus: "${focus.trim()}".`,
    );
  }

  if (comboFlags?.tutor || comboFlags?.extraTurn || comboFlags?.massLandDenial) {
    const sharpSignals = [
      comboFlags.tutor ? "tutor density" : "",
      comboFlags.extraTurn ? "extra-turn patterns" : "",
      comboFlags.massLandDenial ? "mass land denial" : "",
    ].filter(Boolean);

    notes.push(
      `Commander Spellbook also flags sharper patterns around ${sharpSignals.join(
        ", ",
      )} for this commander shell.`,
    );
  }

  return notes;
}

export async function buildCommanderDeck(options: {
  commanderName?: string;
  colors?: string[];
  bracket: CommanderBracket;
  focus?: string;
}) {
  const normalizedColors = normalizeColors(options.colors ?? []);
  const autoCommander =
    !options.commanderName && normalizedColors.length
      ? await pickCommanderFromColors(normalizedColors)
      : null;

  const commanderName = options.commanderName?.trim() || autoCommander?.name;

  if (!commanderName) {
    throw new Error("Choose a commander or a color identity before building.");
  }

  const { payload } = await fetchEdhrecCommanderPage(commanderName);
  const scryfallCommander = await fetchScryfallCardByName(
    payload.container.json_dict.card.name,
  );
  const commanderColors = normalizeColors(scryfallCommander.color_identity);
  const spellbookFlags = await fetchCommanderSpellbookCard(commanderName);

  const rawCandidates = payload.container.json_dict.cardlists.flatMap((list) =>
    list.cardviews.map((rawCard) => ({
      list,
      rawCard,
    })),
  );
  const scryfallCandidates = await fetchScryfallCollectionByNames(
    rawCandidates.map(({ rawCard }) => rawCard.name),
  );
  const scryfallLookup = new Map(
    scryfallCandidates.map((card) => [toCardKey(card.name), card]),
  );

  const enrichedCandidates = rawCandidates.flatMap(({ list, rawCard }) => {
    const scryfallCard = scryfallLookup.get(toCardKey(rawCard.name));

    if (!scryfallCard) {
      return [];
    }

    const images = scryfallCard.image_uris ?? scryfallCard.card_faces?.[0]?.image_uris;
    const priceFallback =
      rawCard.prices?.tcgplayer?.price ??
      rawCard.prices?.cardkingdom?.price ??
      null;

        const candidate: CandidateCard = {
          id: scryfallCard.id,
          name: rawCard.name,
          quantity: 1,
          section: list.header,
          typeLine: scryfallCard.type_line,
          oracleText: scryfallCard.oracle_text ?? "",
          manaValue: scryfallCard.cmc,
          colorIdentity: normalizeColors(scryfallCard.color_identity),
          image:
            images?.png ??
            images?.normal ??
            rawCard.image_uris?.[0]?.png ??
            rawCard.image_uris?.[0]?.normal ??
            "",
          normalImage:
            images?.normal ??
            images?.png ??
            rawCard.image_uris?.[0]?.normal ??
            rawCard.image_uris?.[0]?.png ??
            "",
          scryfallUri: scryfallCard.scryfall_uri,
          edhrecUri: rawCard.url ? `https://edhrec.com${rawCard.url}` : undefined,
          spellbookUri: rawCard.spellbook_uri,
          salt: rawCard.salt,
          synergy: rawCard.synergy,
          inclusion: rawCard.inclusion ?? rawCard.num_decks,
          priceUsd: scryfallCard.prices?.usd
            ? Number(scryfallCard.prices.usd)
            : priceFallback,
          gameChanger: Boolean(scryfallCard.game_changer) || list.tag === "gamechangers",
          legalCommander: scryfallCard.legalities.commander === "legal",
          combos: rawCard.combos ?? false,
          roles: [],
          source: `EDHREC · ${list.header}`,
          trend: rawCard.trend_zscore ?? 0,
          score: 0,
        };

        candidate.roles = inferRoles(candidate);
        candidate.score = scoreCard(
          candidate,
          options.bracket,
          options.focus ?? "",
          candidate.trend,
        );

    return [candidate];
  });

  const candidatePool = uniqueBy(
    enrichedCandidates.filter((candidate) =>
      isColorSubset(candidate.colorIdentity, commanderColors),
    ),
    (candidate) => candidate.name,
  ).sort((left, right) => right.score - left.score);

  const landCandidates = candidatePool.filter((card) => card.roles.includes("land"));
  const rampCandidates = candidatePool.filter(
    (card) => !card.roles.includes("land") && card.roles.includes("ramp"),
  );
  const drawCandidates = candidatePool.filter(
    (card) => !card.roles.includes("land") && card.roles.includes("draw"),
  );
  const interactionCandidates = candidatePool.filter(
    (card) =>
      !card.roles.includes("land") &&
      (card.roles.includes("interaction") || card.roles.includes("wipe")),
  );
  const protectionCandidates = candidatePool.filter(
    (card) => !card.roles.includes("land") && card.roles.includes("protection"),
  );
  const remainingCandidates = candidatePool.filter(
    (card) => !card.roles.includes("land"),
  );

  const deck: DeckCard[] = [];
  const targets = BRACKET_TARGETS[options.bracket];

  chooseCards(deck, landCandidates, targets.landTarget, options.bracket);
  chooseCards(deck, rampCandidates, targets.rampTarget, options.bracket);
  chooseCards(deck, drawCandidates, targets.drawTarget, options.bracket);
  chooseCards(
    deck,
    interactionCandidates,
    targets.interactionTarget,
    options.bracket,
  );
  chooseCards(
    deck,
    protectionCandidates,
    targets.protectionTarget,
    options.bracket,
  );
  chooseCards(
    deck,
    remainingCandidates,
    99 - totalCardCount(deck),
    options.bracket,
  );

  if (totalCardCount(deck) < 99) {
    padWithBasics(deck, commanderColors);
  }

  if (totalCardCount(deck) > 99) {
    trimDeck(deck);
  }

  const commanderImages =
    scryfallCommander.image_uris ?? scryfallCommander.card_faces?.[0]?.image_uris;
  const commander: DeckCard = {
    id: scryfallCommander.id,
    name: scryfallCommander.name,
    quantity: 1,
    section: "Commander",
    typeLine: scryfallCommander.type_line,
    oracleText: scryfallCommander.oracle_text ?? "",
    manaValue: scryfallCommander.cmc,
    colorIdentity: commanderColors,
    image: commanderImages?.png ?? commanderImages?.normal ?? "",
    normalImage: commanderImages?.normal ?? commanderImages?.png ?? "",
    scryfallUri: scryfallCommander.scryfall_uri,
    edhrecUri: scryfallCommander.related_uris?.edhrec,
    salt: payload.container.json_dict.card.salt,
    priceUsd: scryfallCommander.prices?.usd
      ? Number(scryfallCommander.prices.usd)
      : null,
    gameChanger: Boolean(scryfallCommander.game_changer),
    legalCommander: scryfallCommander.legalities.commander === "legal",
    combos: payload.container.json_dict.card.combos ?? false,
    roles: ["synergy"],
    source: "Scryfall commander record",
  };

  const popularThemes = payload.panels.links
    .flatMap((group) => group.items)
    .filter((item) => item.href.startsWith("/tags/"))
    .slice(0, 10)
    .map((item) => item.value);

  return {
    commander,
    cards: sortDeckCards(deck),
    colors: commanderColors,
    bracket: options.bracket,
    chosenFocus: options.focus?.trim() ?? "",
    popularThemes,
    stats: summarizeDeckCards(deck),
    notes: buildNotes(
      commanderName,
      options.bracket,
      options.focus ?? "",
      Boolean(autoCommander),
      spellbookFlags,
    ),
    sources: ["Scryfall", "EDHREC", "Commander Spellbook", "Wizards of the Coast"],
    generatedAt: new Date().toISOString(),
  } satisfies BuiltDeck;
}
