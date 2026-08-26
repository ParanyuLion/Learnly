"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { shuffleIntoCards, isMatch, type Card, type Pair } from "@/lib/matching-game";
import { fetchJson } from "@/lib/fetch-json";
import styles from "./page.module.css";

export default function PlaySetPage({ params }: { params: { id: string } }) {
  const [title, setTitle] = useState("");
  const [cards, setCards] = useState<Card[] | null>(null);
  const [selected, setSelected] = useState<Card | null>(null);
  const [matchedPairIds, setMatchedPairIds] = useState<Set<string>>(new Set());
  const [wrongPair, setWrongPair] = useState<[string, string] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJson<{ title: string; pairs: Pair[] }>(`/api/sets/${params.id}`)
      .then((data) => {
        setTitle(data.title);
        setCards(shuffleIntoCards(data.pairs));
      })
      .catch((err) => setError(err.message));
  }, [params.id]);

  function handleClick(card: Card) {
    if (matchedPairIds.has(card.pairId) || card.id === selected?.id) return;

    if (!selected) {
      setSelected(card);
      return;
    }

    if (isMatch(selected, card)) {
      setMatchedPairIds((prev) => new Set(prev).add(card.pairId));
      setSelected(null);
    } else {
      setWrongPair([selected.id, card.id]);
      setTimeout(() => setWrongPair(null), 500);
      setSelected(null);
    }
  }

  if (error) return <p className="error-banner">{error}</p>;
  if (!cards) return <p>กำลังโหลด...</p>;

  const won = matchedPairIds.size > 0 && matchedPairIds.size === cards.length / 2;
  const leftCards = cards.filter((card) => card.side === "left");
  const rightCards = cards.filter((card) => card.side === "right");

  function renderCard(card: Card) {
    const isMatched = matchedPairIds.has(card.pairId);
    const isSelected = selected?.id === card.id;
    const isWrong = wrongPair?.includes(card.id);
    const state = isMatched ? "matched" : isWrong ? "wrong" : isSelected ? "selected" : undefined;
    return (
      <button
        key={card.id}
        className={styles.card}
        data-side={card.side}
        data-state={state}
        onClick={() => handleClick(card)}
        disabled={isMatched}
      >
        {card.text}
      </button>
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
      {won && <div className={styles.winBanner}>ยินดีด้วย! จับคู่ครบแล้ว 🎉</div>}
      <div className={styles.columns}>
        <div className={styles.column}>{leftCards.map(renderCard)}</div>
        <div className={styles.column}>{rightCards.map(renderCard)}</div>
      </div>
    </main>
  );
}
