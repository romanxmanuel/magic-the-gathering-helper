"use client";

import { withUpdatedDeck } from "@/lib/deck-math";
import type { BuiltDeck, DeckCard } from "@/lib/types";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface DeckStoreState {
  deck: BuiltDeck | null;
  setDeck: (deck: BuiltDeck) => void;
  removeCard: (name: string) => void;
  addCard: (card: DeckCard) => void;
  reset: () => void;
}

export const useDeckStore = create<DeckStoreState>()(
  persist(
    (set) => ({
      deck: null,
      setDeck: (deck) => set({ deck }),
      removeCard: (name) =>
        set((state) => {
          if (!state.deck) {
            return state;
          }

          const cards = state.deck.cards.flatMap((card) => {
            if (card.name !== name) {
              return [card];
            }

            if (card.quantity > 1 && card.typeLine.includes("Basic")) {
              return [{ ...card, quantity: card.quantity - 1 }];
            }

            return [];
          });

          return {
            deck: withUpdatedDeck(state.deck, cards),
          };
        }),
      addCard: (card) =>
        set((state) => {
          if (!state.deck) {
            return state;
          }

          const existing = state.deck.cards.find((entry) => entry.name === card.name);

          const cards = existing
            ? state.deck.cards.map((entry) =>
                entry.name === card.name && entry.typeLine.includes("Basic")
                  ? { ...entry, quantity: entry.quantity + 1 }
                  : entry,
              )
            : [...state.deck.cards, card];

          return {
            deck: withUpdatedDeck(state.deck, cards),
          };
        }),
      reset: () => set({ deck: null }),
    }),
    {
      name: "mtg-helper-deck-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ deck: state.deck }),
    },
  ),
);
