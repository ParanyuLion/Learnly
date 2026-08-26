export type Category = { id: string; name: string };
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
