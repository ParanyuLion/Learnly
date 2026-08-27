"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchJson } from "@/lib/fetch-json";
import styles from "./page.module.css";

type MatchSetSummary = {
  id: string;
  title: string;
  createdAt: string;
  _count: { pairs: number };
};

type SortSetSummary = {
  id: string;
  title: string;
  createdAt: string;
  _count: { items: number };
};

type FlashcardSetSummary = {
  id: string;
  title: string;
  createdAt: string;
  _count: { cards: number };
};

type Tile =
  | { type: "match"; id: string; title: string; createdAt: string; count: number }
  | { type: "sort"; id: string; title: string; createdAt: string; count: number }
  | { type: "flashcard"; id: string; title: string; createdAt: string; count: number };

const ACCENTS = ["coral", "mint", "lavender", "yellow"] as const;

export default function HomePage() {
  const [tiles, setTiles] = useState<Tile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetchJson<MatchSetSummary[]>("/api/sets").catch((err) => {
        console.error(err);
        return [] as MatchSetSummary[];
      }),
      fetchJson<SortSetSummary[]>("/api/sort-sets").catch((err) => {
        console.error(err);
        return [] as SortSetSummary[];
      }),
      fetchJson<FlashcardSetSummary[]>("/api/flashcard-sets").catch((err) => {
        console.error(err);
        return [] as FlashcardSetSummary[];
      }),
    ])
      .then(([matchSets, sortSets, flashcardSets]) => {
        const matchTiles: Tile[] = matchSets.map((s) => ({
          type: "match",
          id: s.id,
          title: s.title,
          createdAt: s.createdAt,
          count: s._count.pairs,
        }));
        const sortTiles: Tile[] = sortSets.map((s) => ({
          type: "sort",
          id: s.id,
          title: s.title,
          createdAt: s.createdAt,
          count: s._count.items,
        }));
        const flashcardTiles: Tile[] = flashcardSets.map((s) => ({
          type: "flashcard",
          id: s.id,
          title: s.title,
          createdAt: s.createdAt,
          count: s._count.cards,
        }));
        const merged = [...matchTiles, ...sortTiles, ...flashcardTiles].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setTiles(merged);
      })
      .catch((err) => setError(err.message));
  }, []);

  return (
    <main className="page">
      <div className="page-header">
        <h1 className="page-title">ชุดโจทย์ของฉัน</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/edit/new" className="btn btn-primary">
            + เกมจับคู่
          </Link>
          <Link href="/sort/edit/new" className="btn btn-outline">
            + เกมจัดหมวดหมู่
          </Link>
          <Link href="/flashcard/edit/new" className="btn btn-outline">
            + เกมการ์ดคำศัพท์
          </Link>
        </div>
      </div>

      {error && <p className="error-banner">{error}</p>}
      {tiles === null && !error && <p>กำลังโหลด...</p>}
      {tiles?.length === 0 && (
        <div className="empty-state">
          <p>ยังไม่มีชุดโจทย์ สร้างชุดแรกกันเลย</p>
        </div>
      )}

      <div className={styles.grid}>
        {tiles?.map((tile, i) => {
          const playHref =
            tile.type === "match"
              ? `/play/${tile.id}`
              : tile.type === "sort"
                ? `/sort/play/${tile.id}`
                : `/flashcard/play/${tile.id}`;
          const editHref =
            tile.type === "match"
              ? `/edit/${tile.id}`
              : tile.type === "sort"
                ? `/sort/edit/${tile.id}`
                : `/flashcard/edit/${tile.id}`;
          const typeLabel =
            tile.type === "match" ? "จับคู่" : tile.type === "sort" ? "จัดหมวดหมู่" : "การ์ดคำศัพท์";
          const countLabel =
            tile.type === "match"
              ? `${tile.count} คู่`
              : tile.type === "sort"
                ? `${tile.count} ไอเทม`
                : `${tile.count} ใบ`;
          return (
            <div key={`${tile.type}-${tile.id}`} className={styles.card}>
              <div className={styles.cardTop} data-accent={ACCENTS[i % ACCENTS.length]} />
              <div className={styles.cardBody}>
                <span className={styles.typeTag}>{typeLabel}</span>
                <span className={styles.cardTitle}>{tile.title}</span>
                <span className="badge">{countLabel}</span>
                <div className={styles.cardActions}>
                  <Link href={playHref} className="btn btn-primary btn-sm">
                    เล่น
                  </Link>
                  <Link href={editHref} className="btn btn-outline btn-sm">
                    แก้ไข
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
