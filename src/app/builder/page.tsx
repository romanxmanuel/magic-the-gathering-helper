import { DeckBuilderApp } from "@/components/deck-builder/deck-builder-app";
import { fetchCommanderBannedList } from "@/lib/mtg/wizards";

export default async function BuilderPage() {
  const bannedList = await fetchCommanderBannedList();

  return <DeckBuilderApp initialBannedList={bannedList} />;
}
