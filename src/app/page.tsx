import { DeckBuilderApp } from "@/components/deck-builder/deck-builder-app";
import { fetchCommanderBannedList } from "@/lib/mtg/wizards";

export default async function HomePage() {
  const bannedList = await fetchCommanderBannedList();

  return <DeckBuilderApp initialBannedList={bannedList} />;
}
