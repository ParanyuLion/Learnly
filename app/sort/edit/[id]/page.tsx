"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/fetch-json";
import { AlertDialog } from "@/components/AlertDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { getChildren, isLeafCategory, getLeafCategories, type Category } from "@/lib/sort-game";
import styles from "./page.module.css";

type CategoryInput = Category & { items: string[] };

type CategoryTreeInput = {
  name: string;
  items: string[];
  children: CategoryTreeInput[];
};

function newId() {
  return `local-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

function buildTree(categories: CategoryInput[], parentId: string | null): CategoryTreeInput[] {
  return getChildren(categories, parentId).map((cat) => {
    const full = categories.find((c) => c.id === cat.id)!;
    return {
      name: full.name.trim(),
      items: full.items.map((it) => it.trim()).filter(Boolean),
      children: buildTree(categories, full.id),
    };
  });
}

function collectDescendantIds(categories: CategoryInput[], rootId: string): string[] {
  const children = getChildren(categories, rootId);
  return [rootId, ...children.flatMap((c) => collectDescendantIds(categories, c.id))];
}

export default function EditSortSetPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const isNew = params.id === "new";
  const [title, setTitle] = useState("");
  const [categories, setCategories] = useState<CategoryInput[]>([
    { id: newId(), name: "", parentId: null, items: [""] },
    { id: newId(), name: "", parentId: null, items: [""] },
  ]);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [confirmSubcategoryParentId, setConfirmSubcategoryParentId] = useState<string | null>(null);

  useEffect(() => {
    if (isNew) return;
    fetchJson<{
      title: string;
      categories: { id: string; name: string; parentId: string | null }[];
      items: { id: string; text: string; categoryId: string }[];
    }>(`/api/sort-sets/${params.id}`)
      .then((data) => {
        setTitle(data.title);
        setCategories(
          data.categories.map((c) => ({
            id: c.id,
            name: c.name,
            parentId: c.parentId,
            items: data.items.filter((i) => i.categoryId === c.id).map((i) => i.text),
          }))
        );
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [isNew, params.id]);

  function updateCategoryName(id: string, name: string) {
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
  }

  function updateItem(id: string, itemIndex: number, text: string) {
    setCategories((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, items: c.items.map((it, j) => (j === itemIndex ? text : it)) } : c
      )
    );
  }

  function addItem(id: string) {
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, items: [...c.items, ""] } : c)));
  }

  function removeItem(id: string, itemIndex: number) {
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, items: c.items.filter((_, j) => j !== itemIndex) } : c))
    );
  }

  function addRootCategory() {
    setCategories((prev) => [...prev, { id: newId(), name: "", parentId: null, items: [""] }]);
  }

  function addSubcategory(parentId: string) {
    const parent = categories.find((c) => c.id === parentId);
    if (parent && parent.items.some((it) => it.trim())) {
      setConfirmSubcategoryParentId(parentId);
      return;
    }
    setCategories((prev) => [
      ...prev.map((c) => (c.id === parentId ? { ...c, items: [] } : c)),
      { id: newId(), name: "", parentId, items: [""] },
    ]);
  }

  function confirmAddSubcategory() {
    const parentId = confirmSubcategoryParentId;
    setConfirmSubcategoryParentId(null);
    if (!parentId) return;
    setCategories((prev) => [
      ...prev.map((c) => (c.id === parentId ? { ...c, items: [] } : c)),
      { id: newId(), name: "", parentId, items: [""] },
    ]);
  }

  function removeCategory(id: string) {
    const toRemove = new Set(collectDescendantIds(categories, id));
    setCategories((prev) => prev.filter((c) => !toRemove.has(c.id)));
  }

  async function save() {
    if (saving) return;

    const leaves = getLeafCategories(categories);
    const namesNonBlank = categories.every((c) => c.name.trim());
    const leavesHaveItems = leaves.every((c) => {
      const full = categories.find((cat) => cat.id === c.id)!;
      return full.items.some((it) => it.trim());
    });

    if (!title.trim() || !namesNonBlank || leaves.length < 2 || !leavesHaveItems) {
      setAlertMessage(
        "ต้องมีชื่อชุดโจทย์, ทุกหมวดหมู่ต้องมีชื่อ, และต้องมีหมวดย่อย (leaf) อย่างน้อย 2 หมวด แต่ละหมวดย่อยต้องมีอย่างน้อย 1 ไอเทม"
      );
      return;
    }

    const tree = buildTree(categories, null);

    setSaving(true);
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
          body: JSON.stringify({ title: title.trim(), categories: tree }),
        });
      } else {
        await fetchJson(`/api/sort-sets/${params.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.trim(), categories: tree }),
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

  const confirmParent = categories.find((c) => c.id === confirmSubcategoryParentId);

  function renderCategory(category: CategoryInput, depth: number) {
    const children = getChildren(categories, category.id);
    const isLeaf = isLeafCategory(categories, category.id);

    return (
      <div key={category.id} className={styles.categoryCard} style={{ marginLeft: depth * 20 }}>
        <div className={styles.categoryHeader}>
          <input
            className={`text-input ${styles.categoryNameInput}`}
            value={category.name}
            onChange={(e) => updateCategoryName(category.id, e.target.value)}
            placeholder="ชื่อหมวดหมู่"
          />
          <button
            className={styles.removeBtn}
            onClick={() => removeCategory(category.id)}
            aria-label="ลบหมวดหมู่นี้"
          >
            ✕
          </button>
        </div>

        {isLeaf && (
          <>
            <div className={styles.itemList}>
              {category.items.map((item, itemIndex) => (
                <div key={itemIndex} className={styles.itemRow}>
                  <input
                    className="text-input"
                    value={item}
                    onChange={(e) => updateItem(category.id, itemIndex, e.target.value)}
                    placeholder="ไอเทม"
                  />
                  <button
                    className={styles.removeBtn}
                    onClick={() => removeItem(category.id, itemIndex)}
                    aria-label="ลบไอเทมนี้"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className={styles.categoryButtonRow}>
              <button className="btn btn-outline btn-sm" onClick={() => addItem(category.id)}>
                + เพิ่มไอเทม
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => addSubcategory(category.id)}>
                + เพิ่มหมวดย่อย
              </button>
            </div>
          </>
        )}

        {!isLeaf && (
          <div className={styles.categoryButtonRow}>
            <button className="btn btn-outline btn-sm" onClick={() => addSubcategory(category.id)}>
              + เพิ่มหมวดย่อย
            </button>
          </div>
        )}

        {children.length > 0 && (
          <div className={styles.childList}>{children.map((child) => renderCategory(child, depth + 1))}</div>
        )}
      </div>
    );
  }

  return (
    <main className="page">
      <AlertDialog message={alertMessage} onClose={() => setAlertMessage(null)} />
      <ConfirmDialog
        message={
          confirmParent
            ? `การเพิ่มหมวดย่อยจะลบไอเทมที่มีอยู่ในหมวด "${confirmParent.name || "นี้"}" ดำเนินการต่อ?`
            : null
        }
        onConfirm={confirmAddSubcategory}
        onCancel={() => setConfirmSubcategoryParentId(null)}
        confirmLabel="ดำเนินการต่อ"
      />
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
          {getChildren(categories, null).map((category) => renderCategory(category, 0))}
        </div>
        <button className="btn btn-outline" onClick={addRootCategory}>
          + เพิ่มหมวดหมู่
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
