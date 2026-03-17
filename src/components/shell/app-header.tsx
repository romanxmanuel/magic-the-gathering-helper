"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { GameSwitcher } from "@/components/shell/game-switcher";

function getSectionLabel(pathname: string) {
  if (pathname.startsWith("/mtg/print")) {
    return "Command Lab Print Studio";
  }

  if (pathname.startsWith("/mtg") || pathname.startsWith("/builder") || pathname.startsWith("/print")) {
    return "MTG Command Lab";
  }

  if (pathname.startsWith("/yugioh/print")) {
    return "Duel Lab Print Studio";
  }

  if (pathname.startsWith("/yugioh")) {
    return "Yu-Gi-Oh Duel Lab";
  }

  return "Dual TCG Forge";
}

export function AppHeader() {
  const pathname = usePathname();
  const sectionLabel = getSectionLabel(pathname);

  return (
    <header className="site-header no-print">
      <div className="site-header-inner">
        <Link href="/" className="site-brand">
          <span className="site-brand-mark">DF</span>
          <span className="site-brand-copy">
            <strong>Duel Forge</strong>
            <small>Command Lab for MTG. Duel Lab for Yu-Gi-Oh.</small>
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
