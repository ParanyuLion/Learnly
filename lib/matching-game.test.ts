import { describe, it, expect } from "vitest";
import { shuffleIntoCards, isMatch, type Pair } from "./matching-game";

const pairs: Pair[] = [
  { id: "p1", left: "Dog", right: "Sunuk" },
  { id: "p2", left: "Cat", right: "Maew" },
  { id: "p3", left: "Bird", right: "Nok" },
];

describe("shuffleIntoCards", () => {
  it("produces two cards per pair, one left and one right", () => {
    const cards = shuffleIntoCards(pairs);
    expect(cards).toHaveLength(pairs.length * 2);
    for (const pair of pairs) {
      const cardsForPair = cards.filter((c) => c.pairId === pair.id);
      expect(cardsForPair).toHaveLength(2);
      expect(cardsForPair.some((c) => c.side === "left" && c.text === pair.left)).toBe(true);
      expect(cardsForPair.some((c) => c.side === "right" && c.text === pair.right)).toBe(true);
    }
  });

  it("gives every card a unique id", () => {
    const cards = shuffleIntoCards(pairs);
    const ids = new Set(cards.map((c) => c.id));
    expect(ids.size).toBe(cards.length);
  });
});

describe("isMatch", () => {
  it("returns true for two cards from the same pair on opposite sides", () => {
    const cards = shuffleIntoCards(pairs);
    const left = cards.find((c) => c.pairId === "p1" && c.side === "left")!;
    const right = cards.find((c) => c.pairId === "p1" && c.side === "right")!;
    expect(isMatch(left, right)).toBe(true);
  });

  it("returns false for cards from different pairs", () => {
    const cards = shuffleIntoCards(pairs);
    const left = cards.find((c) => c.pairId === "p1" && c.side === "left")!;
    const right = cards.find((c) => c.pairId === "p2" && c.side === "right")!;
    expect(isMatch(left, right)).toBe(false);
  });

  it("returns false for two cards on the same side", () => {
    const cards = shuffleIntoCards(pairs);
    const left1 = cards.find((c) => c.pairId === "p1" && c.side === "left")!;
    const left2 = cards.find((c) => c.pairId === "p2" && c.side === "left")!;
    expect(isMatch(left1, left2)).toBe(false);
  });
});
