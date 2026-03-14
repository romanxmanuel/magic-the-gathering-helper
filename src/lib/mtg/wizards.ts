import * as cheerio from "cheerio";

export async function fetchCommanderBannedList() {
  const response = await fetch("https://magic.wizards.com/en/banned-restricted-list", {
    next: {
      revalidate: 60 * 60 * 24,
    },
  });

  if (!response.ok) {
    throw new Error(`Wizards banned list request failed: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const cards = new Set<string>();

  $("#commander-banned li").each((_, element) => {
    const text = $(element).text().trim();

    if (!text) {
      return;
    }

    if (
      text.includes("Conspiracy") ||
      text.includes("ante") ||
      text.includes("racially or culturally offensive")
    ) {
      return;
    }

    cards.add(text);
  });

  return [...cards].sort((left, right) => left.localeCompare(right));
}
