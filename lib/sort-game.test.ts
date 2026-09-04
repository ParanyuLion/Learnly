import { describe, it, expect } from "vitest";
import {
  shuffleItems,
  isCorrectCategory,
  getChildren,
  isLeafCategory,
  getLeafCategories,
  countItemsInSubtree,
  type Item,
  type Category,
} from "./sort-game";

const categories: Category[] = [
  { id: "c1", name: "Fruit", parentId: null },
  { id: "c2", name: "Vegetable", parentId: null },
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

const nestedCategories: Category[] = [
  { id: "root1", name: "Animals", parentId: null },
  { id: "root2", name: "Plants", parentId: null },
  { id: "child1", name: "Mammals", parentId: "root1" },
  { id: "child2", name: "Birds", parentId: "root1" },
  { id: "grandchild1", name: "Dogs", parentId: "child1" },
];

describe("getChildren", () => {
  it("returns root-level categories when parentId is null", () => {
    const roots = getChildren(nestedCategories, null);
    expect(roots.map((c) => c.id).sort()).toEqual(["root1", "root2"]);
  });

  it("returns the direct children of a mid-tree parent", () => {
    const children = getChildren(nestedCategories, "root1");
    expect(children.map((c) => c.id).sort()).toEqual(["child1", "child2"]);
  });

  it("returns an empty array for a leaf with no children", () => {
    expect(getChildren(nestedCategories, "child2")).toEqual([]);
  });

  it("returns an empty array for an empty category list", () => {
    expect(getChildren([], null)).toEqual([]);
  });
});

describe("isLeafCategory", () => {
  it("returns false for a category that has children", () => {
    expect(isLeafCategory(nestedCategories, "root1")).toBe(false);
  });

  it("returns true for a category with no children", () => {
    expect(isLeafCategory(nestedCategories, "child2")).toBe(true);
  });

  it("returns true for a grandchild leaf", () => {
    expect(isLeafCategory(nestedCategories, "grandchild1")).toBe(true);
  });
});

describe("getLeafCategories", () => {
  it("returns only categories with no children", () => {
    const leaves = getLeafCategories(nestedCategories).map((c) => c.id).sort();
    expect(leaves).toEqual(["child2", "grandchild1", "root2"]);
  });

  it("returns an empty array for an empty category list", () => {
    expect(getLeafCategories([])).toEqual([]);
  });

  it("treats every category as a leaf when none has children", () => {
    expect(getLeafCategories(categories).map((c) => c.id).sort()).toEqual(["c1", "c2"]);
  });
});

const nestedItems: Item[] = [
  { id: "ni1", text: "Sparrow", categoryId: "child2" }, // Birds
  { id: "ni2", text: "Robin", categoryId: "child2" }, // Birds
  { id: "ni3", text: "Beagle", categoryId: "grandchild1" }, // Dogs
  { id: "ni4", text: "Rose", categoryId: "root2" }, // Plants
];

describe("countItemsInSubtree", () => {
  it("returns the item count of a leaf category directly", () => {
    expect(countItemsInSubtree(nestedCategories, nestedItems, "child2")).toBe(2);
  });

  it("sums items across all descendant leaves of a mid-tree container", () => {
    // root1 (Animals) -> child1 (Mammals) -> grandchild1 (Dogs, 1 item)
    //                  -> child2 (Birds, 2 items)
    expect(countItemsInSubtree(nestedCategories, nestedItems, "root1")).toBe(3);
  });

  it("sums through an intermediate container with a single leaf descendant", () => {
    expect(countItemsInSubtree(nestedCategories, nestedItems, "child1")).toBe(1);
  });

  it("returns 0 for a leaf category with no items", () => {
    expect(countItemsInSubtree(nestedCategories, [], "root2")).toBe(0);
  });
});
