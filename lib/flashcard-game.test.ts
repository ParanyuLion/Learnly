import { describe, it, expect } from "vitest";
import { shuffleCards, moveToBack, buildQuizChoices, type Card } from "./flashcard-game";

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

describe("buildQuizChoices", () => {
  it("always includes the current card's own back text", () => {
    const choices = buildQuizChoices(cards[0], cards, 5);
    expect(choices).toContain(cards[0].back);
  });

  it("caps the number of choices at maxChoices", () => {
    const manyCards: Card[] = Array.from({ length: 10 }, (_, i) => ({
      id: `c${i}`,
      front: `front${i}`,
      back: `back${i}`,
    }));
    const choices = buildQuizChoices(manyCards[0], manyCards, 5);
    expect(choices).toHaveLength(5);
  });

  it("returns fewer than maxChoices when not enough distinct back text exists", () => {
    const choices = buildQuizChoices(cards[0], cards, 5);
    expect(choices).toHaveLength(3); // only 3 distinct backs total across `cards`
  });

  it("never duplicates a back text, even if multiple cards share one", () => {
    const dupCards: Card[] = [
      { id: "a", front: "A", back: "Same" },
      { id: "b", front: "B", back: "Same" },
      { id: "c", front: "C", back: "Other" },
    ];
    const choices = buildQuizChoices(dupCards[0], dupCards, 5);
    expect(choices).toEqual(expect.arrayContaining(["Same", "Other"]));
    expect(choices).toHaveLength(2);
  });

  it("does not mutate the input array", () => {
    const copy = [...cards];
    buildQuizChoices(cards[0], cards, 5);
    expect(cards).toEqual(copy);
  });
});
