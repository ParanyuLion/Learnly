export type Pair = { id: string; left: string; right: string };
export type Card = { id: string; pairId: string; text: string; side: "left" | "right" };

export function shuffleIntoCards(pairs: Pair[]): Card[] {
  const cards: Card[] = pairs.flatMap((pair) => [
    { id: `${pair.id}-left`, pairId: pair.id, text: pair.left, side: "left" as const },
    { id: `${pair.id}-right`, pairId: pair.id, text: pair.right, side: "right" as const },
  ]);

  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }

  return cards;
}

export function isMatch(a: Card, b: Card): boolean {
  return a.pairId === b.pairId && a.side !== b.side;
}
