"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { shuffleItems, isCorrectCategory, type Item, type Category } from "@/lib/sort-game";
import { fetchJson } from "@/lib/fetch-json";
import styles from "./page.module.css";

type CheckMode = "immediate" | "batch";

export default function PlaySortSetPage({ params }: { params: { id: string } }) {
  const [title, setTitle] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [pool, setPool] = useState<Item[] | null>(null);
  const [totalItems, setTotalItems] = useState(0);
  const [placed, setPlaced] = useState<Record<string, Item[]>>({});
  const [selected, setSelected] = useState<Item | null>(null);
  const [wrongCategoryId, setWrongCategoryId] = useState<string | null>(null);
  const [correctCategoryId, setCorrectCategoryId] = useState<string | null>(null);
  const [mode, setMode] = useState<CheckMode>("immediate");
  const [revealed, setRevealed] = useState(false);
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
        setTotalItems(allItems.length);
        setPool(shuffleItems(allItems));
        setPlaced(Object.fromEntries(cats.map((c) => [c.id, []])));
      })
      .catch((err) => setError(err.message));
  }, [params.id]);

  const hasStarted = pool !== null && pool.length < totalItems;

  function toggleMode() {
    if (hasStarted) return;
    setMode((m) => (m === "immediate" ? "batch" : "immediate"));
  }

  function selectItem(item: Item) {
    setSelected((prev) => (prev?.id === item.id ? null : item));
  }

  function placeItem(item: Item, categoryId: string) {
    setPool((prev) => (prev ? prev.filter((i) => i.id !== item.id) : prev));
    setPlaced((prev) => ({ ...prev, [categoryId]: [...prev[categoryId], item] }));
  }

  function returnToPool(item: Item, categoryId: string) {
    setPlaced((prev) => ({ ...prev, [categoryId]: prev[categoryId].filter((i) => i.id !== item.id) }));
    setPool((prev) => (prev ? [...prev, item] : prev));
  }

  function clickCategory(category: Category) {
    if (!selected) return;

    if (mode === "batch") {
      placeItem(selected, category.id);
      setSelected(null);
      return;
    }

    if (isCorrectCategory(selected, category)) {
      placeItem(selected, category.id);
      setSelected(null);
      setCorrectCategoryId(category.id);
      setTimeout(() => setCorrectCategoryId(null), 400);
    } else {
      setWrongCategoryId(category.id);
      setTimeout(() => setWrongCategoryId(null), 500);
    }
  }

  function isFullyCorrect() {
    return categories.every((c) => (placed[c.id] ?? []).every((item) => isCorrectCategory(item, c)));
  }

  if (error) return <p className="error-banner">{error}</p>;
  if (!pool) return <p>กำลังโหลด...</p>;

  const won = mode === "immediate" ? totalItems > 0 && pool.length === 0 : revealed && pool.length === 0 && isFullyCorrect();
  const showSubmit = mode === "batch" && pool.length === 0 && !revealed;
  const showResultBanner = mode === "batch" && revealed && !isFullyCorrect();

  return (
    <main className="page">
      <div className="page-header">
        <h1 className="page-title">{title}</h1>
        <Link href="/" className="btn btn-ghost btn-sm">
          ← กลับหน้าแรก
        </Link>
      </div>

      <div className={styles.toolbar}>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={toggleMode}
          disabled={hasStarted}
          title={hasStarted ? "ล็อกโหมดแล้วหลังเริ่มจัดหมวดหมู่" : undefined}
        >
          โหมด: {mode === "immediate" ? "ตรวจทีละอัน" : "ตรวจทีเดียวตอนจบ"}
        </button>
        {!won && <span className={styles.progress}>เหลือ {pool.length} ชิ้น</span>}
      </div>

      {won && <div className={styles.winBanner}>ยินดีด้วย! จัดครบทุกหมวดแล้ว 🎉</div>}
      {showResultBanner && (
        <div className={styles.resultBanner}>มีบางข้อยังไม่ถูกต้อง คลิกการ์ดสีแดงเพื่อจัดใหม่</div>
      )}

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
        {categories.map((category) => {
          const items = placed[category.id] ?? [];
          return (
            <div
              key={category.id}
              className={styles.categoryBox}
              data-wrong={wrongCategoryId === category.id}
              data-correct={correctCategoryId === category.id}
            >
              <button type="button" className={styles.categoryHeaderBtn} onClick={() => clickCategory(category)}>
                <span className={styles.categoryName}>{category.name}</span>
                <span className={`badge ${styles.countBadge}`}>{items.length} ชิ้น</span>
              </button>
              {items.length === 0 && <p className={styles.emptyHint}>คลิกชื่อหมวดหมู่เพื่อวางไอเทม</p>}
              <div className={styles.itemsList}>
                {items.map((item) => {
                  const correct = isCorrectCategory(item, category);
                  const removable = mode === "batch" && revealed && !correct;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={styles.placedItem}
                      data-state={mode === "batch" && !revealed ? undefined : correct ? "correct" : "incorrect"}
                      disabled={!removable}
                      onClick={() => returnToPool(item, category.id)}
                    >
                      {item.text}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {showSubmit && (
        <div className={styles.submitRow}>
          <button type="button" className="btn btn-primary" onClick={() => setRevealed(true)}>
            ส่งคำตอบ
          </button>
        </div>
      )}
    </main>
  );
}
