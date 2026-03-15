"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, type CSSProperties } from "react";

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
        <section className="print-empty-state">
          <p className="panel-kicker">Yu-Gi-Oh Print Studio</p>
          <h2>Build a shell first, then print it here.</h2>
          <p className="empty-copy">
            Once your Duel Forge list has cards in Main, Extra, or Side, this page becomes a Japanese-size proxy sheet
            with optional calibration and cut guides.
          </p>
          <div className="tag-row empty-state-actions">
            <Link href="/yugioh" className="primary-button">
              Back to Duel Forge
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main
      className="print-page-shell yugioh-print-shell ygo-builder-layout"
      style={{ ...style, minHeight: '100vh', padding: '2rem' }}
    >
      <div className="ygo-welcome-panel no-print yugioh-print-toolbar" style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', margin: '0 0 0.4rem 0', color: '#f8fafc', fontFamily: 'var(--font-heading, serif)' }}>{themeLabel} — Print Sheet</h1>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.875rem' }}>
            {printableCards.length} proxy card{printableCards.length === 1 ? '' : 's'} &middot; {YUGIOH_PRINT_PROFILE.cardWidthMm}&thinsp;×&thinsp;{YUGIOH_PRINT_PROFILE.cardHeightMm}&thinsp;mm &middot; 3&thinsp;cards per row
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexShrink: 0 }}>
          <Link
            href="/yugioh"
            className="ygo-section-action"
            style={{ textDecoration: 'none', padding: '0.6rem 1.2rem', fontSize: '0.9rem', display: 'inline-block' }}
          >
            ← Back to Duel Forge
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            style={{
              background: 'linear-gradient(135deg, rgba(34,197,94,0.8), rgba(21,128,61,0.8))',
              border: '1px solid rgba(74,222,128,0.5)',
              borderRadius: '8px',
              padding: '0.6rem 2rem',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            🖨 Print / Save as PDF
          </button>
        </div>
      </div>

      <section className="no-print ygo-list-panel" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { label: 'Main Deck', value: main.reduce((c, e) => c + e.quantity, 0), color: '#f8fafc' },
          { label: 'Extra Deck', value: extra.reduce((c, e) => c + e.quantity, 0), color: '#f8fafc' },
          { label: 'Side Deck', value: side.reduce((c, e) => c + e.quantity, 0), color: '#f8fafc' },
          { label: 'Print Pages', value: pages.length, color: '#4ade80' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ textAlign: 'center', padding: '0.5rem 0' }}>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.25rem' }}>{label}</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </section>

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
