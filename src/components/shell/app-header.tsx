"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { GameSwitcher } from "@/components/shell/game-switcher";

function getSectionLabel(pathname: string) {
  if (pathname.startsWith("/mtg/print")) {
    return "MTG Print Studio";
  }

  if (pathname.startsWith("/mtg") || pathname.startsWith("/builder") || pathname.startsWith("/print")) {
    return "MTG Commander Lab";
  }

  if (pathname.startsWith("/yugioh/print")) {
    return "Yu-Gi-Oh Print Studio";
  }

  if (pathname.startsWith("/yugioh")) {
    return "Yu-Gi-Oh Duel Forge";
  }

  return "Dual TCG Deck Lab";
}

export function AppHeader() {
  const pathname = usePathname();
  const sectionLabel = getSectionLabel(pathname);

  return (
    <header className="site-header no-print">
      <div className="site-header-inner">
        <Link href="/" className="site-brand">
          <span className="site-brand-mark">CL</span>
          <span className="site-brand-copy">
            <strong>Card Lab</strong>
            <small>Separate MTG and Yu-Gi-Oh labs under one roof.</small>
          </span>
        </Link>

        <div className="site-header-actions">
          <span className="site-section-chip">{sectionLabel}</span>
          <GameSwitcher />
        </div>
      </div>
    </header>
  );
}
