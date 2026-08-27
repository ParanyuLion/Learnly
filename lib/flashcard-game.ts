export type Card = { id: string; front: string; back: string };

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
