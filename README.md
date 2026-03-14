# Magic the Gathering Helper

Commander-first deck builder for building EDH shells, tuning them by power, checking combo pressure, and printing true-size proxy sheets for playtesting.

## Setup

```bash
cd "C:\Users\lily7\Claude Code Projects\Magic the Gathering Helper"
npm install
npm run dev
```

## What it does

- Searches Commanders by name or color identity
- Builds 100-card Commander shells from free MTG data sources
- Tunes toward different power presets from battlecruiser to cooked
- Pulls synergy and meta context from EDHREC
- Pulls legal card data and high-resolution images from Scryfall
- Pulls combo pressure and bracket-style reads from Commander Spellbook
- Scrapes the official Commander banned list from Wizards of the Coast
- Lets you tweak the list manually and print cut-ready 2.5in x 3.5in proxy sheets

## Why this stack

This project is designed to stay lightweight enough for Vercel while still feeling like a serious daily Commander tool.

- `Scryfall` is the canonical source for card data, legality, oracle text, and print-quality art
- `EDHREC` supplies Commander meta, recommendation panels, and focus tags
- `Commander Spellbook` adds combo awareness, compact-line detection, and bracket pressure signals
- `Wizards of the Coast` remains the official source for Commander ban-list copy

## Product flow

1. Pick a commander or start from a color identity.
2. Choose a focus tag and power preset.
3. Generate a Commander shell backed by EDHREC + Scryfall.
4. Inspect mechanics primers, combo pressure, and Spellbook bracket reads.
5. Add or remove cards manually.
6. Open the print view and generate true-size playtest proxies.

## Tech stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Zustand for lightweight local persistence

## Commands

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
```

## Deployment

This app does not require secret environment variables for the current feature set.

### GitHub

```bash
git add .
git commit -m "Build Commander-first MTG deck helper"
git branch -M main
git remote add origin https://github.com/<your-username>/magic-the-gathering-helper.git
git push -u origin main
```

### Vercel

```bash
npx vercel
npx vercel --prod
```

## Notes

- Deck persistence is browser-local right now so the app stays cheap and fast to host.
- The codebase is organized so a future shared deck store can move to libSQL or Turso without rewriting the UI.
- Manual edits intentionally invalidate the live Spellbook bracket read until you rebuild the shell, so the combo-pressure signal stays honest.

## License

MIT
