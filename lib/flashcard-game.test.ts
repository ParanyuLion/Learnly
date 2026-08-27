import { describe, it, expect } from "vitest";
import { shuffleCards, moveToBack, type Card } from "./flashcard-game";

const cards: Card[] = [
  { id: "c1", front: "Dog", back: "Sunuk" },
  { id: "c2", front: "Cat", back: "Maew" },
  { id: "c3", front: "Bird", back: "Nok" },
];

describe("shuffleCards", () => {
  it("returns the same cards, possibly reordered", () => {
    const shuffled = shuffleCards(cards);
    expect(shuffled).toHaveLength(cards.length);
    expect(new Set(shuffled.map((c) => c.id))).toEqual(new Set(cards.map((c) => c.id)));
  });

  it("does not mutate the input array", () => {
    const copy = [...cards];
    shuffleCards(cards);
    expect(cards).toEqual(copy);
  });
});

describe("moveToBack", () => {
  it("moves the first element to the end", () => {
    const result = moveToBack([1, 2, 3]);
    expect(result).toEqual([2, 3, 1]);
  });

  it("does not mutate the input array", () => {
    const input = [1, 2, 3];
    moveToBack(input);
    expect(input).toEqual([1, 2, 3]);
  });

  it("returns an equivalent single-element array unchanged", () => {
    expect(moveToBack([1])).toEqual([1]);
  });

  it("returns an empty array unchanged", () => {
    expect(moveToBack([])).toEqual([]);
  });
});
