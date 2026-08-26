"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/fetch-json";

type PairInput = { left: string; right: string };

export default function EditSetPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const isNew = params.id === "new";
  const [title, setTitle] = useState("");
  const [pairs, setPairs] = useState<PairInput[]>([{ left: "", right: "" }]);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState<string | null>(null);

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
    const cleanPairs = pairs
      .map((p) => ({ left: p.left.trim(), right: p.right.trim() }))
      .filter((p) => p.left && p.right);

    if (!title.trim() || cleanPairs.length === 0) {
      alert("ต้องมีชื่อชุดโจทย์และคู่คำอย่างน้อย 1 คู่");
      return;
    }

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
      return;
    }

    router.push("/");
  }

  if (error) return <p>{error}</p>;
  if (loading) return <p>กำลังโหลด...</p>;

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
      <h1>{isNew ? "สร้างชุดโจทย์ใหม่" : "แก้ไขชุดโจทย์"}</h1>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="ชื่อชุดโจทย์"
        style={{ display: "block", width: "100%", padding: 8, marginBottom: 16 }}
      />
      {pairs.map((pair, i) => (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            value={pair.left}
            onChange={(e) => updatePair(i, "left", e.target.value)}
            placeholder="คำซ้าย"
            style={{ flex: 1, padding: 8 }}
          />
          <input
            value={pair.right}
            onChange={(e) => updatePair(i, "right", e.target.value)}
            placeholder="คำขวา"
            style={{ flex: 1, padding: 8 }}
          />
          <button onClick={() => removePair(i)}>ลบ</button>
        </div>
      ))}
      <button onClick={addPair}>+ เพิ่มคู่คำ</button>
      <div style={{ marginTop: 16 }}>
        <button onClick={save}>บันทึก</button>
      </div>
    </main>
  );
}
