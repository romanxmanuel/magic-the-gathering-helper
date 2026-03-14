import type { BuiltDeck, DeckCard, DeckStats } from "@/lib/types";
import { SECTION_ORDER } from "@/lib/constants";
import { round } from "@/lib/utils";

export function getDeckSize(cards: DeckCard[]) {
  return cards.reduce((total, card) => total + card.quantity, 0);
}

export function summarizeDeckCards(cards: DeckCard[]): DeckStats {
  const expanded = cards.flatMap((card) =>
    Array.from({ length: card.quantity }, () => card),
  );
  const nonlandCards = expanded.filter((card) => !card.roles.includes("land"));
  const totalManaValue = nonlandCards.reduce(
    (total, card) => total + card.manaValue,
    0,
  );
  const totalPriceUsd = expanded.reduce(
    (total, card) => total + (card.priceUsd ?? 0),
    0,
  );

  return {
    deckSize: expanded.length,
    landCount: expanded.filter((card) => card.roles.includes("land")).length,
    rampCount: expanded.filter((card) => card.roles.includes("ramp")).length,
    drawCount: expanded.filter((card) => card.roles.includes("draw")).length,
    interactionCount: expanded.filter((card) => card.roles.includes("interaction")).length,
    protectionCount: expanded.filter((card) => card.roles.includes("protection")).length,
    averageManaValue: nonlandCards.length
      ? round(totalManaValue / nonlandCards.length)
      : 0,
    totalPriceUsd: round(totalPriceUsd),
    gameChangerCount: expanded.filter((card) => card.gameChanger).length,
    comboEnabledCount: expanded.filter((card) => card.combos).length,
  };
}

export function sortDeckCards(cards: DeckCard[]) {
  return [...cards].sort((left, right) => {
    const leftIndex = SECTION_ORDER.indexOf(
      left.section as (typeof SECTION_ORDER)[number],
    );
    const rightIndex = SECTION_ORDER.indexOf(
      right.section as (typeof SECTION_ORDER)[number],
    );

    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }

    return left.name.localeCompare(right.name);
  });
}

export function withUpdatedDeck(base: BuiltDeck, cards: DeckCard[]) {
  const sortedCards = sortDeckCards(cards);

  return {
    ...base,
    cards: sortedCards,
    stats: summarizeDeckCards(sortedCards),
  };
}
