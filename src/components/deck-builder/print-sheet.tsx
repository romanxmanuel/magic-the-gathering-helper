"use client";

import Image from "next/image";
import Link from "next/link";

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
  const pageCount = Math.ceil(cards.length / 9);

  if (cards.length === 0) {
    return (
      <section className="print-layout">
        <div className="print-empty-state">
          <p className="panel-kicker">MTG Print Studio</p>
          <h2>Build a deck first, then print it here.</h2>
          <p className="empty-copy">
            Once your Commander shell exists, this page turns into a cut-ready proxy sheet with true-size Magic card
            dimensions.
          </p>
          <div className="tag-row empty-state-actions">
            <Link href="/mtg" className="primary-button">
              Back to MTG builder
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="print-layout mtg-print-layout">
      <div className="print-toolbar no-print">
        <div className="print-toolbar-copy">
          <strong>{commander?.name ?? "Commander proxy sheet"}</strong>
          <small>Cards are sized to 2.5in x 3.5in for standard Magic playtest proxies.</small>
        </div>
        <button type="button" className="primary-button" onClick={() => window.print()}>
          Print / Save as PDF
        </button>
      </div>

      <section className="summary-grid no-print">
        <article className="summary-card">
          <span>Total cards</span>
          <strong>{cards.length}</strong>
        </article>
        <article className="summary-card">
          <span>Commander</span>
          <strong>{commander ? "Included" : "None"}</strong>
        </article>
        <article className="summary-card">
          <span>Pages</span>
          <strong>{pageCount}</strong>
        </article>
        <article className="summary-card">
          <span>Use</span>
          <strong>Playtesting</strong>
        </article>
      </section>

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
