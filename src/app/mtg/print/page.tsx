"use client";

import Link from "next/link";

import { PrintSheet } from "@/components/deck-builder/print-sheet";
import { useMtgStore } from "@/store/mtg-store";

export default function MtgPrintPage() {
  const { selectedCommander, entries } = useMtgStore();

  return (
    <main className="print-page-shell">
      <div className="no-print print-page-topbar">
        <div className="print-toolbar-copy">
          <strong>Commander print studio</strong>
          <small>Generate clean 2.5in x 3.5in playtest sheets and export them through your browser print dialog.</small>
        </div>
        <Link href="/mtg" className="ghost-button">
          Back to MTG builder
        </Link>
      </div>
      <PrintSheet commander={selectedCommander} entries={entries} />
    </main>
  );
}
