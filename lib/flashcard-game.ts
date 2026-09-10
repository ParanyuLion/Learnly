export type Card = { id: string; front: string; back: string; imageUrl?: string | null };

export function shuffleCards(cards: Card[]): Card[] {
  const copy = [...cards];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

export function moveToBack<T>(deck: T[]): T[] {
  if (deck.length <= 1) return [...deck];
  const [first, ...rest] = deck;
  return [...rest, first];
}

function shuffleStrings(values: string[]): string[] {
  const copy = [...values];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

// Builds the multiple-choice answers for a quiz question on `current`: its
// own back text plus up to `maxChoices - 1` distinct distractor texts drawn
// from other cards' backs, all in randomized order. Duplicate back text
// (whether matching the correct answer or repeated across other cards) is
// deduped so the same string never appears twice in the result. Returns
// fewer than `maxChoices` entries when the deck doesn't have enough distinct
// back text to fill it.
export function buildQuizChoices(current: Card, allCards: Card[], maxChoices: number): string[] {
  const distractorPool = Array.from(
    new Set(allCards.filter((c) => c.id !== current.id).map((c) => c.back))
  ).filter((back) => back !== current.back);

  const distractors = shuffleStrings(distractorPool).slice(0, Math.max(0, maxChoices - 1));

  return shuffleStrings([current.back, ...distractors]);
}
