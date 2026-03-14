"use client";

import Image from "next/image";

import type { CommanderOption, DeckEntry } from "@/lib/mtg/types";

type PrintSheetProps = {
  commander: CommanderOption | null;
  entries: DeckEntry[];
};

function printableEntries(commander: CommanderOption | null, entries: DeckEntry[]) {
  const deckEntries = [...entries];

  if (!commander) {
    return deckEntries;
  }

  return [
    {
      id: commander.id,
      name: commander.name,
      slug: commander.slug,
      manaCost: null,
      typeLine: commander.typeLine,
      oracleText: commander.oracleText,
      colorIdentity: commander.colorIdentity,
      colors: commander.colors,
      cmc: 0,
      imageUris: commander.imageUris,
      edhrecRank: null,
      legalCommander: true,
      isBasicLand: false,
      layout: "normal",
      quantity: 1,
      role: "commander" as const,
    },
    ...deckEntries,
  ];
}

export function PrintSheet({ commander, entries }: PrintSheetProps) {
  const cards = printableEntries(commander, entries);

  if (cards.length === 0) {
    return <p className="empty-copy">Build a deck first, then this page becomes a cut-ready proxy sheet.</p>;
  }

  return (
    <section className="print-layout">
      <div className="print-toolbar no-print">
        <button type="button" className="primary-button" onClick={() => window.print()}>
          Print proxy sheet
        </button>
        <p>Cards are sized to 2.5in x 3.5in for standard Magic proxies.</p>
      </div>

      <div className="proxy-sheet">
        {cards.map((card, index) => (
          <article key={`${card.name}-${index}`} className="proxy-card">
            {card.imageUris.png ? (
              <Image
                src={card.imageUris.png}
                alt={card.name}
                width={750}
                height={1050}
                className="proxy-image"
                unoptimized
              />
            ) : (
              <div className="proxy-placeholder">
                <p>{card.role === "commander" ? "Commander Proxy" : "Proxy Card"}</p>
                <strong>{card.name}</strong>
                <span>{card.typeLine}</span>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
