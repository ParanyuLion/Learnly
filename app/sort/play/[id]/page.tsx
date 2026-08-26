"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { shuffleItems, isCorrectCategory, type Item, type Category } from "@/lib/sort-game";
import { fetchJson } from "@/lib/fetch-json";
import styles from "./page.module.css";

export default function PlaySortSetPage({ params }: { params: { id: string } }) {
  const [title, setTitle] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [pool, setPool] = useState<Item[] | null>(null);
  const [placed, setPlaced] = useState<Record<string, Item[]>>({});
  const [selected, setSelected] = useState<Item | null>(null);
  const [wrongCategoryId, setWrongCategoryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJson<{
      title: string;
      categories: { id: string; name: string; items: { id: string; text: string; categoryId?: string }[] }[];
    }>(`/api/sort-sets/${params.id}`)
      .then((data) => {
        setTitle(data.title);
        const cats: Category[] = data.categories.map((c) => ({ id: c.id, name: c.name }));
        const allItems: Item[] = data.categories.flatMap((c) =>
          c.items.map((i) => ({ id: i.id, text: i.text, categoryId: c.id }))
        );
        setCategories(cats);
        setPool(shuffleItems(allItems));
        setPlaced(Object.fromEntries(cats.map((c) => [c.id, []])));
      })
      .catch((err) => setError(err.message));
  }, [params.id]);

  function selectItem(item: Item) {
    setSelected((prev) => (prev?.id === item.id ? null : item));
  }

  function clickCategory(category: Category) {
    if (!selected) return;

    if (isCorrectCategory(selected, category)) {
      setPool((prev) => (prev ? prev.filter((i) => i.id !== selected.id) : prev));
      setPlaced((prev) => ({ ...prev, [category.id]: [...prev[category.id], selected] }));
      setSelected(null);
    } else {
      setWrongCategoryId(category.id);
      setTimeout(() => setWrongCategoryId(null), 500);
    }
  }

  if (error) return <p className="error-banner">{error}</p>;
  if (!pool) return <p>กำลังโหลด...</p>;

  const won = categories.length > 0 && pool.length === 0;

  return (
    <main className="page">
      <div className="page-header">
        <h1 className="page-title">{title}</h1>
        <Link href="/" className="btn btn-ghost btn-sm">
          ← กลับหน้าแรก
        </Link>
      </div>
      {won && <div className={styles.winBanner}>ยินดีด้วย! จัดครบทุกหมวดแล้ว 🎉</div>}
      <div className={styles.pool}>
        {pool.map((item) => (
          <button
            key={item.id}
            className={styles.item}
            data-selected={selected?.id === item.id}
            onClick={() => selectItem(item)}
          >
            {item.text}
          </button>
        ))}
      </div>
      <div className={styles.categoryGrid}>
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            className={styles.categoryBox}
            data-wrong={wrongCategoryId === category.id}
            onClick={() => clickCategory(category)}
          >
            <span className={styles.categoryName}>{category.name}</span>
            {placed[category.id]?.map((item) => (
              <span key={item.id} className={styles.placedItem}>
                {item.text}
              </span>
            ))}
          </button>
        ))}
      </div>
    </main>
  );
}
