"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchJson } from "@/lib/fetch-json";
import { AlertDialog } from "@/components/AlertDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
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

type TypeFilter = "all" | Tile["type"];

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "match", label: "จับคู่" },
  { value: "sort", label: "จัดหมวดหมู่" },
  { value: "flashcard", label: "การ์ดคำศัพท์" },
];

async function logout() {
  await fetchJson("/api/logout", { method: "POST" });
  window.location.href = "/login";
}

export default function HomePage() {
  const [tiles, setTiles] = useState<Tile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failedTypes, setFailedTypes] = useState<string[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Tile | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!showCreateModal) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setShowCreateModal(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [showCreateModal]);

  useEffect(() => {
    const failed: string[] = [];
    Promise.all([
      fetchJson<MatchSetSummary[]>("/api/sets").catch((err) => {
        console.error(err);
        failed.push("จับคู่");
        return [] as MatchSetSummary[];
      }),
      fetchJson<SortSetSummary[]>("/api/sort-sets").catch((err) => {
        console.error(err);
        failed.push("จัดหมวดหมู่");
        return [] as SortSetSummary[];
      }),
      fetchJson<FlashcardSetSummary[]>("/api/flashcard-sets").catch((err) => {
        console.error(err);
        failed.push("การ์ดคำศัพท์");
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
        setFailedTypes(failed);
      })
      .catch((err) => setError(err.message));
  }, []);

  async function confirmDelete() {
    const tile = pendingDelete;
    if (!tile) return;
    setPendingDelete(null);

    const endpoint =
      tile.type === "match"
        ? `/api/sets/${tile.id}`
        : tile.type === "sort"
          ? `/api/sort-sets/${tile.id}`
          : `/api/flashcard-sets/${tile.id}`;

    setDeletingId(tile.id);
    try {
      await fetchJson(endpoint, { method: "DELETE" });
      setTiles((prev) => (prev ? prev.filter((t) => !(t.type === tile.type && t.id === tile.id)) : prev));
    } catch (err) {
      setAlertMessage(err instanceof Error ? err.message : "ลบไม่สำเร็จ");
    } finally {
      setDeletingId(null);
    }
  }

  const filteredTiles = tiles?.filter((tile) => {
    const matchesType = typeFilter === "all" || tile.type === typeFilter;
    const matchesSearch = tile.title.toLowerCase().includes(search.trim().toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <main className="page">
      <AlertDialog message={alertMessage} onClose={() => setAlertMessage(null)} />
      <ConfirmDialog
        message={pendingDelete ? `ลบ "${pendingDelete.title}" ใช่ไหม? การกระทำนี้ย้อนกลับไม่ได้` : null}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
        confirmLabel="ลบ"
      />
      <div className="page-header">
        <h1 className="page-title">ชุดโจทย์ของฉัน</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            + สร้างชุดโจทย์
          </button>
          <button className="btn btn-ghost btn-sm" onClick={logout}>
            ออกจากระบบ
          </button>
        </div>
      </div>

      {showCreateModal && (
        <div className="dialog-overlay" onClick={() => setShowCreateModal(false)}>
          <div
            className="dialog-box"
            role="dialog"
            aria-modal="true"
            aria-label="เลือกประเภทเกมที่จะสร้าง"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className={styles.modalTitle}>สร้างชุดโจทย์แบบไหน?</h2>
            <div className={styles.modalOptions}>
              <Link href="/edit/new" className={styles.modalOption} data-accent="coral">
                <span className={styles.modalOptionTitle}>เกมจับคู่</span>
                <span className={styles.modalOptionDesc}>จับคู่คำศัพท์ซ้าย-ขวา</span>
              </Link>
              <Link href="/sort/edit/new" className={styles.modalOption} data-accent="mint">
                <span className={styles.modalOptionTitle}>เกมจัดหมวดหมู่</span>
                <span className={styles.modalOptionDesc}>จัดไอเทมลงหมวดหมู่ให้ถูก</span>
              </Link>
              <Link href="/flashcard/edit/new" className={styles.modalOption} data-accent="lavender">
                <span className={styles.modalOptionTitle}>เกมการ์ดคำศัพท์</span>
                <span className={styles.modalOptionDesc}>พลิกการ์ดทบทวนคำศัพท์</span>
              </Link>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowCreateModal(false)}>
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      {error && <p className="error-banner">{error}</p>}
      {failedTypes.length > 0 && (
        <p className="error-banner">
          โหลดชุดโจทย์บางประเภทไม่สำเร็จ: {failedTypes.join(", ")}
        </p>
      )}

      {tiles !== null && tiles.length > 0 && (
        <div className={styles.toolbar}>
          <input
            type="text"
            className={`text-input ${styles.searchInput}`}
            placeholder="ค้นหาชื่อชุดโจทย์..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className={styles.filterPills}>
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                className={styles.filterPill}
                data-active={typeFilter === f.value}
                onClick={() => setTypeFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {tiles?.length === 0 && failedTypes.length === 0 && (
        <div className="empty-state">
          <p>ยังไม่มีชุดโจทย์ สร้างชุดแรกกันเลย</p>
        </div>
      )}
      {tiles !== null && tiles.length > 0 && filteredTiles?.length === 0 && (
        <div className="empty-state">
          <p>ไม่พบชุดโจทย์ที่ตรงกับเงื่อนไข</p>
        </div>
      )}

      {tiles === null && !error && (
        <div className={styles.grid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={styles.card}>
              <div className={`${styles.cardTop} skeleton`} />
              <div className={styles.cardBody}>
                <div className="skeleton" style={{ width: 70, height: 12 }} />
                <div className="skeleton" style={{ width: "75%", height: 20 }} />
                <div className="skeleton" style={{ width: 60, height: 22, borderRadius: 999 }} />
                <div className={styles.cardActions}>
                  <div className="skeleton" style={{ flex: 1, height: 32 }} />
                  <div className="skeleton" style={{ flex: 1, height: 32 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={styles.grid}>
        {filteredTiles?.map((tile, i) => {
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
              <button
                type="button"
                className={styles.deleteBtn}
                onClick={() => setPendingDelete(tile)}
                disabled={deletingId === tile.id}
                aria-label={`ลบ ${tile.title}`}
              >
                🗑
              </button>
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
