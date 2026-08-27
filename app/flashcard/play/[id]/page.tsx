"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { shuffleCards, moveToBack, type Card } from "@/lib/flashcard-game";
import { fetchJson } from "@/lib/fetch-json";
import styles from "./page.module.css";

export default function PlayFlashcardSetPage({ params }: { params: { id: string } }) {
  const [title, setTitle] = useState("");
  const [deck, setDeck] = useState<Card[] | null>(null);
  const [totalCards, setTotalCards] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJson<{ title: string; cards: Card[] }>(`/api/flashcard-sets/${params.id}`)
      .then((data) => {
        setTitle(data.title);
        setTotalCards(data.cards.length);
        setDeck(shuffleCards(data.cards));
      })
      .catch((err) => setError(err.message));
  }, [params.id]);

  function markKnown() {
    setDeck((prev) => (prev ? prev.slice(1) : prev));
    setFlipped(false);
  }

  function markUnknown() {
    setDeck((prev) => (prev ? moveToBack(prev) : prev));
    setFlipped(false);
  }

  if (error) return <p className="error-banner">{error}</p>;
  if (!deck) return <p>กำลังโหลด...</p>;

  const won = totalCards > 0 && deck.length === 0;
  const current = deck[0];

  return (
    <main className="page">
      <div className="page-header">
        <h1 className="page-title">{title}</h1>
        <Link href="/" className="btn btn-ghost btn-sm">
          ← กลับหน้าแรก
        </Link>
      </div>
      {won && <div className={styles.winBanner}>ยินดีด้วย! จำได้ครบทุกใบแล้ว 🎉</div>}
      {!won && current && (
        <>
          <p className={styles.progress}>เหลือ {deck.length} ใบ</p>
          <div className={styles.cardStage}>
            <button
              className={styles.card}
              data-flipped={flipped}
              onClick={() => setFlipped((f) => !f)}
            >
              {flipped ? current.back : current.front}
            </button>
          </div>
          <div className={styles.actions}>
            <button className={`btn ${styles.dontKnowBtn}`} onClick={markUnknown}>
              ยังไม่จำ ✗
            </button>
            <button className={`btn ${styles.knowBtn}`} onClick={markKnown}>
              จำได้ ✓
            </button>
          </div>
        </>
      )}
      {!won && totalCards === 0 && (
        <div className="empty-state">
          <p>ชุดนี้ยังไม่มีการ์ด</p>
          <Link href={`/flashcard/edit/${params.id}`} className="btn btn-primary">
            เพิ่มการ์ด
          </Link>
        </div>
      )}
    </main>
  );
}
