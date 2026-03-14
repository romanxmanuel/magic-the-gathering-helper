import Image from "next/image";

import type { DeckCard } from "@/lib/types";
import { chunk } from "@/lib/utils";

function expandCards(cards: DeckCard[]) {
  return cards.flatMap((card) =>
    Array.from({ length: card.quantity }, (_, index) => ({
      ...card,
      id: `${card.id}-${index + 1}`,
    })),
  );
}

export function ProxySheet({
  commander,
  cards,
}: {
  commander: DeckCard;
  cards: DeckCard[];
}) {
  const pages = chunk(expandCards([commander, ...cards]), 9);

  return (
    <div className="proxy-sheet">
      {pages.map((page, pageIndex) => (
        <section key={`proxy-page-${pageIndex + 1}`} className="proxy-page">
          {page.map((card) => (
            <article key={card.id} className="proxy-card">
              {card.normalImage ? (
                <Image
                  src={card.normalImage}
                  alt={card.name}
                  width={750}
                  height={1050}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-white p-4 text-center text-black">
                  <div>
                    <strong>{card.name}</strong>
                    <p>{card.typeLine}</p>
                  </div>
                </div>
              )}
              <span className="proxy-meta">{card.name}</span>
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}
