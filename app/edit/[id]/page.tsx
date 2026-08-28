"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/fetch-json";
import styles from "./page.module.css";

type PairInput = { left: string; right: string };

export default function EditSetPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const isNew = params.id === "new";
  const [title, setTitle] = useState("");
  const [pairs, setPairs] = useState<PairInput[]>([{ left: "", right: "" }]);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isNew) return;
    fetchJson<{ title: string; pairs: { left: string; right: string }[] }>(`/api/sets/${params.id}`)
      .then((data) => {
        setTitle(data.title);
        setPairs(data.pairs.map((p) => ({ left: p.left, right: p.right })));
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [isNew, params.id]);

  function updatePair(index: number, field: keyof PairInput, value: string) {
    setPairs((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  }

  function addPair() {
    setPairs((prev) => [...prev, { left: "", right: "" }]);
  }

  function removePair(index: number) {
    setPairs((prev) => prev.filter((_, i) => i !== index));
  }

  async function save() {
    if (saving) return;

    const cleanPairs = pairs
      .map((p) => ({ left: p.left.trim(), right: p.right.trim() }))
      .filter((p) => p.left && p.right);

    if (!title.trim() || cleanPairs.length === 0) {
      alert("ต้องมีชื่อชุดโจทย์และคู่คำอย่างน้อย 1 คู่");
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        const created = await fetchJson<{ id: string }>("/api/sets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.trim() }),
        });

        await fetchJson(`/api/sets/${created.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.trim(), pairs: cleanPairs }),
        });
      } else {
        await fetchJson(`/api/sets/${params.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.trim(), pairs: cleanPairs }),
        });
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
      setSaving(false);
      return;
    }

    router.push("/");
  }

  if (error) return <p className="error-banner">{error}</p>;
  if (loading) return <p>กำลังโหลด...</p>;

  return (
    <main className="page">
      <div className="page-header">
        <h1 className="page-title">{isNew ? "สร้างชุดโจทย์ใหม่" : "แก้ไขชุดโจทย์"}</h1>
      </div>
      <div className={styles.form}>
        <input
          className="text-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="ชื่อชุดโจทย์"
        />
        <div className={styles.pairList}>
          {pairs.map((pair, i) => (
            <div key={i} className={styles.pairRow}>
              <div className={styles.pairHalf}>
                <input
                  className={styles.pairInput}
                  value={pair.left}
                  onChange={(e) => updatePair(i, "left", e.target.value)}
                  placeholder="คำซ้าย"
                />
              </div>
              <div className={styles.pairHalf}>
                <input
                  className={styles.pairInput}
                  value={pair.right}
                  onChange={(e) => updatePair(i, "right", e.target.value)}
                  placeholder="คำขวา"
                />
              </div>
              <button className={styles.removeBtn} onClick={() => removePair(i)} aria-label="ลบคู่คำนี้">
                ✕
              </button>
            </div>
          ))}
        </div>
        <button className="btn btn-outline" onClick={addPair}>
          + เพิ่มคู่คำ
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
