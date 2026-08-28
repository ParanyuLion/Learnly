"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/fetch-json";
import { AlertDialog } from "@/components/AlertDialog";
import styles from "./page.module.css";

type CardInput = { front: string; back: string };

export default function EditFlashcardSetPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const isNew = params.id === "new";
  const [title, setTitle] = useState("");
  const [cards, setCards] = useState<CardInput[]>([{ front: "", back: "" }]);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isNew) return;
    fetchJson<{ title: string; cards: { front: string; back: string }[] }>(
      `/api/flashcard-sets/${params.id}`
    )
      .then((data) => {
        setTitle(data.title);
        setCards(data.cards.map((c) => ({ front: c.front, back: c.back })));
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [isNew, params.id]);

  function updateCard(index: number, field: keyof CardInput, value: string) {
    setCards((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  }

  function addCard() {
    setCards((prev) => [...prev, { front: "", back: "" }]);
  }

  function removeCard(index: number) {
    setCards((prev) => prev.filter((_, i) => i !== index));
  }

  async function save() {
    if (saving) return;

    const cleanCards = cards
      .map((c) => ({ front: c.front.trim(), back: c.back.trim() }))
      .filter((c) => c.front && c.back);

    if (!title.trim() || cleanCards.length === 0) {
      setAlertMessage("ต้องมีชื่อชุดโจทย์และการ์ดอย่างน้อย 1 ใบ");
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        const created = await fetchJson<{ id: string }>("/api/flashcard-sets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.trim() }),
        });

        await fetchJson(`/api/flashcard-sets/${created.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.trim(), cards: cleanCards }),
        });
      } else {
        await fetchJson(`/api/flashcard-sets/${params.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.trim(), cards: cleanCards }),
        });
      }
    } catch (err) {
      setAlertMessage(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
      setSaving(false);
      return;
    }

    router.push("/");
  }

  if (error) return <p className="error-banner">{error}</p>;
  if (loading) return <p>กำลังโหลด...</p>;

  return (
    <main className="page">
      <AlertDialog message={alertMessage} onClose={() => setAlertMessage(null)} />
      <div className="page-header">
        <h1 className="page-title">{isNew ? "สร้างชุดการ์ดใหม่" : "แก้ไขชุดการ์ด"}</h1>
      </div>
      <div className={styles.form}>
        <input
          className="text-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="ชื่อชุดโจทย์"
        />
        <div className={styles.cardList}>
          {cards.map((card, i) => (
            <div key={i} className={styles.cardRow}>
              <div className={styles.cardHalf}>
                <input
                  className={styles.cardInput}
                  value={card.front}
                  onChange={(e) => updateCard(i, "front", e.target.value)}
                  placeholder="ด้านหน้า"
                />
              </div>
              <div className={styles.cardHalf}>
                <input
                  className={styles.cardInput}
                  value={card.back}
                  onChange={(e) => updateCard(i, "back", e.target.value)}
                  placeholder="ด้านหลัง"
                />
              </div>
              <button className={styles.removeBtn} onClick={() => removeCard(i)} aria-label="ลบการ์ดนี้">
                ✕
              </button>
            </div>
          ))}
        </div>
        <button className="btn btn-outline" onClick={addCard}>
          + เพิ่มการ์ด
        </button>
        <div className={styles.actions}>
          <button className="btn btn-ghost" onClick={() => router.push("/")}>
            ยกเลิก
          </button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </div>
    </main>
  );
}
