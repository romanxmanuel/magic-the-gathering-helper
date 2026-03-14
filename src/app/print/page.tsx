"use client";

import Link from "next/link";

import { PrintSheet } from "@/components/deck-builder/print-sheet";
import { useDeckStore } from "@/store/deck-store";

export default function PrintPage() {
  const { selectedCommander, entries } = useDeckStore();

  return (
    <main className="print-page-shell">
      <div className="no-print print-page-topbar">
        <Link href="/" className="ghost-button">
          Back to builder
        </Link>
      </div>
      <PrintSheet commander={selectedCommander} entries={entries} />
    </main>
  );
}
