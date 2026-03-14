# Magic the Gathering Helper — Project Context

## What This Is
Commander-first MTG deck builder for playtest proxying, meta-aware recommendations, bracket-aware tuning, and true-size printable proxy sheets.

## Tech Stack
- TypeScript
- Next.js App Router
- Tailwind CSS
- Lightweight client persistence today, with a clean path to libSQL/Turso for shared sync later
- Free external data sources: Scryfall, EDHREC, Commander Spellbook, Wizards of the Coast

## Commands
- `npm install` — install dependencies
- `npm run dev` — start the local dev server
- `npm run build` — production build
- `npm run lint` — run ESLint
- `npm run typecheck` — run TypeScript checks

## Key Decisions
- `Scryfall` is the canonical card source for card objects, images, legality, rulings, and Commander Game Changers.
- `EDHREC` provides commander meta, popularity, salt, and recommendation panels that feed deck construction.
- `Commander Spellbook` powers combo-awareness and Commander-specific power signals.
- `Wizards of the Coast` remains the rules-and-format audit source for Commander brackets and official format copy.
- The first persistence layer is browser-local so the app stays Vercel-light; the code is organized to allow a later SQLite/libSQL upgrade without rewriting the builder.

## File Structure
- `docs/` — source research and architecture notes
- `src/app/` — routes, layout, pages, and API handlers
- `src/components/` — interactive UI and printable proxy components
- `src/lib/` — MTG source clients, deck-building logic, shared utilities, and local deck state
