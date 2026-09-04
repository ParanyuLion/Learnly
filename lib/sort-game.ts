export type Category = { id: string; name: string; parentId: string | null };
export type Item = { id: string; text: string; categoryId: string };

export function shuffleItems(items: Item[]): Item[] {
  const copy = [...items];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

export function isCorrectCategory(item: Item, category: Category): boolean {
  return item.categoryId === category.id;
}

export function getChildren<T extends Category>(categories: T[], parentId: string | null): T[] {
  return categories.filter((c) => c.parentId === parentId);
}

export function isLeafCategory(categories: Category[], categoryId: string): boolean {
  return !categories.some((c) => c.parentId === categoryId);
}

export function getLeafCategories<T extends Category>(categories: T[]): T[] {
  return categories.filter((c) => isLeafCategory(categories, c.id));
}

// Nesting depth of a category: 0 for a root category, 1 for its direct
// children, and so on. Returns 0 for an id not present in the list.
export function getCategoryDepth(categories: Category[], categoryId: string): number {
  const category = categories.find((c) => c.id === categoryId);
  if (!category || category.parentId === null) return 0;
  return 1 + getCategoryDepth(categories, category.parentId);
}

// Count of items currently placed anywhere in categoryId's subtree
// (categoryId's own placed items if it's a leaf itself). `placed` maps a
// leaf category id to the items currently placed there during play. Used to
// preview a container category's live progress before it's expanded.
export function countPlacedInSubtree(
  categories: Category[],
  placed: Record<string, Item[]>,
  categoryId: string
): number {
  if (isLeafCategory(categories, categoryId)) {
    return (placed[categoryId] ?? []).length;
  }
  return getChildren(categories, categoryId).reduce(
    (sum, child) => sum + countPlacedInSubtree(categories, placed, child.id),
    0
  );
}
