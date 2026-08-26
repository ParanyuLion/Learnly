"use client";

import { useEffect, useState } from "react";
import { shuffleIntoCards, isMatch, type Card, type Pair } from "@/lib/matching-game";
import { fetchJson } from "@/lib/fetch-json";

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

  if (error) return <p>{error}</p>;
  if (!cards) return <p>กำลังโหลด...</p>;

  const won = matchedPairIds.size > 0 && matchedPairIds.size === cards.length / 2;

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
      <h1>{title}</h1>
      {won && <p>ยินดีด้วย! จับคู่ครบแล้ว 🎉</p>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {cards.map((card) => {
          const isMatched = matchedPairIds.has(card.pairId);
          const isSelected = selected?.id === card.id;
          const isWrong = wrongPair?.includes(card.id);
          return (
            <button
              key={card.id}
              onClick={() => handleClick(card)}
              disabled={isMatched}
              style={{
                padding: 16,
                background: isMatched ? "#c8f7c5" : isWrong ? "#f7c5c5" : isSelected ? "#c5d8f7" : "white",
                border: "1px solid #ccc",
                borderRadius: 8,
                cursor: isMatched ? "default" : "pointer",
              }}
            >
              {card.text}
            </button>
          );
        })}
      </div>
    </main>
  );
}
