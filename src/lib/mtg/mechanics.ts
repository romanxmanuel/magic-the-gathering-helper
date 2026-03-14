import type {
  CommanderMechanicInsight,
  CommanderOption,
  SpellbookCardInsight,
  TagOption,
} from "@/lib/mtg/types";

function includesAny(text: string, patterns: string[]) {
  return patterns.some((pattern) => text.includes(pattern));
}

function pushUnique(items: string[], value: string) {
  if (value && !items.includes(value)) {
    items.push(value);
  }
}

export function deriveCommanderMechanics(
  commander: CommanderOption | null,
  tags: TagOption[] = [],
  spellbook: SpellbookCardInsight | null = null,
): CommanderMechanicInsight | null {
  if (!commander) {
    return null;
  }

  const oracleText = (commander.oracleText ?? "").toLowerCase();
  const typeLine = commander.typeLine.toLowerCase();
  const tagLabels = tags.map((tag) => tag.label);
  const signatureMechanics: string[] = [];
  const playPatterns: string[] = [];

  if (includesAny(oracleText, ["ninjutsu", "commander ninjutsu"])) {
    pushUnique(signatureMechanics, "Ninjutsu");
    pushUnique(playPatterns, "Lead with evasive creatures so your commander can slip in after blockers are declared.");
  }

  if (oracleText.includes("combat damage to a player")) {
    pushUnique(signatureMechanics, "Combat-damage triggers");
    pushUnique(playPatterns, "Prioritize unblockable pressure, tempo plays, and cheap interaction that clears combat lanes.");
  }

  if (includesAny(oracleText, ["whenever you cast", "instant or sorcery", "noncreature spell"])) {
    pushUnique(signatureMechanics, "Spellslinger");
    pushUnique(playPatterns, "Chain low-cost spells and cantrips so every cast advances your engine instead of just replacing itself.");
  }

  if (includesAny(oracleText, ["create a treasure", "treasure token"])) {
    pushUnique(signatureMechanics, "Treasure ramp");
    pushUnique(playPatterns, "Convert burst mana into double-spell turns and protect the turn where you pivot from setup into payoff.");
  }

  if (includesAny(oracleText, ["+1/+1 counter", "+1/+1 counters"])) {
    pushUnique(signatureMechanics, "+1/+1 counters");
    pushUnique(playPatterns, "Stack repeatable counter payoffs so each creature scales into a real threat instead of staying medium.");
  }

  if (includesAny(oracleText, ["sacrifice", "dies", "when another creature dies"])) {
    pushUnique(signatureMechanics, "Aristocrats / sacrifice");
    pushUnique(playPatterns, "Feed disposable creatures into value engines and make sure the deck can profit from both the sac outlet and the death trigger.");
  }

  if (includesAny(oracleText, ["from your graveyard", "return target card", "reanimate"])) {
    pushUnique(signatureMechanics, "Graveyard recursion");
    pushUnique(playPatterns, "Treat the graveyard like a second hand and lean into discard, mill, or self-sac lines that keep gas flowing.");
  }

  if (includesAny(oracleText, ["artifact", "artifacts"])) {
    pushUnique(signatureMechanics, "Artifact synergy");
  }

  if (includesAny(oracleText, ["enchantment", "enchantments"])) {
    pushUnique(signatureMechanics, "Enchantment synergy");
  }

  if (includesAny(oracleText, ["token", "create a"])) {
    pushUnique(signatureMechanics, "Token generation");
  }

  if (includesAny(oracleText, ["top card of your library", "reveal the top card", "look at the top"])) {
    pushUnique(signatureMechanics, "Topdeck manipulation");
    pushUnique(playPatterns, "Use top-of-library setup so your commander converts information advantage into damage, cards, or both.");
  }

  if (includesAny(oracleText, ["landfall", "whenever a land enters"])) {
    pushUnique(signatureMechanics, "Landfall");
    pushUnique(playPatterns, "Play extra land drops or cheap ramp so every turn multiplies permanent board value.");
  }

  if (typeLine.includes("dragon")) {
    pushUnique(signatureMechanics, "Tribal payoffs");
  }

  for (const tag of tagLabels) {
    if (/blink|flicker/i.test(tag)) {
      pushUnique(signatureMechanics, "Blink / flicker");
      pushUnique(playPatterns, "Reuse enter-the-battlefield effects and protect your best permanents by blinking through removal.");
    }

    if (/reanimator|graveyard/i.test(tag)) {
      pushUnique(signatureMechanics, "Graveyard recursion");
    }

    if (/tokens/i.test(tag)) {
      pushUnique(signatureMechanics, "Token generation");
    }

    if (/voltron/i.test(tag)) {
      pushUnique(signatureMechanics, "Voltron pressure");
      pushUnique(playPatterns, "Protect one threat, suit it up efficiently, and force opponents to answer the commander on your terms.");
    }

    if (/lifegain|drain/i.test(tag)) {
      pushUnique(signatureMechanics, "Life drain");
    }

    if (/stax|taxes/i.test(tag)) {
      pushUnique(signatureMechanics, "Resource denial");
    }
  }

  for (const keyword of spellbook?.keywords ?? []) {
    pushUnique(signatureMechanics, keyword);
  }

  for (const feature of spellbook?.features ?? []) {
    if (/empty library/i.test(feature)) {
      pushUnique(signatureMechanics, "Oracle-style combo finishes");
    }

    if (/extra turn/i.test(feature)) {
      pushUnique(signatureMechanics, "Extra-turn lines");
    }
  }

  if (spellbook?.tutor) {
    pushUnique(playPatterns, "Because the commander naturally supports tutoring patterns, compact packages and silver bullets get more reliable.");
  }

  if (spellbook?.extraTurn) {
    pushUnique(playPatterns, "Extra-turn effects read much stronger here, so hold them for turns where the commander already has board presence.");
  }

  const narrowedMechanics = signatureMechanics.slice(0, 6);
  const narrowedPatterns = playPatterns.slice(0, 4);
  const primer =
    narrowedMechanics.length > 0
      ? `${commander.name} usually plays like a ${narrowedMechanics.slice(0, 2).join(" + ")} commander shell. Build toward repeated engines, not one-off cute lines.`
      : `${commander.name} wants a coherent engine more than generic staples. Start with the commander text, then fill the deck with cards that repeat that pattern every game.`;

  return {
    primer,
    signatureMechanics: narrowedMechanics,
    playPatterns: narrowedPatterns,
  };
}
