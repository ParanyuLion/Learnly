import { describe, it, expect } from "vitest";
import { shuffleItems, isCorrectCategory, type Item, type Category } from "./sort-game";

const categories: Category[] = [
  { id: "c1", name: "Fruit" },
  { id: "c2", name: "Vegetable" },
];

const items: Item[] = [
  { id: "i1", text: "Apple", categoryId: "c1" },
  { id: "i2", text: "Carrot", categoryId: "c2" },
  { id: "i3", text: "Banana", categoryId: "c1" },
];

describe("shuffleItems", () => {
  it("returns the same items, possibly reordered", () => {
    const shuffled = shuffleItems(items);
    expect(shuffled).toHaveLength(items.length);
    expect(new Set(shuffled.map((i) => i.id))).toEqual(new Set(items.map((i) => i.id)));
  });

  it("does not mutate the input array", () => {
    const copy = [...items];
    shuffleItems(items);
    expect(items).toEqual(copy);
  });
});

describe("isCorrectCategory", () => {
  it("returns true when the item belongs to the category", () => {
    expect(isCorrectCategory(items[0], categories[0])).toBe(true);
  });

  it("returns false when the item belongs to a different category", () => {
    expect(isCorrectCategory(items[0], categories[1])).toBe(false);
  });

  it("returns true for every item matched against its own correct category", () => {
    for (const item of items) {
      const correct = categories.find((c) => c.id === item.categoryId)!;
      expect(isCorrectCategory(item, correct)).toBe(true);
    }
  });
});
