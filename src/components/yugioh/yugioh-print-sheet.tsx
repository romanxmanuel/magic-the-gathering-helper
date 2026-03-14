"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";

import { YUGIOH_PRINT_PROFILE } from "@/lib/games/yugioh/print";
import type { YugiohDeckEntry, YugiohDeckSection } from "@/lib/games/yugioh/types";
import { useYugiohStore } from "@/store/yugioh-store";

type PrintableCard = {
  key: string;
  name: string;
  typeLine: string;
  section: YugiohDeckSection;
  imageUrl: string | null;
};

function flattenEntries(entries: YugiohDeckEntry[], section: YugiohDeckSection) {
  return entries.flatMap((entry) =>
    Array.from({ length: entry.quantity }, (_, copyIndex) => ({
      key: `${section}-${entry.card.id}-${copyIndex}`,
      name: entry.card.name,
      typeLine: entry.card.typeLine,
      section,
      imageUrl: entry.card.images.full ?? entry.card.images.small,
    })),
  );
}

function chunkCards(cards: PrintableCard[], size: number) {
  const pages: PrintableCard[][] = [];

  for (let index = 0; index < cards.length; index += size) {
    pages.push(cards.slice(index, index + size));
  }

  return pages;
}

function sectionLabel(section: YugiohDeckSection) {
  return section.charAt(0).toUpperCase() + section.slice(1);
}

export function YugiohPrintSheet() {
  const { theme, main, extra, side } = useYugiohStore();
  const [includeCalibration, setIncludeCalibration] = useState(true);
  const [showCutGuides, setShowCutGuides] = useState(true);

  const printableCards = useMemo(
    () => [
      ...flattenEntries(main, "main"),
      ...flattenEntries(extra, "extra"),
      ...flattenEntries(side, "side"),
    ],
    [extra, main, side],
  );
  const pages = useMemo(
    () => chunkCards(printableCards, YUGIOH_PRINT_PROFILE.cardsPerPage),
    [printableCards],
  );
  const themeLabel = theme?.resolvedArchetype ?? theme?.resolvedBossCards[0] ?? theme?.query.trim() ?? "Yu-Gi-Oh";
  const style = {
    "--yugioh-card-width-mm": `${YUGIOH_PRINT_PROFILE.cardWidthMm}mm`,
    "--yugioh-card-height-mm": `${YUGIOH_PRINT_PROFILE.cardHeightMm}mm`,
    "--yugioh-gutter-mm": `${YUGIOH_PRINT_PROFILE.gutterMm}mm`,
  } as CSSProperties;

  if (printableCards.length === 0) {
    return (
      <main className="print-page-shell">
        <div className="print-toolbar no-print">
          <Link href="/yugioh" className="ghost-button">
            Back to Yu-Gi-Oh
          </Link>
          <p>Build or generate a Yu-Gi-Oh shell first, then this page becomes a cut-ready proxy sheet.</p>
        </div>
      </main>
    );
  }

  return (
    <main
      className={`print-page-shell yugioh-print-shell ${showCutGuides ? "yugioh-print-shell-guides" : ""}`}
      style={style}
    >
      <div className="print-toolbar no-print yugioh-print-toolbar">
        <div className="yugioh-print-toolbar-actions">
          <Link href="/yugioh" className="ghost-button">
            Back to Yu-Gi-Oh
          </Link>
          <button type="button" className="primary-button" onClick={() => window.print()}>
            Print / Save as PDF
          </button>
        </div>

        <div className="yugioh-print-toolbar-copy">
          <strong>{themeLabel}</strong>
          <small>
            {printableCards.length} proxy card{printableCards.length === 1 ? "" : "s"} laid out at{" "}
            {YUGIOH_PRINT_PROFILE.cardWidthMm}mm x {YUGIOH_PRINT_PROFILE.cardHeightMm}mm for personal playtesting.
          </small>
        </div>

        <div className="yugioh-print-toggle-row">
          <label className="yugioh-print-toggle">
            <input
              type="checkbox"
              checked={includeCalibration}
              onChange={(event) => setIncludeCalibration(event.target.checked)}
            />
            <span>Calibration page</span>
          </label>
          <label className="yugioh-print-toggle">
            <input type="checkbox" checked={showCutGuides} onChange={(event) => setShowCutGuides(event.target.checked)} />
            <span>Cut guides</span>
          </label>
        </div>
      </div>

      <section className="summary-grid yugioh-summary-grid no-print">
        <article className="summary-card">
          <span>Main</span>
          <strong>{main.reduce((count, entry) => count + entry.quantity, 0)}</strong>
        </article>
        <article className="summary-card">
          <span>Extra</span>
          <strong>{extra.reduce((count, entry) => count + entry.quantity, 0)}</strong>
        </article>
        <article className="summary-card">
          <span>Side</span>
          <strong>{side.reduce((count, entry) => count + entry.quantity, 0)}</strong>
        </article>
        <article className="summary-card">
          <span>Pages</span>
          <strong>{pages.length + (includeCalibration ? 1 : 0)}</strong>
        </article>
      </section>

      {includeCalibration ? (
        <section className="yugioh-calibration-page">
          <div className="yugioh-calibration-card-outline">
            <span>{YUGIOH_PRINT_PROFILE.cardWidthMm}mm</span>
            <strong>Calibration card outline</strong>
            <small>{YUGIOH_PRINT_PROFILE.cardHeightMm}mm tall</small>
          </div>
          <div className="yugioh-calibration-rulers">
            <div className="yugioh-calibration-ruler yugioh-calibration-ruler-horizontal">
              <span>50mm check</span>
            </div>
            <div className="yugioh-calibration-ruler yugioh-calibration-ruler-vertical">
              <span>80mm check</span>
            </div>
          </div>
          <p className="empty-copy">
            Print this first if you want to sanity-check scale. The card outline should measure exactly{" "}
            {YUGIOH_PRINT_PROFILE.cardWidthMm}mm x {YUGIOH_PRINT_PROFILE.cardHeightMm}mm.
          </p>
        </section>
      ) : null}

      <div className="yugioh-proxy-sheet-stack">
        {pages.map((pageCards, pageIndex) => (
          <section key={`page-${pageIndex}`} className="yugioh-proxy-page">
            {pageCards.map((card) => (
              <article key={card.key} className="yugioh-proxy-card">
                {card.imageUrl ? (
                  <Image
                    src={card.imageUrl}
                    alt={card.name}
                    width={421}
                    height={614}
                    className="yugioh-proxy-image"
                    unoptimized
                  />
                ) : (
                  <div className="proxy-placeholder yugioh-proxy-placeholder">
                    <p>{sectionLabel(card.section)} Proxy</p>
                    <strong>{card.name}</strong>
                    <span>{card.typeLine}</span>
                  </div>
                )}
              </article>
            ))}
          </section>
        ))}
      </div>
    </main>
  );
}
