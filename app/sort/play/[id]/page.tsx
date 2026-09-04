"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  shuffleItems,
  isCorrectCategory,
  getChildren,
  isLeafCategory,
  getLeafCategories,
  countPlacedInSubtree,
  getCategoryDepth,
  type Item,
  type Category,
} from "@/lib/sort-game";
import { fetchJson } from "@/lib/fetch-json";
import styles from "./page.module.css";

type CheckMode = "immediate" | "batch";

export default function PlaySortSetPage({ params }: { params: { id: string } }) {
  const [title, setTitle] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [sourceItems, setSourceItems] = useState<Item[]>([]);
  const [pool, setPool] = useState<Item[] | null>(null);
  const [totalItems, setTotalItems] = useState(0);
  const [placed, setPlaced] = useState<Record<string, Item[]>>({});
  const [selected, setSelected] = useState<Item | null>(null);
  const [wrongCategoryId, setWrongCategoryId] = useState<string | null>(null);
  const [correctCategoryId, setCorrectCategoryId] = useState<string | null>(null);
  const [mode, setMode] = useState<CheckMode>("immediate");
  const [revealed, setRevealed] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  // Mounted a beat longer than expandedIds so a closing category keeps its
  // children in the DOM through the collapse animation instead of vanishing
  // instantly; cleared once the collapse transition finishes.
  const [mountedIds, setMountedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // FLIP-animation bookkeeping: track each item button's current DOM node so we
  // can read its on-screen position right before it moves, then slide the new
  // element in from that same screen position instead of just fading in place.
  const itemElRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const pendingFlip = useRef<Map<string, DOMRect>>(new Map());

  function captureForFlip(id: string) {
    const el = itemElRefs.current.get(id);
    if (el) pendingFlip.current.set(id, el.getBoundingClientRect());
  }

  function itemFlipRef(id: string) {
    return (el: HTMLButtonElement | null) => {
      if (!el) {
        itemElRefs.current.delete(id);
        return;
      }
      itemElRefs.current.set(id, el);

      const fromRect = pendingFlip.current.get(id);
      if (!fromRect) return;
      pendingFlip.current.delete(id);

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const toRect = el.getBoundingClientRect();
      const dx = fromRect.left - toRect.left;
      const dy = fromRect.top - toRect.top;
      if (dx === 0 && dy === 0) return;

      el.style.transition = "none";
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      void el.offsetWidth; // force layout so the transform above actually paints before we animate away from it
      requestAnimationFrame(() => {
        el.style.transition = "transform 0.3s ease";
        el.style.transform = "translate(0, 0)";
      });

      const cleanup = () => {
        el.style.transition = "";
        el.style.transform = "";
        el.removeEventListener("transitionend", cleanup);
      };
      el.addEventListener("transitionend", cleanup);
    };
  }

  useEffect(() => {
    fetchJson<{
      title: string;
      categories: { id: string; name: string; parentId: string | null }[];
      items: { id: string; text: string; categoryId: string }[];
    }>(`/api/sort-sets/${params.id}`)
      .then((data) => {
        setTitle(data.title);
        setCategories(data.categories);
        setSourceItems(data.items);
        setTotalItems(data.items.length);
        setPool(shuffleItems(data.items));
        setPlaced(Object.fromEntries(data.categories.map((c) => [c.id, []])));
      })
      .catch((err) => setError(err.message));
  }, [params.id]);

  const hasStarted = pool !== null && pool.length < totalItems;

  function playAgain() {
    setPool(shuffleItems(sourceItems));
    setPlaced(Object.fromEntries(categories.map((c) => [c.id, []])));
    setSelected(null);
    setWrongCategoryId(null);
    setCorrectCategoryId(null);
    setRevealed(false);
    setExpandedIds(new Set());
    setMountedIds(new Set());
  }

  function toggleMode() {
    if (hasStarted) return;
    setMode((m) => (m === "immediate" ? "batch" : "immediate"));
  }

  function toggleExpand(categoryId: string) {
    // With prefers-reduced-motion the collapse CSS transition never runs, so
    // transitionend never fires — unmount immediately in that case instead
    // of leaving the content mounted forever after the first expand.
    const reducedMotion =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
        if (reducedMotion) {
          setMountedIds((m) => {
            const nextM = new Set(m);
            nextM.delete(categoryId);
            return nextM;
          });
        }
      } else {
        next.add(categoryId);
        setMountedIds((m) => new Set(m).add(categoryId));
      }
      return next;
    });
  }

  function handleCollapseTransitionEnd(categoryId: string) {
    if (expandedIds.has(categoryId)) return; // opened, or reopened before this fired — stay mounted
    setMountedIds((prev) => {
      if (!prev.has(categoryId)) return prev;
      const next = new Set(prev);
      next.delete(categoryId);
      return next;
    });
  }

  function selectItem(item: Item) {
    setSelected((prev) => (prev?.id === item.id ? null : item));
  }

  function placeItem(item: Item, categoryId: string) {
    captureForFlip(item.id);
    setPool((prev) => (prev ? prev.filter((i) => i.id !== item.id) : prev));
    setPlaced((prev) => ({ ...prev, [categoryId]: [...prev[categoryId], item] }));
  }

  function returnToPool(item: Item, categoryId: string) {
    captureForFlip(item.id);
    setPlaced((prev) => ({ ...prev, [categoryId]: prev[categoryId].filter((i) => i.id !== item.id) }));
    setPool((prev) => (prev ? [...prev, item] : prev));
  }

  function clickCategory(category: Category) {
    if (!isLeafCategory(categories, category.id)) {
      toggleExpand(category.id);
      return;
    }

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
    return getLeafCategories(categories).every((c) =>
      (placed[c.id] ?? []).every((item) => isCorrectCategory(item, c))
    );
  }

  if (error) return <p className="error-banner">{error}</p>;
  if (!pool) {
    return (
      <main className="page">
        <div className="page-header">
          <h1 className="page-title">
            <span className="skeleton" style={{ display: "inline-block", width: 160, height: 24 }} />
          </h1>
          <Link href="/" className="btn btn-ghost btn-sm">
            ← กลับหน้าแรก
          </Link>
        </div>
        <div className={styles.pool}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`${styles.item} skeleton`} style={{ width: 70, height: 20 }} />
          ))}
        </div>
        <div className={styles.categoryGrid}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={`${styles.categoryBox} skeleton`} />
          ))}
        </div>
      </main>
    );
  }

  const won = mode === "immediate" ? totalItems > 0 && pool.length === 0 : revealed && pool.length === 0 && isFullyCorrect();
  const showSubmit = mode === "batch" && pool.length === 0 && !revealed;
  const showResultBanner = mode === "batch" && revealed && !isFullyCorrect();

  function renderCategoryNode(category: Category) {
    const isLeaf = isLeafCategory(categories, category.id);
    const depthMod = getCategoryDepth(categories, category.id) % 4;

    if (isLeaf) {
      const items = placed[category.id] ?? [];
      return (
        <div
          key={category.id}
          className={styles.categoryBox}
          data-depth={depthMod}
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
              const removable = mode === "batch" && (!revealed || !correct);
              return (
                <button
                  key={item.id}
                  ref={itemFlipRef(item.id)}
                  type="button"
                  className={styles.placedItem}
                  data-depth={depthMod}
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
    }

    const isExpanded = expandedIds.has(category.id);
    const children = getChildren(categories, category.id);

    return (
      <div key={category.id} className={styles.categoryBox} data-depth={depthMod}>
        <button
          type="button"
          className={styles.categoryHeaderBtn}
          onClick={() => clickCategory(category)}
          aria-expanded={isExpanded}
        >
          <span className={styles.categoryName}>
            <span className={styles.expandIcon} data-expanded={isExpanded}>
              ▸
            </span>{" "}
            {category.name}
          </span>
          <span className={`badge ${styles.countBadge}`}>
            {countPlacedInSubtree(categories, placed, category.id)} ชิ้น
          </span>
        </button>
        {!isExpanded && (
          <div className={styles.childPreviewList}>
            {children.map((child) => (
              <span key={child.id} className={styles.childPreviewItem}>
                {child.name}: {countPlacedInSubtree(categories, placed, child.id)} ชิ้น
              </span>
            ))}
          </div>
        )}
        <div
          className={styles.collapseTrack}
          data-expanded={isExpanded}
          onTransitionEnd={(e) => {
            if (e.target === e.currentTarget) handleCollapseTransitionEnd(category.id);
          }}
        >
          <div className={styles.collapseContent}>
            {mountedIds.has(category.id) && (
              <div className={styles.childList}>{children.map((child) => renderCategoryNode(child))}</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="page">
      <div className="page-header">
        <h1 className="page-title">{title}</h1>
        <Link href="/" className="btn btn-ghost btn-sm">
          ← กลับหน้าแรก
        </Link>
      </div>

      <div className={styles.toolbar}>
        <div
          className={styles.modeSwitch}
          data-mode={mode}
          title={hasStarted ? "ล็อกโหมดแล้วหลังเริ่มจัดหมวดหมู่" : undefined}
        >
          <button
            type="button"
            className={styles.modeLabel}
            data-active={mode === "immediate"}
            onClick={() => mode !== "immediate" && toggleMode()}
            disabled={hasStarted}
          >
            ตรวจทีละอัน
          </button>
          <button
            type="button"
            className={styles.modeTrack}
            onClick={toggleMode}
            disabled={hasStarted}
            role="switch"
            aria-checked={mode === "batch"}
            aria-label="สลับโหมดการตรวจคำตอบ"
          >
            <span className={styles.modeThumb} />
          </button>
          <button
            type="button"
            className={styles.modeLabel}
            data-active={mode === "batch"}
            onClick={() => mode !== "batch" && toggleMode()}
            disabled={hasStarted}
          >
            ตรวจทีเดียวตอนจบ
          </button>
        </div>
        {!won && <span className={styles.progress}>เหลือ {pool.length} ชิ้น</span>}
      </div>

      {won && (
        <div className={styles.winBanner}>
          <span>ยินดีด้วย! จัดครบทุกหมวดแล้ว 🎉</span>
          <button className="btn btn-primary btn-sm" onClick={playAgain}>
            เล่นอีกครั้ง
          </button>
        </div>
      )}
      {showResultBanner && (
        <div className={styles.resultBanner}>มีบางข้อยังไม่ถูกต้อง คลิกการ์ดสีแดงเพื่อจัดใหม่</div>
      )}

      <div className={styles.pool}>
        {pool.map((item) => (
          <button
            key={item.id}
            ref={itemFlipRef(item.id)}
            className={styles.item}
            data-selected={selected?.id === item.id}
            onClick={() => selectItem(item)}
          >
            {item.text}
          </button>
        ))}
      </div>

      <div className={styles.categoryGrid}>
        {getChildren(categories, null).map((category) => renderCategoryNode(category))}
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
