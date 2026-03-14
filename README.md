# Magic the Gathering Helper

Commander-first MTG deck builder with printable proxy sheets, meta-backed recommendations, combo-pressure checks, and a deck list you can actually tune without fighting the UI.

## Quick Start

```bash
cd "C:\Users\lily7\Claude Code Projects\Magic the Gathering Helper"
npm install
npm run dev
```

## What It Does

- Builds Commander/EDH deck shells around a chosen commander, color identity, and power target
- Pulls in Commander meta context, synergy tags, and average deck-shape hints
- Lets you add and remove cards manually after generation
- Shows card thumbnails in the 100-card list and previews the full card on hover
- Validates the list against Commander color identity and banned cards
- Generates true-size 2.5in x 3.5in proxy sheets for printing and cutting
- Uses Commander Spellbook to estimate combo pressure and bracket feel after the shell is built

## Data Sources

- `Scryfall`
  Card data, commander legality, search, and high-quality card images
- `EDHREC`
  Commander meta, synergy recommendations, tags, and average deck composition signals
- `Commander Spellbook`
  Combo-aware commander signals and full-deck bracket estimation
- `Wizards of the Coast`
  Official Commander banned list source

All of these are free online sources, which keeps the app lightweight enough to run cleanly on Vercel without a heavy local database.

## Product Highlights

### Commander-First Builder

- Search by commander name
- Discover commanders by color identity
- Pick a power preset from `Battlecruiser`, `Focused`, `High Power`, or `Cooked`
- Lean the shell toward a chosen EDHREC tag like tokens, blink, spellslinger, and more

### Deck Tuning UI

- Add custom cards with commander-legal search
- Remove cards from the generated shell
- Hover card thumbnails in the deck list to preview full-size art
- Rebuild after tweaks when you want a refreshed combo/bracket read

### Spellbook Intelligence

- Shows commander-specific combo/profile signals
- Estimates the generated deck’s bracket read from the actual list
- Surfaces compact combo lines, Game Changers, and sharper patterns
- Warns when the built shell looks stronger than the chosen preset

### Printable Proxies

- Dedicated print page
- Standard MTG card size
- Clean grid for cutting physical playtest proxies

## Stack

- Next.js 16
- React 19
- TypeScript
- Zustand
- Tailwind CSS 4
- Zod

## Local Commands

```bash
npm run dev
npm run typecheck
npm run lint
npm run build
```

## Deployment

### GitHub

```bash
git init -b main
git add .
git commit -m "Initial Commander deck builder"
gh repo create RomanRavioli/magic-the-gathering-helper --public --source . --remote origin --push
```

### Vercel

```bash
npx vercel
npx vercel --prod
```

## Notes

- Deck state persists in the browser, which keeps the first version fast and cheap to host.
- The codebase is structured so we can add synced accounts or a hosted database later without rebuilding the product from scratch.

## License

MIT
