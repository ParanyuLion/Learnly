"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/fetch-json";
import styles from "./page.module.css";

type CategoryInput = { name: string; items: string[] };

export default function EditSortSetPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const isNew = params.id === "new";
  const [title, setTitle] = useState("");
  const [categories, setCategories] = useState<CategoryInput[]>([
    { name: "", items: [""] },
    { name: "", items: [""] },
  ]);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew) return;
    fetchJson<{
      title: string;
      categories: { name: string; items: { text: string }[] }[];
    }>(`/api/sort-sets/${params.id}`)
      .then((data) => {
        setTitle(data.title);
        setCategories(
          data.categories.map((c) => ({ name: c.name, items: c.items.map((i) => i.text) }))
        );
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [isNew, params.id]);

  function updateCategoryName(catIndex: number, name: string) {
    setCategories((prev) => prev.map((c, i) => (i === catIndex ? { ...c, name } : c)));
  }

  function updateItem(catIndex: number, itemIndex: number, text: string) {
    setCategories((prev) =>
      prev.map((c, i) =>
        i === catIndex ? { ...c, items: c.items.map((it, j) => (j === itemIndex ? text : it)) } : c
      )
    );
  }

  function addItem(catIndex: number) {
    setCategories((prev) =>
      prev.map((c, i) => (i === catIndex ? { ...c, items: [...c.items, ""] } : c))
    );
  }

  function removeItem(catIndex: number, itemIndex: number) {
    setCategories((prev) =>
      prev.map((c, i) =>
        i === catIndex ? { ...c, items: c.items.filter((_, j) => j !== itemIndex) } : c
      )
    );
  }

  function addCategory() {
    setCategories((prev) => [...prev, { name: "", items: [""] }]);
  }

  function removeCategory(catIndex: number) {
    setCategories((prev) => prev.filter((_, i) => i !== catIndex));
  }

  async function save() {
    const cleanCategories = categories
      .map((c) => ({
        name: c.name.trim(),
        items: c.items.map((it) => it.trim()).filter(Boolean),
      }))
      .filter((c) => c.name && c.items.length > 0);

    if (!title.trim() || cleanCategories.length < 2) {
      alert("ต้องมีชื่อชุดโจทย์และอย่างน้อย 2 หมวดหมู่ (แต่ละหมวดต้องมีอย่างน้อย 1 ไอเทม)");
      return;
    }

    try {
      if (isNew) {
        const created = await fetchJson<{ id: string }>("/api/sort-sets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.trim() }),
        });

        await fetchJson(`/api/sort-sets/${created.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.trim(), categories: cleanCategories }),
        });
      } else {
        await fetchJson(`/api/sort-sets/${params.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.trim(), categories: cleanCategories }),
        });
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
      return;
    }

    router.push("/");
  }

  if (error) return <p className="error-banner">{error}</p>;
  if (loading) return <p>กำลังโหลด...</p>;

  return (
    <main className="page">
      <div className="page-header">
        <h1 className="page-title">{isNew ? "สร้างเกมจัดหมวดหมู่ใหม่" : "แก้ไขเกมจัดหมวดหมู่"}</h1>
      </div>
      <div className={styles.form}>
        <input
          className="text-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="ชื่อชุดโจทย์"
        />
        <div className={styles.categoryList}>
          {categories.map((category, catIndex) => (
            <div key={catIndex} className={styles.categoryCard}>
              <div className={styles.categoryHeader}>
                <input
                  className={`text-input ${styles.categoryNameInput}`}
                  value={category.name}
                  onChange={(e) => updateCategoryName(catIndex, e.target.value)}
                  placeholder="ชื่อหมวดหมู่"
                />
                <button className={styles.removeBtn} onClick={() => removeCategory(catIndex)} aria-label="ลบหมวดหมู่นี้">
                  ✕
                </button>
              </div>
              <div className={styles.itemList}>
                {category.items.map((item, itemIndex) => (
                  <div key={itemIndex} className={styles.itemRow}>
                    <input
                      className="text-input"
                      value={item}
                      onChange={(e) => updateItem(catIndex, itemIndex, e.target.value)}
                      placeholder="ไอเทม"
                    />
                    <button
                      className={styles.removeBtn}
                      onClick={() => removeItem(catIndex, itemIndex)}
                      aria-label="ลบไอเทมนี้"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => addItem(catIndex)}>
                + เพิ่มไอเทม
              </button>
            </div>
          ))}
        </div>
        <button className="btn btn-outline" onClick={addCategory}>
          + เพิ่มหมวดหมู่
        </button>
        <div className={styles.actions}>
          <button className="btn btn-ghost" onClick={() => router.push("/")}>
            ยกเลิก
          </button>
          <button className="btn btn-primary" onClick={save}>
            บันทึก
          </button>
        </div>
      </div>
    </main>
  );
}
